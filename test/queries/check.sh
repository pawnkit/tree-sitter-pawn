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

  local expectation capture source matches
  for expectation in "$@"; do
    capture=${expectation%%=*}
    if [[ "$expectation" == *=* ]]; then
      source=${expectation#*=}
    else
      source=""
    fi
    matches=$(grep -F -- "- $capture," <<<"$output" || true)
    if [[ -z "$matches" ]] || \
      { [[ -n "$source" ]] && ! grep -Fq -- "text: \`$source\`" <<<"$matches"; }; then
      printf 'Missing @%s capture for %q from %s on %s\n' \
        "$capture" "$source" "$query" "$fixture" >&2
      exit 1
    fi
  done
}

cd "$ROOT"
check_query queries/highlights.scm test/queries/highlights.pwn \
  'preproc=#define DOUBLE(%0) ((%0) * 2)' function.macro=DOUBLE 'parameter=%0' \
  type=Float function=scale variable.parameter=value variable=result function.call=DOUBLE
check_query queries/locals.scm test/queries/locals.pwn \
  local.scope local.definition=input local.definition=total \
  local.reference=total
check_query queries/tags.scm test/queries/tags.pwn \
  definition.macro definition.function definition.type definition.constant \
  definition.variable reference.call name=DOUBLE name=OnReady name=Status \
  name=Status_Ready name=global_value
