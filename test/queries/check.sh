#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT/test/external/tree-sitter-config.json"
TREE_SITTER="$ROOT/node_modules/.bin/tree-sitter"

tmp_output="$(mktemp)"
trap 'rm -f "$tmp_output"' EXIT

cd "$ROOT"
for name in highlights locals tags; do
  "$TREE_SITTER" query --captures --config-path "$CONFIG" \
    "queries/$name.scm" "test/queries/$name.pwn" |
    sed -n 's/^.* - \([^,]*\), start: \(([^)]*)\), end: \(([^)]*)\),.*/\1|\2|\3/p' \
      >"$tmp_output"
  diff -u "test/queries/$name.expected" "$tmp_output"
done
