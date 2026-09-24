#!/bin/sh
# Nightly database backup with 30-day rotation (NFR-07).
# Restore with: gunzip -c <file> | psql -U "$PGUSER" -d "$PGDATABASE"
set -eu

BACKUP_DIR=${BACKUP_DIR:-/backups}
RETENTION_DAYS=${RETENTION_DAYS:-30}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$BACKUP_DIR/skills-$STAMP.sql.gz"

mkdir -p "$BACKUP_DIR"
pg_dump --no-owner --no-privileges | gzip -9 >"$TARGET"

# Only rotate once the new dump is known good.
if [ -s "$TARGET" ]; then
	find "$BACKUP_DIR" -name 'skills-*.sql.gz' -type f -mtime "+$RETENTION_DAYS" -delete
	echo "backup ok: $TARGET"
else
	echo "backup FAILED: $TARGET is empty" >&2
	rm -f "$TARGET"
	exit 1
fi
