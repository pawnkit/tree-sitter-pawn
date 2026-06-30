#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
CONFIG="$ROOT/test/external/tree-sitter-config.json"

check_query() {
  local query=$1
  local fixture=$2
  shift 2

  local output
  output=$(tree-sitter query --captures --config-path "$CONFIG" "$query" "$fixture")

  local capture
  for capture in "$@"; do
    if ! grep -Fq -- "- $capture," <<<"$output"; then
      printf 'Missing @%s capture from %s on %s\n' "$capture" "$query" "$fixture" >&2
      exit 1
    fi
  done
}

cd "$ROOT"
check_query queries/highlights.scm test/queries/highlights.pwn \
  preproc function.macro parameter type function variable.parameter variable function.call
check_query queries/locals.scm test/queries/locals.pwn \
  local.scope local.definition local.reference
check_query queries/tags.scm test/queries/tags.pwn \
  definition.macro definition.function definition.type definition.constant \
  definition.variable reference.call
