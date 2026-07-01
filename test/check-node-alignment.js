const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const nodeTypes = JSON.parse(
  fs.readFileSync(path.join(root, "src/node-types.json"), "utf8"),
);
const publicNodes = new Set(nodeTypes.filter((node) => node.named).map((node) => node.type));
const corpus = fs
  .readdirSync(path.join(root, "test/corpus"))
  .filter((file) => file.endsWith(".txt"))
  .map((file) => fs.readFileSync(path.join(root, "test/corpus", file), "utf8"))
  .join("\n");
const assertedNodes = new Set(
  [...corpus.matchAll(/\(([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]),
);
const externalOnlyNodes = new Set(["conditional_else_if_statement"]);

const requiredPublicNodes = [
  "prefixed_function_declaration",
  "preproc_text",
  "macro_replacement",
];
for (const name of ["_declaration", "_directive"]) {
  const node = nodeTypes.find((candidate) => candidate.type === name);
  if (!node?.subtypes?.length) {
    throw new Error(`missing or empty public supertype: ${name}`);
  }
}
for (const name of requiredPublicNodes) {
  if (!publicNodes.has(name)) {
    throw new Error(`documented public node is not generated: ${name}`);
  }

  if (!corpus.includes(`(${name}`)) {
    throw new Error(`documented public node has no corpus assertion: ${name}`);
  }
}

for (const node of nodeTypes.filter(
  (node) => node.named && !node.subtypes && !node.type.startsWith("_"),
)) {
  if (!assertedNodes.has(node.type) && !externalOnlyNodes.has(node.type)) {
    throw new Error(`public named node has no corpus assertion: ${node.type}`);
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
