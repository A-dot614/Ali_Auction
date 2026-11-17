#!/usr/bin/env bash
set -euo pipefail

# Slice 10 (D8): grep-based secret scan over tracked files. No third-party action or token.
# Explicitly excluded files are listed in scripts/secret-scan-allowlist.txt.
cd "$(git rev-parse --show-toplevel)"

ALLOWLIST="scripts/secret-scan-allowlist.txt"
PATTERN='AKIA[0-9A-Z]{16}|sk_live_|-----BEGIN .* PRIVATE KEY-----|xox[baprs]-'
found=0

while IFS= read -r file; do
  if grep -qxF "$file" "$ALLOWLIST"; then
    continue
  fi
  matches="$(grep -InE "$PATTERN" "$file" 2>/dev/null || true)"
  if [[ -n "$matches" ]]; then
    echo "[secrets] POSSIBLE SECRET in $file" >&2
    echo "$matches" >&2
    found=1
  fi
done < <(git ls-files)

if [[ "$found" -ne 0 ]]; then
  echo "[secrets] FAIL: possible secret committed" >&2
  exit 1
fi

echo "[secrets] OK: no common key patterns found in tracked files"
