#!/bin/bash

# Eulesia Deployment Script for Hetzner
# ======================================
# This script deploys Eulesia to a Hetzner VPS server

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REMOTE_USER="${DEPLOY_USER:-root}"
REMOTE_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="/opt/eulesia"
BRANCH="${DEPLOY_BRANCH:-main}"

# Check if remote host is set
if [ -z "$REMOTE_HOST" ]; then
  echo -e "${RED}Error: DEPLOY_HOST environment variable is not set${NC}"
  echo "Usage: DEPLOY_HOST=your-server.com ./scripts/deploy.sh"
  exit 1
fi

echo -e "${GREEN}=== Eulesia Deployment ===${NC}"
echo "Deploying to: $REMOTE_USER@$REMOTE_HOST"
echo "Branch: $BRANCH"
echo ""

# Step 1: Connect and pull latest code
echo -e "${YELLOW}Step 1: Updating code on server...${NC}"
ssh "$REMOTE_USER@$REMOTE_HOST" <<EOF
    set -e
    cd $REMOTE_DIR || { echo "Directory not found. Running initial setup..."; exit 1; }
    git fetch origin
    git checkout $BRANCH
    git pull origin $BRANCH
EOF

# Step 2: Build and deploy containers
echo -e "${YELLOW}Step 2: Building and deploying containers...${NC}"
ssh "$REMOTE_USER@$REMOTE_HOST" <<EOF
    set -e
    cd $REMOTE_DIR/docker

    # Ensure .env exists
    if [ ! -f .env ]; then
        echo "Error: .env file not found. Copy .env.example to .env and configure it."
        exit 1
    fi

    # Build and start containers
    docker compose -f docker-compose.prod.yml build --pull
    docker compose -f docker-compose.prod.yml up -d

    # Run database migrations
    echo "Running database migrations..."
    docker compose -f docker-compose.prod.yml exec -T api npm run db:migrate || true

    # Health check
    echo "Checking health..."
    sleep 5
    docker compose -f docker-compose.prod.yml ps
EOF

# Step 3: Cleanup old images
echo -e "${YELLOW}Step 3: Cleaning up old Docker images...${NC}"
ssh "$REMOTE_USER@$REMOTE_HOST" <<EOF
    docker image prune -f
EOF

echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "Your Eulesia instance should now be running at https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  View logs:     ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR/docker && docker compose -f docker-compose.prod.yml logs -f'"
echo "  Restart:       ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR/docker && docker compose -f docker-compose.prod.yml restart'"
echo "  Stop:          ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_DIR/docker && docker compose -f docker-compose.prod.yml down'"
