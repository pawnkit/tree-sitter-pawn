const fs = require("node:fs");
const path = require("node:path");

const parserPath = path.resolve(__dirname, "../src/parser.c");
const parser = fs.readFileSync(parserPath, "utf8");
const value = (name) => {
  const match = parser.match(new RegExp(`^#define ${name} (\\d+)$`, "m"));
  if (!match) throw new Error(`missing generated constant: ${name}`);
  return Number(match[1]);
};

const measurements = {
  bytes: fs.statSync(parserPath).size,
  lines: parser.split("\n").length - 1,
  states: value("STATE_COUNT"),
};
const limits = {
  bytes: 60 * 1024 * 1024,
  lines: 1_800_000,
  states: 32_000,
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

for (const [name, actual] of Object.entries(measurements)) {
  if (actual > limits[name]) {
    throw new Error(`parser ${name} ${actual} exceeds budget ${limits[name]}`);
  }
}

console.log(
  `parser size budget passed: ${measurements.states} states, ` +
    `${measurements.lines} lines, ${measurements.bytes} bytes`,
);
