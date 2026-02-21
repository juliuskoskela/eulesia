#!/bin/bash

# Eulesia Database Backup Script
# ==============================
# Creates a timestamped backup of the PostgreSQL database

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/opt/eulesia/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DOCKER_COMPOSE_DIR="/opt/eulesia/docker"

# Load environment
if [ -f "$DOCKER_COMPOSE_DIR/.env" ]; then
  source "$DOCKER_COMPOSE_DIR/.env"
fi

DB_NAME="${DB_NAME:-eulesia}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/eulesia_${TIMESTAMP}.sql.gz"

echo -e "${GREEN}=== Eulesia Database Backup ===${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
echo -e "${YELLOW}Creating backup...${NC}"
docker exec eulesia-db pg_dump -U "$DB_NAME" "$DB_NAME" | gzip >"$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
  echo -e "${GREEN}Backup created: $BACKUP_FILE ($BACKUP_SIZE)${NC}"
else
  echo "Error: Backup failed!"
  exit 1
fi

# Remove old backups
echo -e "${YELLOW}Removing backups older than $RETENTION_DAYS days...${NC}"
find "$BACKUP_DIR" -name "eulesia_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

# List recent backups
echo ""
echo "Recent backups:"
ls -lht "$BACKUP_DIR" | head -5

echo ""
echo -e "${GREEN}Backup complete!${NC}"
