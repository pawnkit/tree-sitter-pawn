#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ROOT="$SCRIPT_DIR"
MANIFEST="$ROOT/sources.tsv"
DOWNLOADS="$REPO_ROOT/.fixtures/pawn-projects"

mkdir -p "$(dirname "$DOWNLOADS")"
tmp_downloads="$(mktemp -d "${DOWNLOADS}.tmp.XXXXXX")"
cleanup() {
  if [[ -n "${tmp_downloads:-}" && -d "$tmp_downloads" ]]; then
    rm -rf "$tmp_downloads"
  fi
}
trap cleanup EXIT

while IFS=$'\t' read -r project relpath url || [[ -n "${project:-}" ]]; do
  if [[ "$project" == "project" || -z "$project" ]]; then
    continue
  fi

  target="$tmp_downloads/$project/$relpath"
  mkdir -p "$(dirname "$target")"
  curl -fsSL "$url" -o "$target"
  echo "fetched $project/$relpath"
done < "$MANIFEST"

rm -rf "$DOWNLOADS"
mv "$tmp_downloads" "$DOWNLOADS"
tmp_downloads=""
