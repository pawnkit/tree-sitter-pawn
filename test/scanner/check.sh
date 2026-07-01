#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$ROOT/test/external/tree-sitter-config.json"
TREE_SITTER="$ROOT/node_modules/.bin/tree-sitter"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

check_source() {
  local name=$1
  local source=$2
  local file="$TMP_DIR/$name.pwn"
  local output

  printf '%b' "$source" >"$file"
  output="$($TREE_SITTER parse --config-path "$CONFIG" "$file" 2>&1)"
  if printf '%s\n' "$output" | grep -Eq 'ERROR|MISSING'; then
    printf 'scanner boundary failed: %s\n%s\n' "$name" "$output" >&2
    exit 1
  fi
}

check_edit() {
  local name=$1
  local source=$2
  local edit=$3
  local file="$TMP_DIR/$name.pwn"
  local output

  printf '%b' "$source" >"$file"
  output="$($TREE_SITTER parse --config-path "$CONFIG" "$file" --edits "$edit" 2>&1)"
  if printf '%s\n' "$output" | grep -Eq 'ERROR|MISSING'; then
    printf 'incremental edit failed: %s\n%s\n' "$name" "$output" >&2
    exit 1
  fi
}

check_source lf 'stock Test() {\n    Call()\n}\n'
check_source crlf 'stock Test() {\r\n    Call()\r\n}\r\n'
check_source eof 'stock Test() { Call(); }'
check_source continued_define '#define WRAP(%0) \\\n+    Call(%0)\n'
check_source comment_terminator 'stock Test() {\n    Call() /* trailing */\n}\n'
check_source token_paste '#define PASTE(%0,%1) %0%1\n'
check_edit rename_call 'stock Test() {\n    Call()\n}\n' '19 4 Use'
check_edit add_semicolon 'stock Test() {\n    Call()\n}\n' '25 0 ;'

echo "scanner boundary and incremental edit fixtures parsed cleanly"
