const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: node scripts/run-tree-sitter.js <args...>");
  process.exit(1);
}

const localCli = path.join(__dirname, "..", "node_modules", "tree-sitter-cli", "tree-sitter");
const candidates = [];

if (process.env.TREE_SITTER_CLI) {
  candidates.push(process.env.TREE_SITTER_CLI);
}

candidates.push(localCli, "tree-sitter");

const attempted = new Set();
const failures = [];

for (const candidate of candidates) {
  if (!candidate || attempted.has(candidate)) {
    continue;
  }

  attempted.add(candidate);

  if (candidate !== "tree-sitter" && !fs.existsSync(candidate)) {
    failures.push(`${candidate}: not found`);
    continue;
  }

  const result = spawnSync(candidate, args, {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (!result.error && result.status === 0) {
    if (result.stdout) {
      process.stdout.write(result.stdout);
    }

    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(0);
  }

  if (result.error && result.error.code === "ENOENT") {
    failures.push(`${candidate}: not found in PATH`);
    continue;
  }

  if (result.status === 126 || result.status === 127) {
    failures.push(`${candidate}: exited with status ${result.status}${result.stderr ? `\n${result.stderr.trim()}` : ""}`);
    continue;
  }

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }

  if (result.stderr) {
    process.stderr.write(result.stderr);
  }

  process.exit(result.status ?? 1);
}

console.error("Unable to run a compatible tree-sitter CLI binary.");
console.error("Set TREE_SITTER_CLI to a working executable if the bundled npm binary is not compatible with this system.");

if (failures.length > 0) {
  console.error("Tried:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
}

process.exit(1);