/**
 * Multilingual Date Parser
 *
 * Parses date strings from various European formats into Date objects.
 * All dates are normalized to DD.MM.YYYY string format for consistency
 * with the existing Finnish pipeline.
 *
 * Supported formats:
 * - DD.MM.YYYY (Finland, Germany, Norway, Estonia, Denmark, Austria)
 * - YYYY-MM-DD (Sweden, ISO)
 * - DD/MM/YYYY (France, Spain, Italy, Portugal)
 * - DD-MM-YYYY (Netherlands)
 * - "15. januar 2025" (Norwegian/Danish month names)
 * - "15 januari 2025" (Swedish month names)
 * - "15. Januar 2025" (German month names)
 */

// ============================================
// Month Names by Language
// ============================================

const MONTH_NAMES: Record<string, Record<string, number>> = {
  fi: {
    tammikuu: 1,
    helmikuu: 2,
    maaliskuu: 3,
    huhtikuu: 4,
    toukokuu: 5,
    kesäkuu: 6,
    heinäkuu: 7,
    elokuu: 8,
    syyskuu: 9,
    lokakuu: 10,
    marraskuu: 11,
    joulukuu: 12,
    tammi: 1,
    helmi: 2,
    maalis: 3,
    huhti: 4,
    touko: 5,
    kesä: 6,
    heinä: 7,
    elo: 8,
    syys: 9,
    loka: 10,
    marras: 11,
    joulu: 12,
  },
  sv: {
    januari: 1,
    februari: 2,
    mars: 3,
    april: 4,
    maj: 5,
    juni: 6,
    juli: 7,
    augusti: 8,
    september: 9,
    oktober: 10,
    november: 11,
    december: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    okt: 10,
    nov: 11,
    dec: 12,
  },
  no: {
    januar: 1,
    februar: 2,
    mars: 3,
    april: 4,
    mai: 5,
    juni: 6,
    juli: 7,
    august: 8,
    september: 9,
    oktober: 10,
    november: 11,
    desember: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    okt: 10,
    nov: 11,
    des: 12,
  },
  da: {
    januar: 1,
    februar: 2,
    marts: 3,
    april: 4,
    maj: 5,
    juni: 6,
    juli: 7,
    august: 8,
    september: 9,
    oktober: 10,
    november: 11,
    december: 12,
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    okt: 10,
    nov: 11,
    dec: 12,
  },
  et: {
    jaanuar: 1,
    veebruar: 2,
    märts: 3,
    aprill: 4,
    mai: 5,
    juuni: 6,
    juuli: 7,
    august: 8,
    september: 9,
    oktoober: 10,
    november: 11,
    detsember: 12,
  },
  de: {
    januar: 1,
    februar: 2,
    märz: 3,
    april: 4,
    mai: 5,
    juni: 6,
    juli: 7,
    august: 8,
    september: 9,
    oktober: 10,
    november: 11,
    dezember: 12,
    jan: 1,
    feb: 2,
    mär: 3,
    apr: 4,
    jun: 6,
    jul: 7,
    aug: 8,
    sep: 9,
    okt: 10,
    nov: 11,
    dez: 12,
  },
};

// ============================================
// Parse Functions
// ============================================

/**
 * Parse a date string to a Date object.
 * Tries multiple formats based on language.
 */
export function parseDate(dateStr: string, language?: string): Date | null {
  if (!dateStr) return null;
  const cleaned = dateStr.trim();

  // 1. Try numeric formats first (most common)
  const numeric = parseNumericDate(cleaned);
  if (numeric) return numeric;

  // 2. Try month name formats
  if (language) {
    const named = parseNamedDate(cleaned, language);
    if (named) return named;
  }

  // 3. Try all languages as fallback
  for (const lang of Object.keys(MONTH_NAMES)) {
    const named = parseNamedDate(cleaned, lang);
    if (named) return named;
  }

  return null;
}

/**
 * Parse numeric date formats: DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
 */
function parseNumericDate(dateStr: string): Date | null {
  // DD.MM.YYYY (Finland, Germany, etc.)
  let match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (match) {
    return new Date(
      parseInt(match[3]),
      parseInt(match[2]) - 1,
      parseInt(match[1]),
    );
  }

  // YYYY-MM-DD (Sweden, ISO)
  match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return new Date(
      parseInt(match[1]),
      parseInt(match[2]) - 1,
      parseInt(match[3]),
    );
  }

  // DD/MM/YYYY (France, etc.)
  match = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    return new Date(
      parseInt(match[3]),
      parseInt(match[2]) - 1,
      parseInt(match[1]),
    );
  }

  // DD-MM-YYYY (Netherlands)
  match = dateStr.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (match) {
    // Disambiguate from YYYY-MM-DD: if first number > 31, it's year first
    if (parseInt(match[1]) > 31) {
      return new Date(
        parseInt(match[1]),
        parseInt(match[2]) - 1,
        parseInt(match[3]),
      );
    }
    return new Date(
      parseInt(match[3]),
      parseInt(match[2]) - 1,
      parseInt(match[1]),
    );
  }

  return null;
}

/**
 * Parse date with month name: "15. januar 2025", "15 januari 2025", "Januar 15, 2025"
 */
function parseNamedDate(dateStr: string, language: string): Date | null {
  const months = MONTH_NAMES[language];
  if (!months) return null;

  const lower = dateStr.toLowerCase();

  for (const [name, monthNum] of Object.entries(months)) {
    if (!lower.includes(name)) continue;

    // "15. januar 2025" or "15 januari 2025"
    const match1 = lower.match(
      new RegExp(`(\\d{1,2})\\.?\\s*${name}\\.?\\s*(\\d{4})`),
    );
    if (match1) {
      return new Date(parseInt(match1[2]), monthNum - 1, parseInt(match1[1]));
    }

    // "januar 15, 2025" or "Januar 15 2025"
    const match2 = lower.match(
      new RegExp(`${name}\\.?\\s*(\\d{1,2}),?\\s*(\\d{4})`),
    );
    if (match2) {
      return new Date(parseInt(match2[2]), monthNum - 1, parseInt(match2[1]));
    }
  }

  return null;
}

/**
 * Format a date string to the normalized DD.MM.YYYY format.
 * This is the internal format used by the pipeline.
 */
export function normalizeDateString(
  dateStr: string,
  language?: string,
): string | null {
  const date = parseDate(dateStr, language);
  if (!date || isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  return `${day}.${month}.${year}`;
}
