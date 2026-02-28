/**
 * Administrative Entity Data — Higher Governance Levels
 *
 * Complements municipality-data.ts with county, regional, and state-level entities.
 * These are the bodies that make decisions ABOVE the municipal level:
 *
 * FI: 19 maakuntaliittoa (regional councils)
 * SE: 21 regioner (regions — healthcare, transport, regional development)
 * NO: 15 fylkeskommuner (county municipalities — post-2024 reform)
 * DK: 5 regioner (regions — hospitals, healthcare)
 * DE: 16 Bundesländer (federal states — education, police, justice, healthcare)
 *
 * Total: 76 entities
 */

import type { AdminEntity } from './admin-entities.js'

// =============================================================================
// FINLAND — 19 maakuntaliittoa (regional councils)
// =============================================================================
// Finnish regional councils are joint municipal authorities (kuntayhtymä) that
// handle regional planning, land use, EU structural funds, and regional transport.
// Slug: lowercase, ä→a, ö→o, hyphens removed — matches their website domains.
// URL pattern: https://{slug}.fi/ or https://www.{slug}liitto.fi/
// =============================================================================

export const FI_ADMIN_ENTITIES: AdminEntity[] = [
  { name: 'Uudenmaan liitto', slug: 'uusimaa', adminLevel: 'region', population: 1727000, subdivisionCode: 'FI-18' },
  { name: 'Varsinais-Suomen liitto', slug: 'varsinais-suomi', adminLevel: 'region', population: 481000, subdivisionCode: 'FI-19' },
  { name: 'Satakuntaliitto', slug: 'satakunta', adminLevel: 'region', population: 213000, subdivisionCode: 'FI-17' },
  { name: 'Kanta-Hämeen liitto', slug: 'hame', adminLevel: 'region', population: 171000, subdivisionCode: 'FI-05' },
  { name: 'Pirkanmaan liitto', slug: 'pirkanmaa', adminLevel: 'region', population: 525000, subdivisionCode: 'FI-11' },
  { name: 'Päijät-Hämeen liitto', slug: 'paijat-hame', adminLevel: 'region', population: 199000, subdivisionCode: 'FI-16' },
  { name: 'Kymenlaakson liitto', slug: 'kymenlaakso', adminLevel: 'region', population: 164000, subdivisionCode: 'FI-08' },
  { name: 'Etelä-Karjalan liitto', slug: 'etela-karjala', adminLevel: 'region', population: 127000, subdivisionCode: 'FI-02' },
  { name: 'Etelä-Savon maakuntaliitto', slug: 'esavo', adminLevel: 'region', population: 132000, subdivisionCode: 'FI-03' },
  { name: 'Pohjois-Savon liitto', slug: 'pohjois-savo', adminLevel: 'region', population: 241000, subdivisionCode: 'FI-15' },
  { name: 'Pohjois-Karjalan maakuntaliitto', slug: 'pohjois-karjala', adminLevel: 'region', population: 159000, subdivisionCode: 'FI-13' },
  { name: 'Keski-Suomen liitto', slug: 'keskisuomi', adminLevel: 'region', population: 275000, subdivisionCode: 'FI-07' },
  { name: 'Etelä-Pohjanmaan liitto', slug: 'etela-pohjanmaa', adminLevel: 'region', population: 190000, subdivisionCode: 'FI-03' },
  { name: 'Pohjanmaan liitto', slug: 'obotnia', adminLevel: 'region', population: 181000, subdivisionCode: 'FI-12' },
  { name: 'Keski-Pohjanmaan liitto', slug: 'keski-pohjanmaa', adminLevel: 'region', population: 68000, subdivisionCode: 'FI-07' },
  { name: 'Pohjois-Pohjanmaan liitto', slug: 'pohjois-pohjanmaa', adminLevel: 'region', population: 416000, subdivisionCode: 'FI-14' },
  { name: 'Kainuun liitto', slug: 'kainuu', adminLevel: 'region', population: 71000, subdivisionCode: 'FI-05' },
  { name: 'Lapin liitto', slug: 'lapinliitto', adminLevel: 'region', population: 177000, subdivisionCode: 'FI-10' },
  { name: 'Ålands landskapsregering', slug: 'regeringen.ax', adminLevel: 'region', population: 30000, subdivisionCode: 'FI-01' },
]

// =============================================================================
// SWEDEN — 21 regioner
// =============================================================================
// Swedish regions (previously landsting) are responsible for healthcare, public
// transport, regional development, and culture. They have elected assemblies
// (regionfullmäktige) that publish meeting protocols.
// Slug: lowercase, å→a, ö→o, ä→a — matches their website domains.
// URL pattern: https://www.{slug}.se/ (region sites)
// =============================================================================

