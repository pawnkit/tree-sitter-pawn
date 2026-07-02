const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "../..");
const fixtureRoot = path.resolve(root, ".fixtures/pawn-projects");
const parser = path.resolve(root, "node_modules/.bin/tree-sitter");
const config = path.resolve(__dirname, "tree-sitter-config.json");

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const child = path.join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(child) : [child];
    })
    .filter((file) => /\.(?:pwn|inc)$/.test(file))
    .sort();
}

function offsetAt(lines, row, column) {
  let offset = 0;
  for (let index = 0; index < row && index < lines.length; index++) {
    offset += Buffer.byteLength(lines[index]) + 1;
  }
  return offset + column;
}

function rangesFor(tree, kind) {
  const ranges = [];
  const expression = new RegExp(
    `\\(${kind}(?: [^\\[]*)? \\[(\\d+), (\\d+)\\] - \\[(\\d+), (\\d+)\\]`,
    "g",
  );
  for (const match of tree.matchAll(expression)) {
    ranges.push(match.slice(1).map(Number));
  }
  return ranges;
}

function measure(file) {
  const started = process.hrtime.bigint();
  const result = spawnSync(
    parser,
    ["parse", "--config-path", config, file],
    { cwd: root, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
  );
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const tree = `${result.stdout || ""}\n${result.stderr || ""}`;
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split("\n");
  const errors = rangesFor(tree, "ERROR");
  const missingCount = (tree.match(/\(MISSING(?:\s|\))/g) || []).length;
  const errorSpans = errors.map(([sr, sc, er, ec]) =>
    Math.max(0, offsetAt(lines, er, ec) - offsetAt(lines, sr, sc)),
  );
  const topLevelNodes = (tree.match(/^  \([A-Za-z_]/gm) || []).length;
  const rootEnd = tree.match(/^\(source_file \[0, 0\] - \[(\d+), (\d+)\]/m);

  return {
    file: path.relative(root, file),
    bytes: Buffer.byteLength(source),
    elapsedMs: Math.round(elapsedMs * 10) / 10,
    exitStatus: result.status,
    errors: errors.length,
    missing: missingCount,
    errorBytes: errorSpans.reduce((total, size) => total + size, 0),
    maxErrorBytes: Math.max(0, ...errorSpans),
    genericNodes: (tree.match(/\((?:preproc_text|preproc_fragment)\b/g) || [])
      .length,
    topLevelNodes,
    reachesEof:
      rootEnd !== null &&
      Number(rootEnd[1]) >= lines.length - 1,
  };
}

const files = sourceFiles(fixtureRoot);
if (files.length === 0) {
  console.error(`no external fixtures found under ${fixtureRoot}`);
  process.exit(1);
}

const measurements = files.map(measure);
const summary = measurements.reduce(
  (total, item) => ({
    files: total.files + 1,
    bytes: total.bytes + item.bytes,
    elapsedMs: total.elapsedMs + item.elapsedMs,
    failedParses: total.failedParses + Number(item.exitStatus !== 0),
    errors: total.errors + item.errors,
    missing: total.missing + item.missing,
    errorBytes: total.errorBytes + item.errorBytes,
    maxErrorBytes: Math.max(total.maxErrorBytes, item.maxErrorBytes),
    genericNodes: total.genericNodes + item.genericNodes,
    topLevelNodes: total.topLevelNodes + item.topLevelNodes,
    eofFailures: total.eofFailures + Number(!item.reachesEof),
  }),
  {
    files: 0,
    bytes: 0,
    elapsedMs: 0,
    failedParses: 0,
    errors: 0,
    missing: 0,
    errorBytes: 0,
    maxErrorBytes: 0,
    genericNodes: 0,
    topLevelNodes: 0,
    eofFailures: 0,
  },
);
summary.elapsedMs = Math.round(summary.elapsedMs * 10) / 10;

const report = { summary, files: measurements };
if (process.env.QUALITY_REPORT) {
  fs.writeFileSync(
    path.resolve(root, process.env.QUALITY_REPORT),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}

console.log(JSON.stringify(summary, null, 2));
for (const item of measurements.filter(
  (entry) =>
    entry.exitStatus !== 0 ||
    entry.errors !== 0 ||
    entry.missing !== 0 ||
    !entry.reachesEof,
)) {
  console.log(JSON.stringify(item));
}
