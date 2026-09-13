import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { checkWorkspaceDependencies } from "./workspace-dependencies.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
);
const aliases = Object.entries(
  JSON.parse(fs.readFileSync(path.join(root, "tools/alias-map.json"), "utf8"))
).sort((a, b) => b[0].length - a[0].length);
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: root, encoding: "utf8" }
)
  .split("\0")
  .filter(
    (file) =>
      /\.(?:[cm]?[jt]sx?|svelte)$/.test(file) &&
      fs.existsSync(path.join(root, file))
  );
const sourceFiles = new Set(files);
const edges = [];
const externalImports = [];
const retiredImports = [];
const retiredStoreMethods = new Map([
  [
    "client/stores/app.store.ts",
    new Set([
      "gotoPath",
      "openResource",
      "closeResource",
      "runAction",
      "runResourceAction",
      "initiateOAuth2Flow"
    ])
  ],
  [
    "client/stores/account.store.ts",
    new Set([
      "delete",
      "confirmDelete",
      "uploadFile",
      "uploadFileV2",
      "getSignedUrl",
      "saveLocalFile",
      "tempUploadToS3",
      "modifySubscription",
      "initiateSubscription",
      "restorePurchase",
      "verifyPayment"
    ])
  ],
  [
    "client/stores/uiState/uiState.store.ts",
    new Set(["addResourceToTabs", "removeResourceFromTabs", "toggleSidebar"])
  ]
]);
const retiredApplicationPaths = new Set(
  JSON.parse(
    fs.readFileSync(
      path.join(root, "tools/check/retired-application-paths.json"),
      "utf8"
    )
  ).map((file) => file.replace(/\.(ts|svelte)$/, ""))
);

/** Resolves aliases and relative source imports before applying ownership rules. */
function resolveImport(specifier, importer) {
  let target;
  if (specifier.startsWith("."))
    target = path.posix.normalize(
      path.posix.join(path.posix.dirname(importer), specifier)
    );
  else if (specifier.startsWith("$lib/")) target = specifier.slice(5);
  else {
    const alias = aliases.find(
      ([name]) => specifier === name || specifier.startsWith(`${name}/`)
    );
    if (alias) target = alias[1] + specifier.slice(alias[0].length);
  }
  if (!target) return;
  return (
    [
      target,
      `${target}.ts`,
      `${target}.svelte`,
      `${target}.js`,
      `${target}/index.ts`,
      `${target}/index.js`,
      target.replace(/\.js$/, ".ts")
    ].find((candidate) => sourceFiles.has(candidate)) ?? target
  );
}

