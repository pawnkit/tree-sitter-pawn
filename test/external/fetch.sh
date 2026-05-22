#!/usr/bin/env bash
set -euo pipefail

ROOT="/workspace/test/external"
MANIFEST="$ROOT/sources.tsv"
DOWNLOADS="/workspace/.fixtures/pawn-projects"

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