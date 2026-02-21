# Eulesia Deployment Guide

## Overview

Eulesia uses a simple CI/CD pipeline:

1. Push to `main` branch
2. GitHub Actions connects to server via SSH
3. Server pulls code and rebuilds Docker containers

## Server Details

- **Provider:** Hetzner
- **IP:** 95.216.206.136
- **SSH alias:** `palvelin`
- **Path:** `/root/eulesia`
- **OS:** Ubuntu + Docker

## Architecture

```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│  Traefik (reverse proxy + SSL)          │
│  - Port 80 → redirect to 443            │
│  - Port 443 → TLS termination           │
│  - Auto SSL via Let's Encrypt           │
└─────────────────────────────────────────┘
    │                    │
    ▼                    ▼
┌──────────────┐  ┌──────────────────────┐
│  Web (nginx) │  │  API (Node.js)       │
│  eulesia.eu  │  │  api.eulesia.eu      │
│  Port 80     │  │  Port 3001           │
└──────────────┘  └──────────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │  PostgreSQL  │
                  │  Port 5432   │
                  └──────────────┘
```

## First-Time Server Setup

### 1. SSH to Server

```bash
ssh palvelin
# or
ssh root@95.216.206.136
```

### 2. Create SSH Keys for GitHub

```bash
# Deploy key (server → GitHub for git pull)
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy_eulesia -N '' -C 'eulesia-deploy'

# Show public key to add to GitHub
cat ~/.ssh/github_deploy_eulesia.pub
```

Add to GitHub: Repository → Settings → Deploy keys → Add deploy key

- Title: `Hetzner deploy`
- Key: (paste public key)
- Allow write access: No

### 3. Configure SSH for GitHub

```bash
cat >> ~/.ssh/config << 'EOF'

Host github.com-eulesia
    HostName github.com
    User git
    IdentityFile ~/.ssh/github_deploy_eulesia
    IdentitiesOnly yes
EOF
```

### 4. Clone Repository

```bash
cd /root
git clone git@github.com-eulesia:markussjoberg/eulesia.git
cd eulesia
git config --global --add safe.directory /root/eulesia
```

### 5. Create Production Environment

```bash
cd docker
cp .env.example .env
nano .env  # Fill in production values
```

Required values:

- `DOMAIN=eulesia.eu`
- `ACME_EMAIL=admin@eulesia.eu`
- `DB_PASSWORD=<secure-password>`
- `SESSION_SECRET=<32-char-random-string>`
- `RESEND_API_KEY=<your-resend-key>` (or leave empty for beta)

Generate secrets:

```bash
# Generate session secret
openssl rand -base64 32

# Generate database password
openssl rand -base64 24
```

### 6. Start Services

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 7. Initialize Database

```bash
# Run migrations
docker exec eulesia-api npm run db:push

# Seed initial data (optional)
docker exec eulesia-api npm run seed

# Create admin invite codes
docker exec eulesia-api npm run create-invites -- 10
```

## GitHub Actions Setup

### Required Secrets

Go to GitHub Repository → Settings → Secrets and variables → Actions

| Secret           | Value                          |
| ---------------- | ------------------------------ |
| `SERVER_HOST`    | `95.216.206.136`               |
| `SERVER_USER`    | `root`                         |
| `SERVER_SSH_KEY` | Base64-encoded SSH private key |

### Get SSH Key for Actions

On the server, the `github_actions` key should already exist:

```bash
ssh palvelin "base64 -w 0 ~/.ssh/github_actions"
```

Copy the output to GitHub as `SERVER_SSH_KEY`.

## Manual Deployment

If you need to deploy manually:

```bash
ssh palvelin "cd /root/eulesia && git fetch origin && git reset --hard origin/main && cd docker && docker compose -f docker-compose.prod.yml up -d --build"
```

## Useful Commands

```bash
# View running containers
ssh palvelin "docker ps"

# View API logs
ssh palvelin "docker logs eulesia-api --tail 50 -f"

# View all logs
ssh palvelin "cd /root/eulesia/docker && docker compose -f docker-compose.prod.yml logs -f"

# Restart services
ssh palvelin "cd /root/eulesia/docker && docker compose -f docker-compose.prod.yml restart"

# Database backup
ssh palvelin "docker exec eulesia-db pg_dump -U eulesia eulesia > /root/backups/eulesia-$(date +%Y%m%d).sql"

# Run database migrations
ssh palvelin "docker exec eulesia-api npm run db:push"

# Create invite codes
ssh palvelin "docker exec eulesia-api npm run create-invites -- 10"
```

## DNS Configuration

Set up these DNS records:

| Type | Name           | Value          |
| ---- | -------------- | -------------- |
| A    | eulesia.eu     | 95.216.206.136 |
| A    | api.eulesia.eu | 95.216.206.136 |

## SSL Certificates

Traefik handles SSL automatically via Let's Encrypt. Certificates are stored in the `letsencrypt` Docker volume.

## Troubleshooting

### Container won't start

```bash
docker logs eulesia-api
docker logs eulesia-web
docker logs eulesia-traefik
```

### Database connection issues

```bash
# Check if DB is running
docker exec eulesia-db pg_isready -U eulesia

# Check connection from API
docker exec eulesia-api node -e "require('postgres')('postgresql://...').query('SELECT 1')"
```

### SSL certificate issues

```bash
# Check Traefik logs
docker logs eulesia-traefik

# Force certificate renewal
docker exec eulesia-traefik traefik --entrypoints.websecure.http.tls.certresolver=letsencrypt
```

### GitHub Actions fails with "Permission denied"

1. Check `SERVER_SSH_KEY` is correct (base64, no whitespace)
2. Verify key is in `authorized_keys` on server
3. Test manually: `ssh -i ~/.ssh/github_actions root@95.216.206.136`

## Rollback

If a deployment breaks something:

```bash
# Tag current working version before deploying
ssh palvelin "docker tag eulesia-api eulesia-api:backup-$(date +%Y%m%d)"
ssh palvelin "docker tag eulesia-web eulesia-web:backup-$(date +%Y%m%d)"

# Rollback
ssh palvelin "docker tag eulesia-api:backup-20260127 eulesia-api:latest"
ssh palvelin "docker tag eulesia-web:backup-20260127 eulesia-web:latest"
ssh palvelin "cd /root/eulesia/docker && docker compose -f docker-compose.prod.yml up -d"
```

## Environment Variables Reference

| Variable         | Description            | Example             |
| ---------------- | ---------------------- | ------------------- |
| `DOMAIN`         | Main domain            | `eulesia.eu`        |
| `ACME_EMAIL`     | Let's Encrypt email    | `admin@eulesia.eu`  |
| `DB_USER`        | PostgreSQL username    | `eulesia`           |
| `DB_PASSWORD`    | PostgreSQL password    | (generate)          |
| `DB_NAME`        | Database name          | `eulesia`           |
| `SESSION_SECRET` | Session encryption key | (generate 32 chars) |
| `RESEND_API_KEY` | Resend API key         | `re_xxx...`         |

---

_Last updated: 2026-01-27_
