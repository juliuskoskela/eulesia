# Ministry & EU Bot - Kontekstidokumentti

## Projektin yleiskuvaus

**Eulesia** on eurooppalainen kansalaisfoorumi (civic digital infrastructure). Agora-osio on julkinen keskustelualue, jossa threadit voivat olla:

- `local` - paikallisia (kuntakohtaisia)
- `national` - valtakunnallisia
- `european` - EU-tason

**Ongelma:** National ja EU-scopet ovat tyhjiä - tarvitaan automaattista sisältöä.

**Ratkaisu:** Eulesia Bot importoi ja tiivistää virallisia asiakirjoja ministeriöiltä ja EU-instituutioilta.

---

## Olemassa oleva arkkitehtuuri

### Minutes Import (malli uusille importereille)

Kuntien pöytäkirjojen import on jo toteutettu:

```
apps/api/src/services/import/
├── minutes.ts      # Päälogiikka: haku, PDF-parsinta, thread-luonti
└── mistral.ts      # AI-tiivistys Mistral Large:lla
```

**Scheduler** (`apps/api/src/services/scheduler.ts`):

- Ajaa importin 06:00 ja 18:00 (Europe/Helsinki)
- Production-only (ei devissä)

### Keskeiset rakenteet minutes.ts:stä

```typescript
// Lähteen konfiguraatio
interface MinuteSource {
  municipality: string;
  type: "cloudnc" | "tweb" | "dynasty" | "pdf";
  url: string;
}

// Import-optiot
interface ImportOptions {
  municipalities?: string[];
  dryRun?: boolean;
  limit?: number;
}

// Tulos
interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
  threads: { id: string; title: string; municipality: string }[];
}

// Bot-käyttäjä (eulesia-bot)
async function getOrCreateBotUser(): Promise<string>;

// Deduplikointi sourceId:llä
async function isAlreadyImported(sourceId: string): Promise<boolean>;
```

### Thread-skeema (oleelliset kentät)

```typescript
// apps/api/src/db/schema.ts - threads taulu
{
  scope: 'local' | 'national' | 'european',
  source: string,           // 'minutes_import', 'ministry_import', 'eu_import'
  sourceUrl: string,        // Alkuperäinen URL
  sourceId: string,         // Uniikki ID deduplikointiin
  aiGenerated: boolean,
  aiModel: string,
  originalContent: text,    // Alkuperäinen teksti
  institutionalContext: jsonb  // Metadata (type, organ, importedAt, etc.)
}
```

### Mistral AI -integraatio

```typescript
// apps/api/src/services/import/mistral.ts
interface SummaryResult {
  title: string;
  summary: string;
  tags: string[];
  keyPoints: string[];
  discussionPrompt: string;
}

async function generateMinutesSummary(
  originalText: string,
  municipalityName: string,
  meetingType?: string,
): Promise<SummaryResult>;
```

---

## Suunniteltava: Ministry & EU Import

### Sisältölähteet

#### Suomen ministeriöt (national scope)

| Lähde          | URL                                         | Tyyppi                   |
| -------------- | ------------------------------------------- | ------------------------ |
| Valtioneuvosto | https://valtioneuvosto.fi/tiedotteet (RSS?) | Tiedotteet               |
| Eduskunta      | https://www.eduskunta.fi/FI/tiedotteet      | Lakialoitteet, päätökset |
| Finlex         | https://finlex.fi/fi/uutiset/rss/           | Uudet lait               |

#### EU-instituutiot (european scope)

| Lähde               | URL                                         | Tyyppi          |
| ------------------- | ------------------------------------------- | --------------- |
| EUR-Lex             | https://eur-lex.europa.eu/rss               | EU-lainsäädäntö |
| European Commission | https://ec.europa.eu/commission/presscorner | Tiedotteet      |
| European Parliament | https://www.europarl.europa.eu/rss          | Päätöslauselmat |

### Toteutusrakenne

```
apps/api/src/services/import/
├── minutes.ts         # ✅ Olemassa
├── mistral.ts         # ✅ Olemassa
├── ministry.ts        # 🆕 Ministeriöimport
├── eu.ts              # 🆕 EU-import
└── feeds.ts           # 🆕 RSS/Atom-parseri (yhteinen)
```

