const assert = require("node:assert/strict");
const packageManifest = require("../package.json");
const treeSitterManifest = require("../tree-sitter.json");

assert.equal(treeSitterManifest.metadata.version, packageManifest.version);
assert.equal(treeSitterManifest.metadata.license, packageManifest.license);
assert.equal(treeSitterManifest.metadata.description, packageManifest.description);

console.log("package metadata matches tree-sitter.json");
