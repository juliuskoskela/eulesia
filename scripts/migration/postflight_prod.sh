#!/usr/bin/env bash
#
# Post-deployment checks for v2 prod cutover.
# Run from a machine that can SSH to the prod server.
#
# Usage: bash postflight_prod.sh <prod-host>
# Example: bash postflight_prod.sh eulesia-server-prod
#

set -euo pipefail

HOST="${1:-}"
if [ -z "$HOST" ]; then
  echo "Usage: bash postflight_prod.sh <prod-host>"
  exit 1
fi

SSH="ssh root@$HOST"
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} $name"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $name"
    FAIL=$((FAIL + 1))
  fi
}

echo "========================================="
echo "  Post-deployment checks: $HOST"
echo "========================================="
echo ""

# ---------------------------------------------------------------
# 1. Service health
# ---------------------------------------------------------------

echo "=== Services ==="

check "v2 server running" $SSH "systemctl is-active eulesia-server.service"
check "v1 API running" $SSH "systemctl is-active eulesia-api.service"
check "nginx running" $SSH "systemctl is-active nginx.service"
check "postgresql running" $SSH "systemctl is-active postgresql.service"

echo ""

# ---------------------------------------------------------------
# 2. HTTP health endpoints
# ---------------------------------------------------------------

echo "=== HTTP Health ==="

check "v2 /api/v1/health returns 200" $SSH "curl -sf http://127.0.0.1:3002/api/v1/health"
check "v2 /api/v2/health returns 200" $SSH "curl -sf http://127.0.0.1:3002/api/v2/health"
check "v1 /health returns 200" $SSH "curl -sf http://127.0.0.1:3001/api/v1/health"
check "nginx routes /api/ to v2" $SSH "curl -sf -H 'Host: eulesia.org' http://127.0.0.1:8080/api/v1/health | grep -q '0.1.0'"
check "nginx routes /health to v1" $SSH "curl -sf -H 'Host: eulesia.org' http://127.0.0.1:8080/health"
check "nginx serves frontend" $SSH "curl -sf -H 'Host: eulesia.org' http://127.0.0.1:8080/ | grep -q 'eulesia'"

echo ""

# ---------------------------------------------------------------
# 3. Auth endpoints
# ---------------------------------------------------------------

echo "=== Auth ==="

AUTH_CONFIG=$($SSH "curl -sf http://127.0.0.1:3002/api/v1/auth/config")
check "auth/config returns success" echo "$AUTH_CONFIG" | grep -q '"success":true'
check "FTN is enabled" echo "$AUTH_CONFIG" | grep -q '"ftnEnabled":true'
check "registration mode is ftn-open" echo "$AUTH_CONFIG" | grep -q '"ftn-open"'

echo ""

# ---------------------------------------------------------------
# 4. Data integrity (v2 database)
# ---------------------------------------------------------------

echo "=== Data Integrity ==="

V2_USERS=$($SSH "sudo -u postgres psql -d eulesia_v2 -tAX -c 'SELECT COUNT(*) FROM users'")
V2_THREADS=$($SSH "sudo -u postgres psql -d eulesia_v2 -tAX -c 'SELECT COUNT(*) FROM threads'")
V2_FTN=$($SSH 'sudo -u postgres psql -d eulesia_v2 -tAX -c "SELECT COUNT(*) FROM users WHERE rp_subject IS NOT NULL"')

echo "  v2 users: $V2_USERS"
echo "  v2 threads: $V2_THREADS"
echo "  v2 FTN users: $V2_FTN"

check "v2 has users" test "$V2_USERS" -gt 0
check "v2 has threads" test "$V2_THREADS" -gt 0
check "v2 has FTN users" test "$V2_FTN" -gt 0

# FK integrity
ORPHAN_T=$($SSH "sudo -u postgres psql -d eulesia_v2 -tAX -c 'SELECT COUNT(*) FROM threads t LEFT JOIN users u ON t.author_id = u.id WHERE u.id IS NULL'")
ORPHAN_C=$($SSH "sudo -u postgres psql -d eulesia_v2 -tAX -c 'SELECT COUNT(*) FROM comments c LEFT JOIN threads t ON c.thread_id = t.id WHERE t.id IS NULL'")
ORPHAN_M=$($SSH "sudo -u postgres psql -d eulesia_v2 -tAX -c 'SELECT COUNT(*) FROM messages m LEFT JOIN conversations c ON m.conversation_id = c.id WHERE c.id IS NULL'")

check "zero orphaned threads" test "$ORPHAN_T" -eq 0
check "zero orphaned comments" test "$ORPHAN_C" -eq 0
check "zero orphaned messages" test "$ORPHAN_M" -eq 0

echo ""

# ---------------------------------------------------------------
# 5. API responses serve real data
# ---------------------------------------------------------------

echo "=== API Data ==="

check "threads endpoint returns items" $SSH "curl -sf http://127.0.0.1:3002/api/v1/agora/threads?limit=1 | grep -q 'items'"
check "thread has title" $SSH "curl -sf http://127.0.0.1:3002/api/v1/agora/threads?limit=1 | grep -q 'title'"
check "municipalities endpoint works" $SSH "curl -sf http://127.0.0.1:3002/api/v1/map/municipalities | grep -q 'success'"
check "search endpoint works" $SSH "curl -sf 'http://127.0.0.1:3002/api/v1/search?q=test' | grep -q 'success'"

echo ""

# ---------------------------------------------------------------
# 6. Admin panel still works (v1)
# ---------------------------------------------------------------

echo "=== Admin (v1) ==="

check "admin health" $SSH "curl -sf -H 'Host: admin.eulesia.org' http://127.0.0.1:8080/api/v1/health"

echo ""

# ---------------------------------------------------------------
# 7. v1 data untouched
# ---------------------------------------------------------------

echo "=== v1 Data Safety ==="

V1_USERS=$($SSH "sudo -u postgres psql -d eulesia -tAX -c 'SELECT COUNT(*) FROM users'")
echo "  v1 users: $V1_USERS (should be unchanged)"
check "v1 users exist" test "$V1_USERS" -gt 0

echo ""

# ---------------------------------------------------------------
# Summary
# ---------------------------------------------------------------

echo "========================================="
echo "  Results: $PASS passed, $FAIL failed"
echo "========================================="

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}POSTFLIGHT FAILED — investigate before proceeding${NC}"
  exit 1
else
  echo -e "${GREEN}ALL CHECKS PASSED${NC}"
fi
