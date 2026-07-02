const { execFileSync } = require("node:child_process");

const refs = process.argv.slice(2);
if (refs.length === 0) {
  console.error("usage: node test/parser-history.js <git-ref> [<git-ref> ...]");
  process.exit(2);
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 128 << 20 });
}

function constant(source, name) {
  const match = source.match(new RegExp(`^#define ${name} (\\d+)$`, "m"));
  return match ? Number(match[1]) : null;
}

const rows = refs.map((ref) => {
  const parser = git("show", `${ref}:src/parser.c`);
  const grammar = JSON.parse(git("show", `${ref}:src/grammar.json`));
  return {
    ref: git("rev-parse", "--short", ref).trim(),
    bytes: Buffer.byteLength(parser),
    states: constant(parser, "STATE_COUNT"),
    largeStates: constant(parser, "LARGE_STATE_COUNT"),
    symbols: constant(parser, "SYMBOL_COUNT"),
    externalTokens: constant(parser, "EXTERNAL_TOKEN_COUNT"),
    productions: constant(parser, "PRODUCTION_ID_COUNT"),
    rules: Object.keys(grammar.rules).length,
    conflicts: grammar.conflicts.length,
  };
});

console.table(rows);