for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const scripts = file.endsWith(".svelte")
    ? [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(
        (match) => match[1]
      )
    : [text];
  for (const script of scripts) {
    const source = ts.createSourceFile(
      file,
      script,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    );
    const visit = (node) => {
      if (
        (ts.isMethodDeclaration(node) || ts.isPropertyAssignment(node)) &&
        retiredStoreMethods.get(file)?.has(node.name.getText(source))
      )
        retiredImports.push({
          from: file,
          to: node.name.getText(source),
          reason: "Domain behavior returned to a shared state module"
        });
      let specifier;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        specifier = node.moduleSpecifier.text;
      else if (
        ts.isImportTypeNode(node) &&
        ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      )
        specifier = node.argument.literal.text;
      else if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          /^(require|vi\.(mock|doMock|importActual|importMock))$/.test(
            node.expression.getText(source)
          )) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        specifier = node.arguments[0].text;
      if (specifier) {
        if (/^@nucleum\/cx(?:\/|$)/.test(specifier))
          retiredImports.push({
            from: file,
            to: specifier,
            reason: "Retired empty workspace"
          });
        if (
          /^@21n\/(types|shared-types)(\/|$)/.test(specifier) ||
          /(?:^|\/)client\/types(?:\/|$)|(?:^|\/)shared\/types(?:\/|$)/.test(
            specifier
          )
        )
          retiredImports.push({
            from: file,
            to: specifier,
            reason: "Retired type package"
          });
        const target = resolveImport(specifier, file);
        if (
          target &&
          retiredApplicationPaths.has(target.replace(/\.(ts|svelte)$/, ""))
        )
          retiredImports.push({
            from: file,
            to: target,
            reason: "Relocated reusable application module"
          });
        if (target) {
          const typeOnly =
            ts.isImportTypeNode(node) ||
            (ts.isImportDeclaration(node) &&
              Boolean(
                node.importClause?.isTypeOnly ||
                (!node.importClause?.name &&
                  node.importClause?.namedBindings &&
                  ts.isNamedImports(node.importClause.namedBindings) &&
                  node.importClause.namedBindings.elements.length > 0 &&
                  node.importClause.namedBindings.elements.every(
                    (item) => item.isTypeOnly
                  ))
              )) ||
            (ts.isExportDeclaration(node) && Boolean(node.isTypeOnly));
          edges.push({ from: file, to: target, typeOnly });
        } else externalImports.push({ from: file, to: specifier });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

const production = ({ from }) =>
  !/\.(test|spec)\./.test(from) && !from.includes("/tests/");
const violations = edges.filter(production).filter(({ from, to }) => {
  if (
    from === "client/stores/app.store.ts" &&
    (/^client\/(application|features|products|layout)\//.test(to) ||
      to === "client/stores/account.store.ts")
  )
    return true;
  if (
    /^client\/stores\/resources\/recent(?:\.store|\.type|-host)\.ts$/.test(
      from
    ) &&
    (/^client\/(application|features|products)\//.test(to) ||
      to === "client/stores/app.store.ts")
  )
    return true;
  if (
    from.startsWith("client/stores/overlays/") &&
    /^client\/(application|features|products)\//.test(to)
  )
    return true;
  if (
    /^(schema|shared|services|server)\//.test(from) &&
    to.startsWith("client/")
  )
    return !(
      from === "server/common/relay/index.ts" &&
      to === "client/components/flux/flux.type"
    );
  if (
    from.startsWith("client/features/") &&
    /^client\/(products|application)\//.test(to)
  )
    return true;
  if (
    from === "client/stores/resources/record-renderer.ts" &&
    (/^client\/(application|features|products)\//.test(to) ||
      to === "client/stores/app.store.ts")
  )
    return true;
  if (
    /^client\/(components|elements)\//.test(from) &&
    /^client\/(features|products|application)\//.test(to)
  )
    return true;
  if (
    /^client\/(datafn|runtime)\//.test(from) &&
    /^client\/(features|products|application|components|stores|layout|elements|actions)\//.test(
      to
    )
  )
    return true;
  if (
    /^client\/stores\/resources\/(resource\.actions|bulk-editor|resource-action-host)\.ts$/.test(
      from
    ) &&
    (/^client\/(application|products)\//.test(to) ||
      (to.startsWith("client/features/") &&
        to !== "client/datafn/link.type.ts"))
  )
    return true;
  if (
    /^client\/(stores\/resources\/(resource-panel[^/]*|panelParam\.mixin|panelSwitcher\.mixin)\.ts|components\/records\/ResourcePanelSwitcher\.svelte)$/.test(
      from
    ) &&
    (/^client\/(application|features|products)\//.test(to) ||
      to === "client/stores/app.store.ts")
  )
    return true;
  if (
    (from.startsWith("client/stores/keyboard/") ||
      from === "client/components/keyboard/ComponentShortcutListener.svelte") &&
    (/^client\/(application|features|products)\//.test(to) ||
      to === "client/stores/app.store.ts")
  )
    return true;
  if (
    from === "client/features/focus/composition.utils.ts" &&
    to === "client/features/focus/session.store.ts"
  )
    return true;
  return false;
});
violations.push(...retiredImports);
if (
  fs.existsSync(path.join(root, "client/cx/package.json")) ||
  JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  ).workspaces.includes("client/cx") ||
  aliases.some(([name]) => name === "@nucleum/cx")
)
  violations.push({
    from: "package.json",
    to: "client/cx",
    reason: "Retired empty workspace"
  });
const productionGraph = new Map();
const runtimeGraph = new Map();
for (const { from, to } of edges.filter(production)) {
  if (!productionGraph.has(from)) productionGraph.set(from, []);
  productionGraph.get(from).push(to);
}
for (const { from, to, typeOnly } of edges.filter(production)) {
  if (typeOnly) continue;
  if (!runtimeGraph.has(from)) runtimeGraph.set(from, []);
  runtimeGraph.get(from).push(to);
}
for (const root of runtimeGraph.keys()) {
  if (!/^client\/(stores|utils|actions|components|elements)\//.test(root))
    continue;
  const pending = [...runtimeGraph.get(root)];
  const visited = new Set();
  while (pending.length) {
    const target = pending.pop();
    if (visited.has(target)) continue;
    visited.add(target);
    if (/^client\/(application|features|products)\//.test(target))
      violations.push({
        from: root,
        to: target,
        reason: "Shared runtime dependency reaches composition"
      });
    pending.push(...(runtimeGraph.get(target) ?? []));
  }
}
for (const root of productionGraph.keys()) {
  const isSharedMarkdown = root.startsWith("client/elements/markdown/");
  const isIsolatedRuntime = /^client\/runtime\/(embed|inference|audio)\//.test(
    root
  );
  if (
    !isSharedMarkdown &&
    !isIsolatedRuntime &&
    !root.startsWith("client/stores/overlays/")
  )
    continue;
  const pending = [...productionGraph.get(root)];
  const visited = new Set();
  while (pending.length) {
    const target = pending.pop();
    if (visited.has(target)) continue;
    visited.add(target);
    if (
      isSharedMarkdown
        ? target.startsWith("client/") &&
          !target.startsWith("client/elements/markdown/")
        : isIsolatedRuntime
          ? target.startsWith("client/") &&
            !target.startsWith("client/runtime/")
          : /^client\/(application|features|products)\//.test(target)
    )
      violations.push({
        from: root,
        to: target,
        reason: isSharedMarkdown
          ? "Shared Markdown presentation transitively depends on frontend implementation"
          : isIsolatedRuntime
            ? "Runtime transport transitively depends on frontend implementation"
            : "Overlay state transitively depends on composition"
      });
    pending.push(...(productionGraph.get(target) ?? []));
  }
}
const contract = JSON.parse(
  fs.readFileSync(
    path.join(root, "tools/check/feature-entrypoints.json"),
    "utf8"
  )
);
for (const edge of edges.filter(production)) {
  const targetFeature = edge.to.match(/^client\/features\/([^/]+)\//)?.[1];
  if (
    !targetFeature ||
    edge.from.startsWith(`client/features/${targetFeature}/`)
  )
    continue;
  if (!contract.includes(edge.to))
    violations.push({ ...edge, reason: "Feature entry point is not declared" });
}
for (const entry of contract) {
  const capability = entry.split("/").slice(0, 3).join("/") + "/";
  if (
    !edges.some(
      (edge) => edge.to === entry && !edge.from.startsWith(capability)
    )
  )
    violations.push({
      from: "tools/check/feature-entrypoints.json",
      to: entry,
      reason: "Public feature entry has no external consumer"
    });
}
violations.push(...checkWorkspaceDependencies(edges, externalImports));
if (process.argv.includes("--graph"))
  console.log(JSON.stringify(edges, null, 2));
else {
  for (const edge of violations)
    console.error(
      `${edge.from} -> ${edge.to}${edge.reason ? `: ${edge.reason}` : ""}`
    );
  console.log(
    `Architecture: ${files.length} source files, ${edges.length} resolved imports, ${violations.length} violations.`
  );
}
process.exitCode = violations.length ? 1 : 0;