### Ministry Import -suunnitelma

```typescript
// apps/api/src/services/import/ministry.ts

interface MinistrySource {
  name: string; // 'Valtioneuvosto', 'Eduskunta', 'Finlex'
  feedUrl: string; // RSS/Atom URL
  contentType: "press" | "law" | "decision";
  language: "fi" | "sv" | "en";
}

const MINISTRY_SOURCES: MinistrySource[] = [
  {
    name: "Valtioneuvosto",
    feedUrl: "https://valtioneuvosto.fi/rss/tiedotteet",
    contentType: "press",
    language: "fi",
  },
  // ...
];

export async function importMinistryContent(
  options?: ImportOptions,
): Promise<ImportResult>;
```

### EU Import -suunnitelma

```typescript
// apps/api/src/services/import/eu.ts

interface EuSource {
  institution: string; // 'commission', 'parliament', 'council', 'eur-lex'
  feedUrl: string;
  contentType: "press" | "legislation" | "resolution";
  language: "en" | "fi"; // Suomeksi jos saatavilla
}

const EU_SOURCES: EuSource[] = [
  {
    institution: "European Commission",
    feedUrl: "https://ec.europa.eu/commission/presscorner/api/rss",
    contentType: "press",
    language: "en",
  },
  // ...
];

export async function importEuContent(
  options?: ImportOptions,
): Promise<ImportResult>;
```

### Scheduler-päivitys

```typescript
// apps/api/src/services/scheduler.ts

import { importMinutes } from "./import/minutes.js";
import { importMinistryContent } from "./import/ministry.js";
import { importEuContent } from "./import/eu.js";

export function initScheduler(): void {
  // Minutes: 06:00, 18:00
  cron.schedule("0 6,18 * * *", runMinutesImport);

  // Ministry: 08:00, 14:00, 20:00
  cron.schedule("0 8,14,20 * * *", runMinistryImport);

  // EU: 10:00, 16:00
  cron.schedule("0 10,16 * * *", runEuImport);
}
```

### AI-promptit

**Ministry-summary (suomeksi):**

```
Olet kansalaisfoorumin avustaja. Tiivistä ministeriön tiedote ymmärrettävään muotoon.

- Kerro mitä päätettiin/tiedotetaan ja miksi se vaikuttaa kansalaisiin
- Vältä kapulakieltä
- Ole neutraali
- Nosta esiin tärkeimmät kohdat

Vastaa JSON: { title, summary, tags, keyPoints, discussionPrompt }
```

**EU-summary (englanniksi → suomeksi):**

```
You are a civic forum assistant. Summarize this EU document for Finnish citizens.

- Explain what was decided and how it affects EU citizens
- Write the summary in Finnish
- Be neutral and factual
- Highlight key points

Respond in JSON: { title, summary, tags, keyPoints, discussionPrompt }
```

---

## Tiedostopolut

### Backend

- `apps/api/src/services/scheduler.ts` - Scheduler
- `apps/api/src/services/import/minutes.ts` - Minutes import (malli)
- `apps/api/src/services/import/mistral.ts` - AI-tiivistys
- `apps/api/src/db/schema.ts` - Tietokantaskeema
- `apps/api/src/routes/agora.ts` - Agora API routes

### Frontend

- `src/pages/AgoraPage.tsx` - Agora-sivu
- `src/components/agora/ThreadCard.tsx` - Thread-kortti
- `src/components/agora/FeedFilters.tsx` - Scope-filtterit

---

## Env-muuttujat

```bash
# .env (API)
MISTRAL_API_KEY=xxx    # AI-tiivistykseen
NODE_ENV=production    # Scheduler vain tuotannossa
```

---

## Seuraavat vaiheet

1. **Tutki RSS-feedit** - Tarkista toimivat URL:t vn.fi, eduskunta.fi, EUR-Lex
2. **Luo feeds.ts** - Yhteinen RSS/Atom-parseri
3. **Luo ministry.ts** - Ministeriöimport
4. **Luo eu.ts** - EU-import
5. **Päivitä scheduler.ts** - Lisää uudet importit
6. **Testaa** - Dry-run importit, tarkista thread-luonti

---

_Luotu: 2026-02-06_
