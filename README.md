# Eulesia

European open civic digital infrastructure for democratic participation and community engagement.

## Overview

Eulesia is a social platform designed to strengthen democratic participation across Europe. It provides tools for civic discourse, community building, and direct engagement between citizens and institutions.

**Key principles:**
- European digital sovereignty (no reliance on US service providers)
- Open source
- Privacy-first design
- Democratic participation

## Architecture

The platform consists of:
- **Frontend**: React + TypeScript + Vite
- **API**: Node.js + Express + Drizzle ORM
- **Database**: PostgreSQL
- **Real-time**: Socket.io

## Main Features

### Agora
Public discussion forum with scope-based threads (municipal, regional, national). Citizens and institutions can start and participate in discussions on civic topics.

### Clubs
Community groups for interest-based discussions. Users can create clubs, set rules, and moderate content.

### Home
Personal space for each user, functioning as a combination of a personal blog and mini-forum. Users can:
- Create public rooms (open to all visitors)
- Create private rooms (invite-only)
- Host discussions on various topics
- Invite specific users to participate

See [docs/home-system.md](./docs/home-system.md) for detailed documentation.

## Development

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- pnpm (recommended) or npm

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd apps/api && npm install
   ```

3. Set up environment variables:
   ```bash
   cp apps/api/.env.example apps/api/.env
   # Edit .env with your database and SMTP settings
   ```

4. Run database migrations:
   ```bash
   cd apps/api && npm run db:push
   ```

5. Start development servers:
   ```bash
   # Terminal 1: API
   cd apps/api && npm run dev

   # Terminal 2: Frontend
   npm run dev
   ```

### Testing
```bash
npm run test
```

### Building
```bash
# Frontend
npm run build

# API
cd apps/api && npm run build
```

## Configuration

### Email (SMTP)
Eulesia uses SMTP for sending emails (magic links, notifications). Configure in `.env`:

```env
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.your-provider.eu
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@your-domain.eu
SMTP_PASS=your-password
EMAIL_FROM=Eulesia <noreply@your-domain.eu>
```

Use any European SMTP provider (e.g., Scaleway, mailbox.org, Postmark EU).

## Authentication

Eulesia supports multiple authentication methods:

| Method | Identity Level | Status |
|--------|---------------|--------|
| Email Magic Link | Basic | Production |
| EUDI Wallet (PID) | High | Testing |

### EUDI Wallet Integration

Eulesia is implementing support for the European Digital Identity (EUDI) Wallet, enabling strong identity verification across all EU member states. This uses OpenID4VP for verifiable presentations of PID (Personal Identification Data) credentials.

See [docs/eudi-wallet-integration.md](./docs/eudi-wallet-integration.md) for implementation details.

## Documentation

- [Home System](./docs/home-system.md) - Personal spaces and rooms
- [EUDI Wallet Integration](./docs/eudi-wallet-integration.md) - European Digital Identity
- [API Reference](./docs/api-reference.md) - API endpoints
- [Database Schema](./docs/database-schema.md) - Data models

## License

Open source under European principles of digital sovereignty.
