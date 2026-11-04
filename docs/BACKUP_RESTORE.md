# Backup and restore

Scripts: `scripts/backup.sh` and `scripts/restore-test.sh` (bash, need PostgreSQL client tools 15+ and Node for URL parsing). They read `DATABASE_URL` from the environment or the git-ignored `.env`, never print the password, and write dumps to `BACKUP_DIR` (default `./backups`, mode 700; dumps mode 600).

```
scripts/backup.sh            # RETENTION_DAYS=14 by default
scripts/restore-test.sh      # restores the newest dump into a scratch DB, compares User/Product/Order counts, drops the scratch DB
ALLOW_SOURCE_GROWTH=1 scripts/restore-test.sh   # accept restored <= source when the live DB kept receiving writes
```
Cron (daily 02:30, keep 14 days, then copy off-box):
```
30 2 * * * cd /opt/smart && ./scripts/backup.sh >> backups/backup.log 2>&1
```

## Executed run (real output)
Executed 2026-11-04 13:28:37Z UTC on the authoring box against the dev database `smart_dev` (PostgreSQL 15 on 127.0.0.1:5434; read-only use of the source; scratch database only for the restore). Database name and host are shown, the password is not.

`scripts/backup.sh`
```
[backup] dumping database 'smart_dev' on 127.0.0.1:5434 -> /home/user/tab/files/smart/s-mart/backups/smart-2026-11-04T13-28-37Z.dump
[backup] ok: 76K, 31 tables with data
[backup] pruning dumps older than 14 days
[backup] done
exit=0
```
`scripts/restore-test.sh`
```
[restore-test] dump: /home/user/tab/files/smart/s-mart/backups/smart-2026-11-04T13-28-37Z.dump
[restore-test] User     source=9 restored=9 OK
[restore-test] Product  source=13 restored=13 OK
[restore-test] Order    source=0 restored=0 OK
[restore-test] PASS
[restore-test] scratch database smart_restore_check_1497902 dropped
exit=0
```
Result: backup succeeded and the restore into a scratch database reproduced the same row counts (User 9, Product 13, Order 0) — the dev database holds only DEMO data, and `Order` was empty at that moment, so the Order comparison proves little. The mismatch path (non-zero exit) was written but **not exercised**.

## Limits
- Backups are not encrypted by these scripts (encrypt before copying off-box, for example with `age` or `gpg`).
- A dump on the same disk as the database is not disaster recovery.
- Uploaded images in `UPLOAD_DIR` are not part of the dump; back that directory up separately.

## Restore procedure (production)
1. Stop the API. 2. `createdb smart_new` 3. `pg_restore --no-owner -d smart_new <dump>` 4. Point `DATABASE_URL` at it, run `npx prisma migrate deploy`, start the API, check `/api/v1/health`. 5. Keep the old database until verified.
