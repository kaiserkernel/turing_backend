#!/usr/bin/env bash
# Checks the service responds correctly without needing valid credentials.
# Usage: ./scripts/smoke-test.sh [base_url]

BASE="${1:-http://localhost:3000}"

check() {
  printf '%-28s ' "$1"
  shift
  curl -s --max-time 10 "$@"
  echo
}

echo "Testing $BASE"
echo

check "health"              "$BASE/health"
check "no session"          "$BASE/api/cameras"
check "incomplete session"  -H "x-geotab-session: x" "$BASE/api/cameras"
check "disallowed server"   -H "x-geotab-server: evil.example.com" \
                            -H "x-geotab-database: d" \
                            -H "x-geotab-user: u" \
                            -H "x-geotab-session: s" "$BASE/api/cameras"
check "unknown route"       "$BASE/nope"

echo
echo "Expected: health ok, then four error responses."
