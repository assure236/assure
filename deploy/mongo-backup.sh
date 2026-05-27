#!/bin/bash
BACKUP_DIR=/var/backups/mongodb
DATE=$(date +%Y%m%d_%H%M%S)
LOG=/var/log/mongo-backup.log

echo "[$DATE] Starting MongoDB backup..." >> $LOG

# Get mongo URI from backend .env
MONGO_URI=$(grep '^MONGO_URI=' /var/www/assurechitfunds/backend/.env | cut -d= -f2-)

if [ -z "$MONGO_URI" ]; then
  echo "[$DATE] ERROR: MONGO_URI not found in .env" >> $LOG
  exit 1
fi

# Run mongodump
mongodump --uri="$MONGO_URI" --out="$BACKUP_DIR/backup_$DATE" >> $LOG 2>&1

if [ $? -eq 0 ]; then
  tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" -C $BACKUP_DIR "backup_$DATE" && rm -rf "$BACKUP_DIR/backup_$DATE"
  echo "[$DATE] Backup successful: backup_$DATE.tar.gz" >> $LOG
else
  echo "[$DATE] ERROR: mongodump failed" >> $LOG
  exit 1
fi

# Keep only last 7 days
find $BACKUP_DIR -name '*.tar.gz' -mtime +7 -delete
echo "[$DATE] Cleanup done. Backups:" >> $LOG
ls -lh $BACKUP_DIR >> $LOG
