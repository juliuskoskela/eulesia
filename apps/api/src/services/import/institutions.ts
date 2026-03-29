/**
 * Shared Institution & Bot User Helpers
 *
 * Centralizes bot user creation and institution placeholder account management.
 * All import services (ministry, minutes, EU) use these shared helpers.
 *
 * Institution placeholder accounts are created for each data source
 * (ministry, municipality, EU body) so users can follow specific institutions.
 * These accounts are marked with identityProvider='eulesia-bot' and can be
 * "taken over" by the real institution later.
 */

import {
  db,
  users,
  institutionTopics,
  municipalities,
  locations,
} from "../../db/index.js";
import { eq, and, ilike } from "drizzle-orm";

// ============================================
// BOT USER
// ============================================

/**
 * Get or create the system bot user (eulesia-bot).
 * This is the author of all AI-generated threads.
 */
export async function getOrCreateBotUser(): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, "eulesia-bot"))
    .limit(1);

  if (existing.length > 0) {
    // Ensure display name is up to date
    await db
      .update(users)
      .set({ name: "Eulesia Summary" })
      .where(eq(users.id, existing[0].id));
    return existing[0].id;
  }

  const [botUser] = await db
    .insert(users)
    .values({
      username: "eulesia-bot",
      name: "Eulesia Summary",
      email: "bot@eulesia.eu",
      role: "institution",
      institutionType: "agency",
      institutionName: "Eulesia",
      identityVerified: true,
      identityProvider: "system",
      identityLevel: "high",
    })
    .returning({ id: users.id });

  return botUser.id;
}

// ============================================
// INSTITUTION PLACEHOLDER ACCOUNTS
// ============================================

type InstitutionType =
  | "municipality"
  | "ministry"
  | "agency"
  | "county"
  | "region"
  | "state";
type PersistedInstitutionType =
  | "municipality"
  | "ministry"
  | "agency"
  | "organization";

interface InstitutionOptions {
  /** Municipality ID to link to (for municipal institutions) */
  municipalityId?: string;
  /** Municipality name — auto-creates municipality record if municipalityId not provided */
  municipalityName?: string;
  /** Country code — used for location resolution. Default: 'FI' */
  country?: string;
}

/**
 * Slugify a name for use as username.
 * Handles Finnish characters (ä→a, ö→o, å→a) and special chars.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
    .replace(/ü/g, "u")
    .replace(/é/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function normalizeInstitutionType(
  type: InstitutionType,
): PersistedInstitutionType {
  switch (type) {
    case "municipality":
    case "ministry":
    case "agency":
      return type;
    case "county":
    case "region":
    case "state":
      return "organization";
  }
}

/**
 * Get or create an institution placeholder account.
 *
 * These accounts represent real institutions (ministries, municipalities, EU bodies)
 * on the platform. The bot posts on their behalf via sourceInstitutionId.
 *
 * Users can follow these institutions directly. When the real institution
 * joins, they can take over the account (identityProvider changes from
 * 'eulesia-bot' to their actual identity).
 *
 * @param name - Display name of the institution (e.g. "Valtiovarainministeriö")
 * @param type - Institution type: 'ministry', 'municipality', or 'agency'
 * @param options - Additional options (municipalityId, etc.)
 * @returns The institution user ID
 */
export async function getOrCreateInstitution(
  name: string,
  type: InstitutionType,
  options: InstitutionOptions = {},
): Promise<string> {
  // First check by institutionName (canonical lookup)
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "institution"), eq(users.institutionName, name)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  // Resolve municipality ID if municipality name is provided
  let municipalityId = options.municipalityId;
  if (!municipalityId && options.municipalityName && type === "municipality") {
    municipalityId = await getOrCreateMunicipalityRecord(
      options.municipalityName,
      options.country,
    );
  }

  // Generate a unique username
  const slug = slugify(name);
  const username = `inst-${slug}`;

  // Check if username already taken (edge case)
  const usernameExists = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  const finalUsername =
    usernameExists.length > 0
      ? `${username}-${Date.now().toString(36).slice(-4)}`
      : username;

  const [institution] = await db
    .insert(users)
    .values({
      username: finalUsername,
      name,
      institutionName: name,
      role: "institution",
      institutionType: normalizeInstitutionType(type),
      municipalityId,
      identityVerified: false,
      identityProvider: "eulesia-bot",
      identityLevel: "basic",
    })
    .returning({ id: users.id });

  console.log(`  Created institution placeholder: ${name} (@${finalUsername})`);
  return institution.id;
}

/**
 * Get or create a municipality record by name.
 * Now accepts country parameter for multi-country support.
 */
async function getOrCreateMunicipalityRecord(
  name: string,
  country: string = "FI",
): Promise<string> {
  const normalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

  const existing = await db
    .select({ id: municipalities.id })
    .from(municipalities)
    .where(
      and(
        eq(municipalities.name, normalized),
        eq(municipalities.country, country),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const [created] = await db
    .insert(municipalities)
    .values({
      name: normalized,
      nameFi: country === "FI" ? normalized : undefined,
      country,
    })
    .returning({ id: municipalities.id });

  return created.id;
}

// ============================================
// LOCATION RESOLUTION
// ============================================

/**
 * Resolve a location (with coordinates) for an entity.
 * Looks up in locations table first, then tries Nominatim.
 * Returns locationId or null if not found.
 *
 * This links content to the map — threads with locationId
 * appear as geographic points.
 *
 * @param entityName - Name of the municipality, county, region, or state
 * @param country - ISO 3166-1 alpha-2 country code. Default: 'FI'
 */
export async function resolveLocationForEntity(
  entityName: string,
  country: string = "FI",
): Promise<string | null> {
  const normalized =
    entityName.charAt(0).toUpperCase() + entityName.slice(1).toLowerCase();

  // Check if location already exists in DB
  const [existing] = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(ilike(locations.name, normalized), eq(locations.country, country)),
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  // Try Nominatim to create location
  try {
    const { searchNominatim } = await import("../nominatim.js");
    const results = await searchNominatim(normalized, {
      country,
      featuretype: "city",
      limit: 1,
    });

    if (results.length > 0) {
      const { activateLocation } = await import("../locations.js");
      const osmType =
        results[0].osm_type === "relation"
          ? "relation"
          : results[0].osm_type === "way"
            ? "way"
            : "node";
      const location = await activateLocation(
        osmType as "node" | "way" | "relation",
        results[0].osm_id,
      );
      console.log(
        `  Resolved location for ${normalized} (${country}): ${location.name} (${location.latitude}, ${location.longitude})`,
      );
      return location.id;
    }
  } catch (err) {
    // Nominatim unavailable — not critical, location can be resolved later
    console.log(
      `  Could not resolve location for ${normalized} (${country}): ${err instanceof Error ? err.message : err}`,
    );
  }

  return null;
}

/** @deprecated Use resolveLocationForEntity instead */
export const resolveLocationForMunicipality = resolveLocationForEntity;

// ============================================
// TOPIC TAG HELPERS
// ============================================

/**
 * Get the topic tag associated with an institution.
 */
export async function getInstitutionTopicTag(
  institutionId: string,
): Promise<string | null> {
  const [topic] = await db
    .select({ topicTag: institutionTopics.topicTag })
    .from(institutionTopics)
    .where(eq(institutionTopics.institutionId, institutionId))
    .limit(1);

  return topic?.topicTag || null;
}
