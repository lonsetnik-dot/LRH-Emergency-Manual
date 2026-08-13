#!/usr/bin/env bash
# LRH Emergency Manual - run the whole verify suite with one command.
#
#     bash run-tests.sh
#
# Starts a static web server on :8123, runs every verify_*.mjs against it, then
# decodes the QR-label screenshots. Exits non-zero if anything fails, so both a
# human and CI can trust the exit code.
#
# This is the same suite CI runs. Requires Node with the dev dependencies
# installed (`npm ci`) and Playwright's chromium (`npx playwright install
# chromium`). The QR decode also needs pyzbar+pillow and the system zbar lib; if
# those are missing it is skipped with a notice, unless STRICT_QR=1.
set -uo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8123}"
BASE="http://127.0.0.1:${PORT}"

# Clear any QR captures from a previous run so the decode step can't be fooled
# by stale images.
rm -f /tmp/qr_*.png /tmp/qr_*.want 2>/dev/null || true

# --- static server -----------------------------------------------------------
# Build the site (inlines design-system.css into marked tools) and test the
# actual deployed output in dist/, not the source — so CI catches a broken build.
# SITE_CONFIG picks the answer sheet the whole run is built and asserted against.
# Default is site.config.json (this deployment's own). The template branch ships
# it blank, so the default run is the "not localized yet" run — which is the
# state a fork is actually in, and therefore the one worth testing by default.
#   SITE_CONFIG=site.config.lrh.json bash run-tests.sh   # the worked example
SITE_CONFIG="${SITE_CONFIG:-site.config.json}"
export SITE_CONFIG
echo "=== building against ${SITE_CONFIG} ==="
node build.mjs --config "$SITE_CONFIG"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory dist >/tmp/edm-httpd.log 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

# Wait for the server to answer before hammering it with browser loads.
for _ in $(seq 1 40); do
  curl -sf "$BASE/" >/dev/null 2>&1 && break
  sleep 0.25
done

fail=0
echo "=== verify suite (BASE=$BASE) ==="
for f in verify_*.mjs; do
  [ -e "$f" ] || continue
  echo ""
  echo "--- $f ---"
  if BASE="$BASE" node "$f"; then :; else echo "!! FAILED: $f"; fail=1; fi
done

echo ""
echo "--- verify_qr_decode.py ---"
if python3 verify_qr_decode.py; then :; else echo "!! FAILED: verify_qr_decode.py"; fail=1; fi

echo ""
if [ "$fail" -eq 0 ]; then
  echo "ALL GREEN"
else
  echo "SUITE FAILED"
fi
exit "$fail"
