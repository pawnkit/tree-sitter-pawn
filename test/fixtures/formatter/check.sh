#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONFIG="$ROOT/test/external/tree-sitter-config.json"
TREE_SITTER="$ROOT/node_modules/.bin/tree-sitter"

failed=0
for file in "$ROOT"/test/fixtures/formatter/*.pwn; do
  output="$($TREE_SITTER parse --config-path "$CONFIG" "$file" 2>&1)" || failed=1
  if printf '%s\n' "$output" | grep -Eq 'ERROR|MISSING'; then
    printf '%s\n' "$output" >&2
    failed=1
  fi
done

if [[ $failed -ne 0 ]]; then
  echo "formatter fixture parse failed" >&2
  exit 1
fi

echo "formatter fixtures parsed without ERROR or MISSING nodes"
