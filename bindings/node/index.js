const root = require("node:path").join(__dirname, "..", "..");

module.exports = require("node-gyp-build")(root);
module.exports.nodeTypeInfo = require("../../src/node-types.json");
