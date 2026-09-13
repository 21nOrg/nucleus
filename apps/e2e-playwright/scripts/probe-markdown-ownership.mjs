import { chromium, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.."
);
const artifacts = `${root}/apps/e2e-playwright/artifacts/component-ownership-${Date.now()}`;
await fs.mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  ignoreHTTPSErrors: true,
  viewport: { width: 1512, height: 982 }
});
await context.addInitScript(() => {
  performance.setResourceTimingBufferSize(10000);
  localStorage.setItem(
    "offlineSessionId",
    localStorage.getItem("offlineSessionId") ?? crypto.randomUUID()
  );
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const id = `node:ownership_${Date.now()}`,
  blockId = id + "_block",
  content = "Ownership refactor persisted paragraph";
try {
  await page.goto(process.env.APP_BASE_URL ?? "https://local.nucleum.app/", {
    waitUntil: "networkidle"
  });
  const modulePath = await page.evaluate(
    (root) =>
      performance
        .getEntriesByType("resource")
        .find(
          (e) =>
            new URL(e.name).pathname ===
            `/@fs${root}/client/datafn/datafn.store.ts`
        )?.name,
    root
  );
  if (!modulePath) throw new Error("Loaded DataFn module not found");
  await page.evaluate(
    async ({ modulePath, id, blockId }) => {
      const { datafn } = await import(modulePath);
      await datafn.node.mutate([
        {
          operation: "insert",
          id,
          record: {
            id,
            label: "Ownership smoke",
            body: "",
            contentType: "NODULAR_MARKDOWN",
            mdChildOrder: [blockId],
            metaType: "",
            text: "Initial paragraph"
          }
        },
        {
          operation: "insert",
          id: blockId,
          record: {
            id: blockId,
            label: "",
            body: "Initial paragraph",
            contentType: "SIMPLE_TEXT",
            creationContext: id,
            mdChildOrder: [],
            mdParent: [id],
            metaType: "",
            parent: id,
            parentPath: id,
            text: ""
          }
        }
      ]);
    },
    { modulePath, id, blockId }
  );
  await page.evaluate(
    async ({ root, id }) => {
      const modulePath = performance
        .getEntriesByType("resource")
        .find(
          (e) =>
            new URL(e.name).pathname ===
            `/@fs${root}/client/layout/navigation/navigation.ts`
        )?.name;
      if (!modulePath) throw new Error("Loaded navigation module not found");
      const { navigation } = await import(modulePath);
      navigation.openResource(id, "r");
    },
    { root, id }
  );
  const editor = page
    .locator('#mdContent > div[id^="md-block-"] [contenteditable]')
    .first();
  await expect(editor).toBeVisible({ timeout: 20000 });
  await editor.fill(content);
  await expect(editor).toHaveText(content);
  await page.screenshot({ path: `${artifacts}/edited.png` });
  await expect
    .poll(
      async () =>
        page.evaluate(
          async ({ root, blockId }) => {
            const modulePath = performance
              .getEntriesByType("resource")
              .find(
                (e) =>
                  new URL(e.name).pathname ===
                  `/@fs${root}/client/datafn/datafn.store.ts`
              )?.name;
            const { datafn } = await import(modulePath);
            const rows = await datafn.node.query({
              filters: { id: { $eq: blockId } }
            });
            return JSON.stringify(rows);
          },
          { root, blockId }
        ),
      { message: "Markdown edit is persisted before reload" }
    )
    .toContain(content);
  await page.reload({ waitUntil: "networkidle" });
  await expect(editor).toHaveText(content, { timeout: 20000 });
  await page.screenshot({ path: `${artifacts}/reloaded.png` });
  if (errors.length) throw new Error(JSON.stringify(errors));
  await fs.writeFile(
    `${artifacts}/result.json`,
    JSON.stringify({ passed: true, errors }, null, 2)
  );
  console.log(JSON.stringify({ artifacts, passed: true, errors }));
} catch (error) {
  await fs.writeFile(`${artifacts}/failure.html`, await page.content());
  await fs.writeFile(
    `${artifacts}/result.json`,
    JSON.stringify({ passed: false, error: String(error), errors }, null, 2)
  );
  console.error(JSON.stringify({ artifacts, error: String(error), errors }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
