#!/bin/sh
# Dump the production database to a compressed file and keep the newest N backups.
#
#   deploy/backup-db.sh [backup-dir]          (default: ./backups, keeps 14)
#   KEEP=30 deploy/backup-db.sh /var/backups/fstracker
#
# Run it from cron on the VPS, e.g. daily at 03:30:
#   30 3 * * * cd /opt/fstracker && deploy/backup-db.sh /var/backups/fstracker
#
# Restore (into an empty database):
#   gunzip -c backups/fstracker-YYYYmmdd-HHMMSS.sql.gz | \
#     docker compose --env-file .env.prod -f compose.prod.yaml exec -T db \
#     sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
set -eu

cd "$(dirname "$0")/.."

DIR="${1:-backups}"
KEEP="${KEEP:-14}"
COMPOSE="docker compose --env-file ${ENV_FILE:-.env.prod} -f compose.prod.yaml"

mkdir -p "$DIR"
FILE="$DIR/fstracker-$(date +%Y%m%d-%H%M%S).sql.gz"

# pg_dump runs inside the db container, using its own credentials.
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip -9 > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
echo "Wrote $FILE ($(du -h "$FILE" | cut -f1))"

# Keep the newest $KEEP backups.
ls -1t "$DIR"/fstracker-*.sql.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | while read -r old; do
    echo "Removing old backup $old"
    rm -- "$old"
done
