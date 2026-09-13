import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { getTableConfig } from "drizzle-orm/pg-core";
import { schema } from "../db/generated/datafn/datafn-schema.drizzle";

/** Runs SQL only against a disposable PostgreSQL container created by this process. */
function docker(args: string[], input?: string) {
  const result = spawnSync("docker", args, { input, encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(
      result.stderr || result.error?.message || "Docker command failed"
    );
  return result.stdout.trim();
}

const migrations = readMigrationFiles({
  migrationsFolder: fileURLToPath(
    new URL("../../drizzle/datafn", import.meta.url)
  )
});
const container = docker([
  "run",
  "--rm",
  "-d",
  "--network",
  "none",
  "-e",
  "POSTGRES_PASSWORD=migration-test-fixture",
  "postgres:17-alpine"
]);
const initialData = `
INSERT INTO "publicLink" (__ns, id, created_at, updated_at, level, principal_id, resource, scope, token_hash)
VALUES ('fixture', 'link', 0, 0, 'viewer', 'principal', 'node', 'resource', 'fixture-hash');
`;
const verification = `
UPDATE "publicLink" SET resource_region = 'insouth' WHERE id = 'link';
INSERT INTO capture (__ns, id, created_at, updated_at) VALUES ('fixture', 'capture', 0, 0);
INSERT INTO session (__ns, id, blocks, created_at, updated_at, elapsed, end_unix, extended, start_unix, type)
VALUES ('fixture', 'session', '[]', 0, 0, 10, 10, 0, 0, 'COUNTUP');
INSERT INTO "sessionLog" (__ns, id, created_at, updated_at, end_unix, start_unix, session_id)
VALUES ('fixture', 'log', 0, 0, 10, 0, 'session');
INSERT INTO session_items (__ns, id, item_id, session_id, to_resource)
VALUES ('fixture', 'item', 'node', 'session', 'node');
DELETE FROM session WHERE __ns = 'fixture' AND id = 'session';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM "publicLink" WHERE id = 'link' AND resource_region = 'insouth' AND token_hash = 'fixture-hash') THEN
    RAISE EXCEPTION 'Public link data was not preserved';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM capture WHERE id = 'capture' AND method = 'MARKDOWN' AND refresh_id = 0 AND children_with_structure = '[]'::jsonb AND root_structure = '[]'::jsonb) THEN
    RAISE EXCEPTION 'Capture defaults do not match the mapping';
  END IF;
  IF EXISTS (SELECT 1 FROM "sessionLog") OR EXISTS (SELECT 1 FROM session_items) THEN
    RAISE EXCEPTION 'Session relations were not deleted by cascade';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'publicLink_resource_region_idx') THEN
    RAISE EXCEPTION 'Public link region index is missing';
  END IF;
END $$;
`;

try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (
      spawnSync(
        "docker",
        ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
        { stdio: "ignore" }
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert(ready, "Disposable PostgreSQL did not become ready");
  for (const mode of ["fresh", "upgrade"]) {
    docker(["exec", container, "createdb", "-U", "postgres", mode]);
    const sql = (input: string) =>
      docker(
        [
          "exec",
          "-i",
          container,
          "psql",
          "-U",
          "postgres",
          "-d",
          mode,
          "-v",
          "ON_ERROR_STOP=1",
          "-At"
        ],
        input
      );
    if (mode === "upgrade") {
      sql(migrations[0].sql.join(";\n"));
      sql(initialData);
      for (const migration of migrations.slice(1))
        sql(migration.sql.join(";\n"));
    } else {
      for (const migration of migrations) sql(migration.sql.join(";\n"));
      sql(initialData);
    }
    const actual = new Set(
      sql(
        "SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema = 'public';"
      ).split("\n")
    );
    let columns = 0;
    for (const table of Object.values(schema)) {
      const config = getTableConfig(table);
      for (const column of config.columns) {
        assert(
          actual.has(`${config.name}.${column.name}`),
          `Missing mapped column ${config.name}.${column.name}`
        );
        columns++;
      }
    }
    sql(verification);
    console.log(
      `${mode}: ${migrations.length} migrations, ${columns} mapped columns, public links, capture defaults, and session cascades passed`
    );
  }
} finally {
  docker(["rm", "-f", container]);
}