export const SE_ADMIN_ENTITIES: AdminEntity[] = [
  { name: 'Region Stockholm', slug: 'regionstockholm', adminLevel: 'region', population: 2440000, subdivisionCode: 'SE-AB' },
  { name: 'Region Uppsala', slug: 'regionuppsala', adminLevel: 'region', population: 395000, subdivisionCode: 'SE-C' },
  { name: 'Region Sörmland', slug: 'regionsormland', adminLevel: 'region', population: 300000, subdivisionCode: 'SE-D' },
  { name: 'Region Östergötland', slug: 'regionostergotland', adminLevel: 'region', population: 470000, subdivisionCode: 'SE-E' },
  { name: 'Region Jönköpings län', slug: 'rjl', adminLevel: 'region', population: 365000, subdivisionCode: 'SE-F' },
  { name: 'Region Kronoberg', slug: 'regionkronoberg', adminLevel: 'region', population: 203000, subdivisionCode: 'SE-G' },
  { name: 'Region Kalmar län', slug: 'regionkalmar', adminLevel: 'region', population: 245000, subdivisionCode: 'SE-H' },
  { name: 'Region Gotland', slug: 'gotland', adminLevel: 'region', population: 61000, subdivisionCode: 'SE-I' },
  { name: 'Region Blekinge', slug: 'regionblekinge', adminLevel: 'region', population: 159000, subdivisionCode: 'SE-K' },
  { name: 'Region Skåne', slug: 'skane', adminLevel: 'region', population: 1420000, subdivisionCode: 'SE-M' },
  { name: 'Region Halland', slug: 'regionhalland', adminLevel: 'region', population: 340000, subdivisionCode: 'SE-N' },
  { name: 'Västra Götalandsregionen', slug: 'vgregion', adminLevel: 'region', population: 1750000, subdivisionCode: 'SE-O' },
  { name: 'Region Värmland', slug: 'regionvarmland', adminLevel: 'region', population: 283000, subdivisionCode: 'SE-S' },
  { name: 'Region Örebro län', slug: 'regionorebrolan', adminLevel: 'region', population: 307000, subdivisionCode: 'SE-T' },
  { name: 'Region Västmanland', slug: 'regionvastmanland', adminLevel: 'region', population: 278000, subdivisionCode: 'SE-U' },
  { name: 'Region Dalarna', slug: 'regiondalarna', adminLevel: 'region', population: 288000, subdivisionCode: 'SE-W' },
  { name: 'Region Gävleborg', slug: 'regiongavleborg', adminLevel: 'region', population: 287000, subdivisionCode: 'SE-X' },
  { name: 'Region Västernorrland', slug: 'rvn', adminLevel: 'region', population: 244000, subdivisionCode: 'SE-Y' },
  { name: 'Region Jämtland Härjedalen', slug: 'regionjh', adminLevel: 'region', population: 132000, subdivisionCode: 'SE-Z' },
  { name: 'Region Västerbotten', slug: 'regionvasterbotten', adminLevel: 'region', population: 274000, subdivisionCode: 'SE-AC' },
  { name: 'Region Norrbotten', slug: 'regionnorrbotten', adminLevel: 'region', population: 250000, subdivisionCode: 'SE-BD' },
]

// =============================================================================
// NORWAY — 15 fylkeskommuner (county municipalities, post-2024 reform)
// =============================================================================
// Norwegian county municipalities handle upper secondary education, county roads,
// public transport, dental care, and cultural heritage. They have elected
// assemblies (fylkesting) that publish meeting protocols.
// Note: Oslo is both a kommune and fylkeskommune (combined).
// Slug: lowercase, ø→o, å→a, æ→ae
// URL pattern: https://www.{slug}.no/ (fylkeskommune sites)
// =============================================================================

export const NO_ADMIN_ENTITIES: AdminEntity[] = [
  { name: 'Oslo kommune (fylke)', slug: 'oslo', adminLevel: 'county', population: 709000, subdivisionCode: 'NO-03' },
  { name: 'Akershus fylkeskommune', slug: 'akershus', adminLevel: 'county', population: 725000, subdivisionCode: 'NO-32' },
  { name: 'Østfold fylkeskommune', slug: 'ostfold', adminLevel: 'county', population: 315000, subdivisionCode: 'NO-31' },
  { name: 'Buskerud fylkeskommune', slug: 'buskerud', adminLevel: 'county', population: 295000, subdivisionCode: 'NO-33' },
  { name: 'Vestfold fylkeskommune', slug: 'vestfold', adminLevel: 'county', population: 252000, subdivisionCode: 'NO-39' },
  { name: 'Telemark fylkeskommune', slug: 'telemark', adminLevel: 'county', population: 175000, subdivisionCode: 'NO-40' },
  { name: 'Innlandet fylkeskommune', slug: 'innlandetfylke', adminLevel: 'county', population: 371000, subdivisionCode: 'NO-34' },
  { name: 'Agder fylkeskommune', slug: 'agderfk', adminLevel: 'county', population: 312000, subdivisionCode: 'NO-42' },
  { name: 'Rogaland fylkeskommune', slug: 'rogfk', adminLevel: 'county', population: 489000, subdivisionCode: 'NO-11' },
  { name: 'Vestland fylkeskommune', slug: 'vestlandfylke', adminLevel: 'county', population: 643000, subdivisionCode: 'NO-46' },
  { name: 'Møre og Romsdal fylkeskommune', slug: 'mrfylke', adminLevel: 'county', population: 265000, subdivisionCode: 'NO-15' },
  { name: 'Trøndelag fylkeskommune', slug: 'trondelagfylke', adminLevel: 'county', population: 472000, subdivisionCode: 'NO-50' },
  { name: 'Nordland fylkeskommune', slug: 'nfk', adminLevel: 'county', population: 241000, subdivisionCode: 'NO-18' },
  { name: 'Troms fylkeskommune', slug: 'tromsfylke', adminLevel: 'county', population: 167000, subdivisionCode: 'NO-55' },
  { name: 'Finnmark fylkeskommune', slug: 'ffk', adminLevel: 'county', population: 75000, subdivisionCode: 'NO-56' },
]

