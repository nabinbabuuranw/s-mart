#!/usr/bin/env bash
# S Mart database backup: pg_dump custom format, timestamped, with retention.
# Usage: scripts/backup.sh            (BACKUP_DIR default ./backups, RETENTION_DAYS default 14)
# The password is read from DATABASE_URL / .env and never printed.
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
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"; RETENTION_DAYS="${RETENTION_DAYS:-14}"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
OUT="$BACKUP_DIR/smart-$STAMP.dump"
echo "[backup] dumping database '$SRC_DB' on $PGHOST:$PGPORT -> $OUT"
pg_dump -Fc --no-owner -f "$OUT" "$SRC_DB"
chmod 600 "$OUT"
pg_restore --list "$OUT" >/dev/null || { echo "[backup] FAILED: dump is not readable by pg_restore" >&2; rm -f "$OUT"; exit 1; }
echo "[backup] ok: $(du -h "$OUT" | cut -f1), $(pg_restore --list "$OUT" | grep -c ' TABLE DATA ') tables with data"
echo "[backup] pruning dumps older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -name 'smart-*.dump' -type f -mtime +"$RETENTION_DAYS" -print -delete || true
echo "[backup] done"
