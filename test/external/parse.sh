#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspace/test/external"
DOWNLOADS="/workspace/.fixtures/pawn-projects"
CONFIG="$ROOT/tree-sitter-config.json"

if [[ ! -d "$DOWNLOADS" ]]; then
  echo "missing $DOWNLOADS; run npm run test:external:fetch first" >&2
  exit 1
fi

mapfile -t files < <(find "$DOWNLOADS" -type f \( -name '*.pwn' -o -name '*.inc' \) | sort)

if [[ ${#files[@]} -eq 0 ]]; then
  echo "no external Pawn fixtures found under $DOWNLOADS" >&2
  exit 1
fi

failed=0
failed_count=0

for file in "${files[@]}"; do
  file_failed=0
  tmp_output="$(mktemp)"
  if ! npx tree-sitter parse --config-path "$CONFIG" "$file" >"$tmp_output" 2>&1; then
    file_failed=1
  fi

  if rg -q 'ERROR|MISSING' "$tmp_output"; then
    file_failed=1
  fi

  if [[ $file_failed -eq 0 ]]; then
    echo "ok  ${file#/workspace/}"
  else
    failed=1
    failed_count=$((failed_count + 1))
    echo "fail ${file#/workspace/}"
    sed -n '1,40p' "$tmp_output"
  fi

  rm -f "$tmp_output"
done

if [[ $failed -ne 0 ]]; then
  echo "${failed_count} of ${#files[@]} external fixture files produced ERROR or MISSING nodes" >&2
  exit 1
fi

echo "parsed ${#files[@]} external fixture files without ERROR or MISSING nodes"