// =============================================================================
// DENMARK — 5 regioner
// =============================================================================
// Danish regions are responsible for hospitals, healthcare, psychiatry, regional
// development, soil contamination cleanup, and public transport planning.
// They have elected councils (regionsråd) that publish meeting agendas and minutes.
// Slug: lowercase — matches their website domain conventions.
// URL pattern: https://www.{slug}.dk/
// =============================================================================

export const DK_ADMIN_ENTITIES: AdminEntity[] = [
  { name: 'Region Hovedstaden', slug: 'regionh', adminLevel: 'region', population: 1870000, subdivisionCode: 'DK-84' },
  { name: 'Region Sjælland', slug: 'regionsjaelland', adminLevel: 'region', population: 838000, subdivisionCode: 'DK-85' },
  { name: 'Region Syddanmark', slug: 'regionsyddanmark', adminLevel: 'region', population: 1223000, subdivisionCode: 'DK-83' },
  { name: 'Region Midtjylland', slug: 'rm', adminLevel: 'region', population: 1330000, subdivisionCode: 'DK-82' },
  { name: 'Region Nordjylland', slug: 'rn', adminLevel: 'region', population: 590000, subdivisionCode: 'DK-81' },
]

// =============================================================================
// GERMANY — 16 Bundesländer (federal states / Landtage)
// =============================================================================
// German federal states (Länder) have massive legislative power: education, police,
// healthcare, culture, justice, media regulation. Their Landtag (state parliament)
// sessions and committee meetings are highly relevant for civic transparency.
// Each Landtag has its own unique website — no common URL pattern.
// Slug: lowercase, umlauts expanded (ü→ue, ö→oe, ä→ae, ß→ss)
// =============================================================================

export const DE_ADMIN_ENTITIES: AdminEntity[] = [
  { name: 'Baden-Württemberg', slug: 'baden-wuerttemberg', adminLevel: 'state', population: 11100000, subdivisionCode: 'DE-BW' },
  { name: 'Bayern', slug: 'bayern', adminLevel: 'state', population: 13200000, subdivisionCode: 'DE-BY' },
  { name: 'Berlin', slug: 'berlin', adminLevel: 'state', population: 3748000, subdivisionCode: 'DE-BE' },
  { name: 'Brandenburg', slug: 'brandenburg', adminLevel: 'state', population: 2540000, subdivisionCode: 'DE-BB' },
  { name: 'Bremen', slug: 'bremen', adminLevel: 'state', population: 680000, subdivisionCode: 'DE-HB' },
  { name: 'Hamburg', slug: 'hamburg', adminLevel: 'state', population: 1906000, subdivisionCode: 'DE-HH' },
  { name: 'Hessen', slug: 'hessen', adminLevel: 'state', population: 6390000, subdivisionCode: 'DE-HE' },
  { name: 'Mecklenburg-Vorpommern', slug: 'mecklenburg-vorpommern', adminLevel: 'state', population: 1620000, subdivisionCode: 'DE-MV' },
  { name: 'Niedersachsen', slug: 'niedersachsen', adminLevel: 'state', population: 8030000, subdivisionCode: 'DE-NI' },
  { name: 'Nordrhein-Westfalen', slug: 'nordrhein-westfalen', adminLevel: 'state', population: 18100000, subdivisionCode: 'DE-NW' },
  { name: 'Rheinland-Pfalz', slug: 'rheinland-pfalz', adminLevel: 'state', population: 4110000, subdivisionCode: 'DE-RP' },
  { name: 'Saarland', slug: 'saarland', adminLevel: 'state', population: 990000, subdivisionCode: 'DE-SL' },
  { name: 'Sachsen', slug: 'sachsen', adminLevel: 'state', population: 4060000, subdivisionCode: 'DE-SN' },
  { name: 'Sachsen-Anhalt', slug: 'sachsen-anhalt', adminLevel: 'state', population: 2170000, subdivisionCode: 'DE-ST' },
  { name: 'Schleswig-Holstein', slug: 'schleswig-holstein', adminLevel: 'state', population: 2930000, subdivisionCode: 'DE-SH' },
  { name: 'Thüringen', slug: 'thueringen', adminLevel: 'state', population: 2110000, subdivisionCode: 'DE-TH' },
]
