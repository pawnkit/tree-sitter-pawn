const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const nodeTypes = JSON.parse(
  fs.readFileSync(path.join(root, "src/node-types.json"), "utf8"),
);
const publicNodes = new Set(nodeTypes.filter((node) => node.named).map((node) => node.type));

const requiredPublicNodes = [
  "prefixed_function_declaration",
  "preproc_text",
  "macro_replacement",
];
const conditionalAudit = fs.readFileSync(
  path.join(root, "docs/conditional-wrappers.md"),
  "utf8",
);

for (const node of nodeTypes.filter(
  (node) =>
    node.named &&
    (node.type.startsWith("conditional_") ||
      node.type === "loop_body_conditional_if_statement"),
)) {
  if (!conditionalAudit.includes(`\`${node.type}\``)) {
    throw new Error(`public conditional node is missing from audit: ${node.type}`);
  }
}

for (const name of requiredPublicNodes) {
  if (!publicNodes.has(name)) {
    throw new Error(`documented public node is not generated: ${name}`);
  }

  const corpus = fs
    .readdirSync(path.join(root, "test/corpus"))
    .filter((file) => file.endsWith(".txt"))
    .map((file) => fs.readFileSync(path.join(root, "test/corpus", file), "utf8"))
    .join("\n");
  if (!corpus.includes(`(${name}`)) {
    throw new Error(`documented public node has no corpus assertion: ${name}`);
  }

  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  if (!readme.includes(`\`${name}\``)) {
    throw new Error(`generated public node is missing from README: ${name}`);
  }
}

for (const file of fs.readdirSync(path.join(root, "queries"))) {
  if (!file.endsWith(".scm")) continue;
  const query = fs
    .readFileSync(path.join(root, "queries", file), "utf8")
    .replace(/;[^\n]*/g, "")
    .replace(/"(?:\\.|[^"\\])*"/g, "");
  const referencedNodes = [...query.matchAll(/\(([a-z_][a-z0-9_]*)/g)].map(
    (match) => match[1],
  );
  for (const name of new Set(referencedNodes)) {
    if (!publicNodes.has(name)) {
      throw new Error(`${file} references an unknown named node: ${name}`);
    }
  }
}

console.log("public-node and query alignment passed");
