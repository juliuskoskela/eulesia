# Eulesia

**Reclaiming the Digital Agora: Civic Social Media as European Digital Public Infrastructure**

Eulesia is an open-source civic digital infrastructure designed to strengthen democratic participation across Europe. It provides a platform with the social features users expect from contemporary social media — feeds, messaging, communities, discussions — but anchored to civic identity and institutional presence.

> *"The value proposition is not dopamine but efficacy: meaningful participation in decisions that matter."*

## Why Eulesia?

Contemporary civic interaction has been outsourced to commercial social media platforms optimized for attention and advertising rather than democratic deliberation. Public institutions rely on these privately governed environments for citizen engagement, effectively ceding portions of the digital public sphere to platforms whose incentive structures are misaligned with civic values.

Commercial social media offers **agency without citizenship**: rich social functionality disconnected from institutional structures and civic identity. Existing civic technology offers **citizenship without agency**: structured participation without social fabric for self-organization. Eulesia combines both — civic social media where citizens interact as recognized members of a shared polity.

## Design Principles

| Principle | Description |
|-----------|-------------|
| **Verified Identity** | One-person-one-account via EUDI Wallet integration, reducing coordinated inauthentic behavior |
| **Institutional Anchoring** | Discussion spaces structurally tied to administrative entities; institutions participate as civic actors |
| **Social Agency** | Citizens interact directly, not mediated through institutional processes |
| **Anti-Attention Design** | No engagement metrics, trending sections, viral amplification, or algorithmic curation |
| **Public Governance** | Operated under democratic accountability, not private corporate control |
| **User-Centric Data** | Privacy by default, GDPR compliance embedded architecturally |

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **API**: Node.js + Express + Drizzle ORM
- **Database**: PostgreSQL
- **Search**: Meilisearch (typo-tolerant, federated)
- **Real-time**: Socket.io
- **AI**: Mistral Large (EU-based, GDPR-compliant) for content summarization

## Main Features

### Agora
Public civic discussion forum with scope-based threads:
- **Local** — municipal issues, anchored to administrative areas
- **National** — government decisions, legislation, ministry announcements
- **European** — EU legislation, Commission decisions, Parliament resolutions

AI-powered automated import of municipal meeting minutes, ministry press releases, and EU documents transforms bureaucratic content into accessible discussion threads.

### Clubs
Community groups for interest-based civic organization. Citizens can self-organize around topics, set community rules, and moderate content — enabling civic engagement outside official institutional channels.

### Home
Personal spaces functioning as a combination of personal blog and mini-forum:
- Public rooms (open to all visitors)
- Private rooms (invite-only)
- Discussion hosting on various topics

See [docs/home-system.md](./docs/home-system.md) for details.

## Automated Content Import

Eulesia Bot imports and summarizes official documents using Mistral Large AI:

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
- npm

### Setup

```bash
# Install dependencies
npm install
cd apps/api && npm install

# Configure environment
cp apps/api/.env.example apps/api/.env
# Edit .env with your database, SMTP, and Mistral API settings

# Run database migrations
cd apps/api && npm run db:push

# Start development servers
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
npm run build              # Frontend
cd apps/api && npm run build  # API
```

## Authentication

| Method | Identity Level | Status |
|--------|---------------|--------|
| Invite Code + Password | Basic | Production |
| Email Magic Link | Basic | Production |
| EUDI Wallet (PID) | High | Planned |

See [docs/eudi-wallet-integration.md](./docs/eudi-wallet-integration.md) for EUDI details.

## Configuration

### Email (SMTP)
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=mail.your-provider.eu
SMTP_PORT=587
SMTP_USER=noreply@your-domain.eu
SMTP_PASS=your-password
EMAIL_FROM=Eulesia <noreply@your-domain.eu>
```

### AI Content Import
```env
MISTRAL_API_KEY=your-key   # Required for automated content import
```

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

Open source under European principles of digital sovereignty.
