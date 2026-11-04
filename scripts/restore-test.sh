#!/usr/bin/env bash
# Restore test: restore the newest dump into a scratch database and compare row counts
# for "User", "Product" and "Order" against the source. Exit 0 only if all match.
# Set ALLOW_SOURCE_GROWTH=1 to accept restored <= source (source kept receiving writes after the dump).
set -euo pipefail
# Parse DATABASE_URL (env var, else repo-root .env) into libpq variables without printing it.
load_db_env() {
  local root; root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  if [ -z "${DATABASE_URL:-}" ] && [ -f "$root/.env" ]; then
    DATABASE_URL="$(grep -E '^DATABASE_URL=' "$root/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
  fi
  [ -n "${DATABASE_URL:-}" ] || { echo "DATABASE_URL is not set (env or .env)" >&2; exit 2; }
  eval "$(DATABASE_URL="$DATABASE_URL" node -e '
    const u=new URL(process.env.DATABASE_URL); const q=s=>"\x27"+String(s).replace(/\x27/g,"\x27\\\x27\x27")+"\x27";
    console.log("export PGHOST="+q(u.hostname)+" PGPORT="+q(u.port||5432)+" PGUSER="+q(decodeURIComponent(u.username))+" PGPASSWORD="+q(decodeURIComponent(u.password))+" SRC_DB="+q(u.pathname.slice(1)));')"
}
export PATH="/usr/lib/postgresql/15/bin:$PATH"
load_db_env
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
DUMP="$(ls -1t "$BACKUP_DIR"/smart-*.dump 2>/dev/null | head -1 || true)"
[ -n "$DUMP" ] || { echo "[restore-test] no dump found in $BACKUP_DIR" >&2; exit 2; }
SCRATCH="smart_restore_check_$$"
cleanup() { dropdb --if-exists "$SCRATCH" >/dev/null 2>&1 && echo "[restore-test] scratch database $SCRATCH dropped" || true; }
trap cleanup EXIT
echo "[restore-test] dump: $DUMP"
createdb "$SCRATCH"
pg_restore --no-owner --exit-on-error -d "$SCRATCH" "$DUMP"
rc=0
for T in User Product Order; do
  A="$(psql -XAtq -d "$SRC_DB" -c "SELECT count(*) FROM \"$T\"")"
  B="$(psql -XAtq -d "$SCRATCH" -c "SELECT count(*) FROM \"$T\"")"
  if [ "$A" = "$B" ] || { [ "${ALLOW_SOURCE_GROWTH:-0}" = 1 ] && [ "$B" -le "$A" ]; }; then s=OK; else s=MISMATCH; rc=1; fi
  printf '[restore-test] %-8s source=%s restored=%s %s\n' "$T" "$A" "$B" "$s"
done
[ "$rc" = 0 ] && echo "[restore-test] PASS" || echo "[restore-test] FAIL: row counts differ" >&2
exit $rc
