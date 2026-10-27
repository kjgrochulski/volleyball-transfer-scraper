#!/bin/zsh
# Wrapper that launchd calls. Runs indexapp.js and writes a timestamped log.
#
# Node is found in this order:
#   1. the NODE_BIN environment variable, if set
#   2. `node` on PATH (Homebrew locations are added below)
#   3. the newest nvm-managed Node under ~/.nvm
# launchd does not load your shell profile, so nvm's PATH is not available by default.

SCRAPER_DIR="${0:A:h}"   # directory containing this script
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(command -v node)"
fi
if [[ -z "$NODE_BIN" ]]; then
  NODE_BIN="$(ls -1d "$HOME"/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V | tail -n 1)"
fi
if [[ -z "$NODE_BIN" || ! -x "$NODE_BIN" ]]; then
  echo "run_scraper.sh: could not find node. Set NODE_BIN to its full path." >&2
  exit 1
fi

LOG_DIR="$SCRAPER_DIR/output/logs"
mkdir -p "$LOG_DIR"

STAMP=$(date "+%Y-%m-%d_%H-%M-%S")
LOG="$LOG_DIR/scrape_$STAMP.log"

cd "$SCRAPER_DIR" || exit 1

{
  echo "=== run started $(date) ==="
  echo "node: $NODE_BIN"
  "$NODE_BIN" "$SCRAPER_DIR/indexapp.js"
  rc=$?
  echo "=== run finished $(date) (exit $rc) ==="
} >> "$LOG" 2>&1

# Keep only the 20 most recent logs
ls -1t "$LOG_DIR"/scrape_*.log 2>/dev/null | tail -n +21 | xargs rm -f 2>/dev/null

exit 0
