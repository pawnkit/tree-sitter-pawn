const fs = require("node:fs");
const path = require("node:path");

const parserPath = path.resolve(__dirname, "../src/parser.c");
const grammarPath = path.resolve(__dirname, "../src/grammar.json");
const metricsPath = path.resolve(__dirname, "parser-metrics.json");
const parser = fs.readFileSync(parserPath, "utf8");
const grammar = JSON.parse(fs.readFileSync(grammarPath, "utf8"));
const expected = JSON.parse(fs.readFileSync(metricsPath, "utf8"));
const value = (name) => {
  const match = parser.match(new RegExp(`^#define ${name} (\\d+)$`, "m"));
  if (!match) throw new Error(`missing generated constant: ${name}`);
  return Number(match[1]);
};

const measurements = {
  bytes: fs.statSync(parserPath).size,
  lines: parser.split("\n").length - 1,
  states: value("STATE_COUNT"),
  largeStates: value("LARGE_STATE_COUNT"),
  symbols: value("SYMBOL_COUNT"),
  tokens: value("TOKEN_COUNT"),
  externalTokens: value("EXTERNAL_TOKEN_COUNT"),
  productionIds: value("PRODUCTION_ID_COUNT"),
  rules: Object.keys(grammar.rules).length,
  conflicts: grammar.conflicts.length,
};

if (/aux_sym_source_file_repeat\d+/.test(parser)) {
  throw new Error(
    "source_file must not use a generated repeat symbol; it truncates in some downstream runtimes",
  );
}

for (const name of ["array_literal_items", "enum_entries"]) {
  if (new RegExp(`aux_sym__${name}_repeat\\d+`).test(parser)) {
    throw new Error(
      `${name} must not use a generated repeat symbol; downstream GLR runtimes fork at every ordinary list item`,
    );
  }
}

for (const [name, limit] of Object.entries(expected.limits)) {
  const actual = measurements[name];
  if (actual === undefined) {
    throw new Error(`parser metric ${name} has a limit but is not measured`);
  }
  if (actual > limit) {
    throw new Error(`parser ${name} ${actual} exceeds budget ${limit}`);
  }
}

const rows = Object.entries(measurements).map(([name, actual]) => {
  const baseline = expected.baseline[name];
  const delta = baseline === undefined ? "n/a" : actual - baseline;
  return { metric: name, actual, baseline, delta, limit: expected.limits[name] };
});

console.table(rows);
console.log("parser metrics budgets passed");
