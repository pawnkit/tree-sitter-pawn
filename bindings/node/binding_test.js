const assert = require("node:assert/strict");
const test = require("node:test");
const Parser = require("tree-sitter");
const Pawn = require(".");

test("loads and parses Pawn", () => {
  const parser = new Parser();
  parser.setLanguage(Pawn);

  const tree = parser.parse("main() { return 0; }");
  assert.equal(tree.rootNode.type, "source_file");
  assert.equal(tree.rootNode.hasError, false);
});
