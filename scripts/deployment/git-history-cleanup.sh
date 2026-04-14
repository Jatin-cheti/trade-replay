#!/usr/bin/env bash
# ================================================================
# git-history-cleanup.sh
#
# Removes sensitive file paths from git history using git-filter-repo.
# This is a DESTRUCTIVE operation — back up your repo first.
#
# Prerequisites:
#   pip install git-filter-repo
#
# Usage:
#   bash scripts/deployment/git-history-cleanup.sh
#
# After running:
#   git push --force --all
#   git push --force --tags
#
# All team members must re-clone after a force push.
# ================================================================

set -euo pipefail

echo "=== Git History Cleanup ==="
echo ""

# Check for git-filter-repo
if ! command -v git-filter-repo &>/dev/null; then
  echo "ERROR: git-filter-repo not found."
  echo "Install: pip install git-filter-repo"
  exit 1
fi

# Files to remove from history
FILES_TO_PURGE=(
  ".env.production"
  ".env.production.template"
  "deploy/env/.env.secrets.ci"
)

echo "Files to purge from history:"
for f in "${FILES_TO_PURGE[@]}"; do
  echo "  - $f"
done
echo ""

read -p "This will REWRITE git history. Continue? (y/N) " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

# Build --path arguments
PATHS_ARGS=""
for f in "${FILES_TO_PURGE[@]}"; do
  PATHS_ARGS="$PATHS_ARGS --path $f"
done

echo "Running git-filter-repo..."
git filter-repo --invert-paths $PATHS_ARGS --force

echo ""
echo "=== Done ==="
echo ""
echo "Next steps:"
echo "  1. Verify: git log --all --diff-filter=A --name-only -- '.env*'"
echo "  2. Force push: git push --force --all && git push --force --tags"
echo "  3. All team members must re-clone the repository"
echo "  4. Rotate any keys that were in those files (see .env.example)"
