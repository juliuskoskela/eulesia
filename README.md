# Eulesia

**Civic social media as European digital public infrastructure**

[eulesia.eu](https://eulesia.eu)

Eulesia is an open-source civic platform that combines the social features people expect from modern social media — feeds, messaging, communities — with civic identity and institutional participation. No algorithms, no ads, no attention economy.

> *"The value proposition is not dopamine but efficacy: meaningful participation in decisions that matter."*

## What is Eulesia?

Commercial social media offers **agency without citizenship**: social functionality disconnected from civic structures. Existing civic tech offers **citizenship without agency**: formal participation without social fabric. Eulesia combines both — a digital public space where citizens interact as recognized members of a shared polity.

### Core Features

**Agora** — Public civic discussion with scope-based threads:
- **Local** — municipal issues anchored to administrative areas
- **National** — government decisions, legislation, ministry announcements
- **European** — EU legislation, Commission decisions, Parliament resolutions

AI-powered import of municipal meeting minutes, ministry press releases, and EU documents transforms bureaucratic content into accessible discussion threads.

**Clubs** — Community groups for interest-based civic organization with self-moderation.

**Home** — Personal spaces with public and private rooms for discussion hosting.

**Real-time messaging** — Direct messages and room-based chat with Socket.io.

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Verified Identity** | One-person-one-account via EUDI Wallet integration |
| **Institutional Anchoring** | Discussion spaces tied to administrative entities |
| **Anti-Attention Design** | No engagement metrics, trending, viral amplification, or algorithmic curation |
| **Privacy by Default** | GDPR compliance embedded architecturally |
| **Public Governance** | Operated under democratic accountability |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| API | Node.js, Express, Drizzle ORM |
| Database | PostgreSQL |
| Search | Meilisearch (typo-tolerant, federated) |
| Real-time | Socket.io (session-authenticated) |
| AI | Mistral Large (EU-hosted, GDPR-compliant) |
| Deployment | Docker Compose, Traefik reverse proxy |

## Automated Content Import

Eulesia Bot imports and summarizes official documents using Mistral AI:

| Source | Scope | Schedule |
|--------|-------|----------|
| Municipal meeting minutes (CloudNC, Tweb, Dynasty) | Local | 06:00, 18:00 |
| Valtioneuvosto, Finlex | National | 08:00, 14:00, 20:00 |
| European Commission, EUR-Lex, European Parliament | European | 10:00, 16:00 |

AI-generated summaries are transparent (marked as bot-generated) and link to original sources.

## Development

### Prerequisites
- Node.js 20+
- PostgreSQL 15+
- Meilisearch (optional, for search)

### Setup

```bash
# Install dependencies
npm install
cd apps/api && npm install

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your database and API settings

# Run database migrations
cd apps/api && npm run db:push

# Start development servers
cd apps/api && npm run dev   # API (port 3001)
npm run dev                  # Frontend (port 5173)
```

### Building
```bash
npm run build                   # Frontend
cd apps/api && npm run build    # API
```

## Authentication

| Method | Status |
|--------|--------|
| Invite Code + Password | Production |
| EUDI Wallet (PID) | Planned |

## Documentation

- [Home System](./docs/home-system.md) — Personal spaces and rooms
- [EUDI Wallet Integration](./docs/eudi-wallet-integration.md) — European Digital Identity
- [Geospatial Integration](./docs/geospatial-integration.md) — Location-based features
- [API Reference](./docs/api-reference.md) — API endpoints
- [Database Schema](./docs/database-schema.md) — Data models
- [Deployment](./docs/deployment.md) — Production deployment

## Academic Reference

Sjöberg, M. (2026). "Reclaiming the Digital Agora: A Design Science Approach to Identity-Based Civic Infrastructure Beyond the Attention Economy." MIPRO 2026, Tampere University/ITC.

## License

Licensed under the [European Union Public License v1.2](./LICENSE) (EUPL-1.2).

The EUPL is the European Commission's open-source license, designed for European public-sector software. It is compatible with GPL, LGPL, AGPL, MPL, and other major open-source licenses.
