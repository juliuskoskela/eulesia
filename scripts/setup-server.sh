#!/bin/bash

# Eulesia Server Setup Script for Hetzner
# ========================================
# Run this once on a fresh Ubuntu 22.04+ server

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Eulesia Server Setup ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root${NC}"
    exit 1
fi

# Configuration
INSTALL_DIR="/opt/eulesia"
REPO_URL="${REPO_URL:-https://github.com/markussjoberg/eulesia.git}"

# Step 1: Update system
echo -e "${YELLOW}Step 1: Updating system...${NC}"
apt update && apt upgrade -y

# Step 2: Install Docker
echo -e "${YELLOW}Step 2: Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    echo "Docker already installed"
fi

# Step 3: Install Docker Compose plugin
echo -e "${YELLOW}Step 3: Installing Docker Compose...${NC}"
if ! docker compose version &> /dev/null; then
    apt install -y docker-compose-plugin
else
    echo "Docker Compose already installed"
fi

# Step 4: Install Git
echo -e "${YELLOW}Step 4: Installing Git...${NC}"
apt install -y git

# Step 5: Clone repository
echo -e "${YELLOW}Step 5: Cloning Eulesia repository...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo "Directory already exists. Pulling latest..."
    cd "$INSTALL_DIR"
    git pull
else
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

# Step 6: Setup environment file
echo -e "${YELLOW}Step 6: Setting up environment...${NC}"
cd "$INSTALL_DIR/docker"
if [ ! -f .env ]; then
    cp .env.example .env
    echo -e "${RED}IMPORTANT: Edit $INSTALL_DIR/docker/.env with your configuration!${NC}"
else
    echo ".env already exists"
fi

# Step 7: Configure firewall
echo -e "${YELLOW}Step 7: Configuring firewall...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp    # SSH
    ufw allow 80/tcp    # HTTP
    ufw allow 443/tcp   # HTTPS
    ufw --force enable
else
    echo "UFW not installed, skipping firewall setup"
fi

# Step 8: Create systemd service
echo -e "${YELLOW}Step 8: Creating systemd service...${NC}"
cat > /etc/systemd/system/eulesia.service << EOF
[Unit]
Description=Eulesia Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR/docker
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable eulesia

echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit the environment file:"
echo "   nano $INSTALL_DIR/docker/.env"
echo ""
echo "2. Configure your domain's DNS to point to this server"
echo ""
echo "3. Start Eulesia:"
echo "   systemctl start eulesia"
echo ""
echo "4. View logs:"
echo "   cd $INSTALL_DIR/docker && docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo -e "${GREEN}Server IP: $(curl -s ifconfig.me)${NC}"
