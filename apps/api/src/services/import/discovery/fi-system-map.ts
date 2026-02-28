/**
 * Finnish Municipality System Map
 *
 * Pre-verified mapping of Finnish municipalities to their meeting minutes systems.
 * Used by seed-configs.ts to create scraper_configs without blind URL probing.
 *
 * Systems:
 * - cloudnc:  CloudNC Oy — modern SaaS, https://[kunta].cloudnc.fi/fi-FI
 * - dynasty:  Innofactor Dynasty — https://poytakirjat.[kunta].fi/...
 *             Also: dynasty.[kunta].fi/djulkaisu/ or www.[kunta].fi/djulkaisu/
 * - tweb:     Tweb/Triplan — https://[kunta].tweb.fi/ktwebbin/...
 *
 * Confidence levels:
 * - 'high':   Verified or well-known customer
 * - 'medium': Likely correct based on region/pattern, verify on first run
 * - undefined: Treated as 'high' (default)
 *
 * If a municipality is NOT listed here, the seed script will probe all URL patterns.
 *
 * 📊 Approximate distribution (2024):
 * - Dynasty:  ~130 municipalities (largest share, especially rural/small)
 * - CloudNC:  ~100 municipalities (modern, many cities)
 * - Tweb:     ~60 municipalities (Triplan/Tweb, especially in eastern Finland)
 * - Other:    ~15 municipalities (CaseM, own solutions, small Åland)
 */

export type FiSystemType = 'cloudnc' | 'dynasty' | 'tweb' | 'helsinki-paatokset' | 'none'

export interface FiSystemInfo {
  system: FiSystemType
  urlOverride?: string
  pathPrefix?: string
  confidence?: 'high' | 'medium'
  notes?: string
}

/**
 * Known system type for Finnish municipalities.
 * Key: municipality slug (matches registry-sources.ts)
 */
export const FI_SYSTEM_MAP: Record<string, FiSystemInfo> = {

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CloudNC Municipalities (~60)
  // Standard URL: https://[slug].cloudnc.fi/fi-FI
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Uusimaa
  helsinki: { system: 'helsinki-paatokset', urlOverride: 'https://paatokset.hel.fi/fi/paattajat/kaupunginvaltuusto/asiakirjat', notes: 'Custom Drupal/Ahjo system. Multi-body: valtuusto, hallitus, lautakunnat.' },
  espoo: { system: 'cloudnc' },
  vantaa: { system: 'cloudnc' },
  kauniainen: { system: 'cloudnc' },
  kerava: { system: 'cloudnc' },
  kirkkonummi: { system: 'cloudnc' },
  sipoo: { system: 'cloudnc' },
  tuusula: { system: 'cloudnc' },
  nurmijarvi: { system: 'cloudnc' },
  jarvenpaa: { system: 'cloudnc' },
  mantsala: { system: 'cloudnc' },
  pornainen: { system: 'cloudnc' },

  // Varsinais-Suomi
  turku: { system: 'cloudnc' },
  kaarina: { system: 'cloudnc' },
  raisio: { system: 'cloudnc' },
  naantali: { system: 'cloudnc' },
  lieto: { system: 'cloudnc' },
  parainen: { system: 'cloudnc' },
  paimio: { system: 'cloudnc' },
  masku: { system: 'cloudnc' },
  rusko: { system: 'cloudnc' },
  nousiainen: { system: 'cloudnc' },

  // Satakunta
  pori: { system: 'cloudnc' },
  rauma: { system: 'cloudnc' },
  ulvila: { system: 'cloudnc' },

  // Pirkanmaa
  nokia: { system: 'cloudnc' },
  ylojarvi: { system: 'cloudnc' },
  kangasala: { system: 'cloudnc' },
  lempaala: { system: 'cloudnc' },
  pirkkala: { system: 'cloudnc' },
  valkeakoski: { system: 'cloudnc' },

  // Päijät-Häme
  lahti: { system: 'cloudnc' },
  hollola: { system: 'cloudnc' },
  orimattila: { system: 'cloudnc' },

  // Kymenlaakso
  kouvola: { system: 'cloudnc' },
  kotka: { system: 'cloudnc' },

  // Etelä-Karjala
  lappeenranta: { system: 'cloudnc' },
  imatra: { system: 'cloudnc' },

  // Pohjois-Savo
  kuopio: { system: 'cloudnc' },
  siilinjarvi: { system: 'cloudnc' },

  // Pohjois-Karjala
  joensuu: { system: 'cloudnc' },
  kontiolahti: { system: 'cloudnc' },

  // Keski-Suomi
  jyvaskyla: { system: 'cloudnc' },
  laukaa: { system: 'cloudnc' },
  muurame: { system: 'cloudnc' },

  // Pohjanmaa
  vaasa: { system: 'cloudnc' },

  // Keski-Pohjanmaa
  kokkola: { system: 'cloudnc' },

  // Pohjois-Pohjanmaa
  oulu: { system: 'cloudnc' },
  kempele: { system: 'cloudnc' },
  liminka: { system: 'cloudnc' },

  // Kainuu
  kajaani: { system: 'cloudnc' },

  // Lappi
  rovaniemi: { system: 'cloudnc' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Tweb/Triplan Municipalities (~60)
  // Standard URL: https://[slug].tweb.fi/ktwebbin/dbisa.dll/ktwebscr/pk_tek_tweb.htm
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Kanta-Häme
  hameenlinna: { system: 'tweb' },
  riihimaki: { system: 'tweb' },
  forssa: { system: 'tweb' },
  janakkala: { system: 'tweb' },
  hattula: { system: 'tweb' },
  loppi: { system: 'tweb' },
  hausjarvi: { system: 'tweb' },
  tammela: { system: 'dynasty', urlOverride: 'https://tammela10.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS' },
  jokioinen: { system: 'tweb', urlOverride: 'https://jokioinen-julkaisu.triplancloud.fi/', notes: 'TriPlanCloud' },
  humppila: { system: 'tweb', urlOverride: 'https://humppila.tweb.fi/ktwebscr/epj_tek_tweb.htm', notes: 'Alt tweb path' },
  ypaja: { system: 'none', notes: 'PDFs on WordPress, no meeting system' },

  // Pirkanmaa
  tampere: { system: 'tweb' },
  sastamala: { system: 'tweb' },
  akaa: { system: 'tweb' },
  orivesi: { system: 'tweb' },
  hameenkyro: { system: 'tweb' },
  parkano: { system: 'dynasty', urlOverride: 'https://parkanod10.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS d10' },
  ikaalinen: { system: 'tweb', urlOverride: 'https://ikaalinen.tweb.fi/ktwebscr/epj_tek_tweb.htm', notes: 'Alt tweb path' },
  virrat: { system: 'none', notes: 'PDFs on WordPress, no meeting system' },
  manttavilppula: { system: 'dynasty', urlOverride: 'https://mantta-vilppulad10.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS d10, hyphenated slug' },
  palkane: { system: 'dynasty', urlOverride: 'https://palkane.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS' },
  vesilahti: { system: 'cloudnc' },
  urjala: { system: 'tweb', urlOverride: 'https://urjala.tweb.fi/ktwebscr/epj_tek_tweb.htm', notes: 'Alt tweb path' },
  punkalaidun: { system: 'dynasty', urlOverride: 'https://punkalaidun.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS' },
  ruovesi: { system: 'dynasty', urlOverride: 'https://ruovesi.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS, migrated from self-hosted' },
  kihnio: { system: 'none', notes: 'Uses Gemilo CMS, kihnio.fi/agenda' },
  juupajoki: { system: 'none', notes: 'PDFs on WordPress, no meeting system' },
  kuhmoinen: { system: 'dynasty', urlOverride: 'https://kuhmoinen.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS' },

  // Päijät-Häme
  heinola: { system: 'tweb' },
  asikkala: { system: 'dynasty', urlOverride: 'https://asikkalad10.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS d10' },

  // Etelä-Savo
  mikkeli: { system: 'tweb' },
  savonlinna: { system: 'tweb' },
  pieksamaki: { system: 'tweb' },
  mantyharju: { system: 'tweb', confidence: 'medium' },
  kangasniemi: { system: 'tweb', confidence: 'medium' },
  juva: { system: 'dynasty', urlOverride: 'https://juva.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS' },

  // Pohjois-Savo
  iisalmi: { system: 'tweb' },
  varkaus: { system: 'tweb' },
  suonenjoki: { system: 'dynasty', urlOverride: 'https://www.suonenjoki.info/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'Dynasty self-hosted' },
  leppavirta: { system: 'tweb', confidence: 'medium' },

  // Keski-Suomi
  jamsa: { system: 'tweb' },
  aanekoski: { system: 'tweb' },
  saarijarvi: { system: 'dynasty', urlOverride: 'https://julkaisu.saarijarvi.fi/saarijarvi10/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'Dynasty self-hosted' },
  keuruu: { system: 'dynasty', urlOverride: 'https://keuruu.oncloudos.com/cgi/DREQUEST.PHP?page=meeting_frames', notes: 'OnCloudOS' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Dynasty Municipalities (~190)
  // Standard URL: https://poytakirjat.[slug].fi/cgi/DREQUEST.PHP?page=meeting_frames
  // Alt: https://dynasty.[slug].fi/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames
  // Alt: https://www.[slug].fi/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Uusimaa
  hyvinkaa: { system: 'dynasty' },
  lohja: { system: 'dynasty' },
  porvoo: { system: 'dynasty' },
  vihti: { system: 'dynasty' },
  hanko: { system: 'dynasty' },
  loviisa: { system: 'dynasty' },
  raseborg: { system: 'dynasty' },
  siuntio: { system: 'dynasty' },
  inkoo: { system: 'dynasty' },
  karkkila: { system: 'dynasty' },
  askola: { system: 'dynasty' },
  lapinjarvi: { system: 'dynasty' },
  myrskyla: { system: 'dynasty' },
  pukkila: { system: 'dynasty' },

  // Varsinais-Suomi
  salo: { system: 'dynasty' },
  loimaa: { system: 'dynasty' },
  uusikaupunki: { system: 'dynasty' },
  somero: { system: 'dynasty' },
  laitila: { system: 'dynasty' },
  mynamaki: { system: 'dynasty' },
  aura: { system: 'dynasty' },
  poytya: { system: 'dynasty' },
  marttila: { system: 'dynasty' },
  koskitl: { system: 'dynasty' },
  oripaa: { system: 'dynasty' },
  sauvo: { system: 'dynasty' },
  pyharanta: { system: 'dynasty' },
  taivassalo: { system: 'dynasty' },
  vehmaa: { system: 'dynasty' },
  kustavi: { system: 'dynasty' },
  kemionsaari: { system: 'dynasty' },

  // Satakunta
  eura: { system: 'dynasty' },
  eurajoki: { system: 'dynasty' },
  huittinen: { system: 'dynasty' },
  kankaanpaa: { system: 'dynasty' },
  kokemaki: { system: 'dynasty' },
  harjavalta: { system: 'dynasty' },
  nakkila: { system: 'dynasty' },
  sakyla: { system: 'dynasty' },
  pomarkku: { system: 'dynasty' },
  merikarvia: { system: 'dynasty' },
  siikainen: { system: 'dynasty' },
  jamijarvi: { system: 'dynasty' },
  karvia: { system: 'dynasty' },

  // Kymenlaakso
  hamina: { system: 'dynasty' },
  pyhtaa: { system: 'dynasty' },
  virolahti: { system: 'dynasty' },
  miehikkala: { system: 'dynasty' },

  // Päijät-Häme
  karkola: { system: 'dynasty' },
  padasjoki: { system: 'dynasty' },
  sysma: { system: 'dynasty' },
  hartola: { system: 'dynasty' },
  iitti: { system: 'dynasty' },

  // Etelä-Karjala
  lemi: { system: 'dynasty' },
  luumaki: { system: 'dynasty' },
  parikkala: { system: 'dynasty' },
  rautjarvi: { system: 'dynasty' },
  ruokolahti: { system: 'dynasty' },
  savitaipale: { system: 'dynasty' },
  taipalsaari: { system: 'dynasty' },

  // Etelä-Savo
  pertunmaa: { system: 'dynasty' },
  puumala: { system: 'dynasty' },
  sulkava: { system: 'dynasty' },
  enonkoski: { system: 'dynasty' },
  hirvensalmi: { system: 'dynasty' },
  rantasalmi: { system: 'dynasty' },

  // Pohjois-Savo
  kiuruvesi: { system: 'dynasty' },
  lapinlahti: { system: 'dynasty' },
  sonkajarvi: { system: 'dynasty' },
  pielavesi: { system: 'dynasty' },
  rautalampi: { system: 'dynasty' },
  keitele: { system: 'dynasty' },
  vesanto: { system: 'dynasty' },
  tervo: { system: 'dynasty' },
  tuusniemi: { system: 'dynasty' },
  kaavi: { system: 'dynasty' },
  rautavaara: { system: 'dynasty' },
  vierema: { system: 'dynasty' },
  joroinen: { system: 'dynasty' },

  // Pohjois-Karjala
  lieksa: { system: 'dynasty' },
  nurmes: { system: 'dynasty' },
  outokumpu: { system: 'dynasty' },
  kitee: { system: 'dynasty' },
  liperi: { system: 'dynasty' },
  polvijarvi: { system: 'dynasty' },
  juuka: { system: 'dynasty' },
  ilomantsi: { system: 'dynasty' },
  tohmajarvi: { system: 'dynasty' },
  heinavesi: { system: 'dynasty' },
  raakkyla: { system: 'dynasty' },

  // Keski-Suomi
  viitasaari: { system: 'dynasty' },
  petajavesi: { system: 'dynasty' },
  joutsa: { system: 'dynasty' },
  pihtipudas: { system: 'dynasty' },
  kivijarvi: { system: 'dynasty' },
  kannonkoski: { system: 'dynasty' },
  karstula: { system: 'dynasty' },
  kyyjarvi: { system: 'dynasty' },
  kinnula: { system: 'dynasty' },
  konnevesi: { system: 'dynasty' },
  multia: { system: 'dynasty' },
  uurainen: { system: 'dynasty' },
  hankasalmi: { system: 'dynasty' },
  toivakka: { system: 'dynasty' },
  luhanka: { system: 'dynasty' },

  // Etelä-Pohjanmaa
  seinajoki: { system: 'dynasty' },
  kauhava: { system: 'dynasty' },
  lapua: { system: 'dynasty' },
  kurikka: { system: 'dynasty' },
  kauhajoki: { system: 'dynasty' },
  alavus: { system: 'dynasty' },
  ilmajoki: { system: 'dynasty' },
  teuva: { system: 'dynasty' },
  ahtari: { system: 'dynasty' },
  alajarvi: { system: 'dynasty' },
  lappajarvi: { system: 'dynasty' },
  vimpeli: { system: 'dynasty' },
  evijarvi: { system: 'dynasty' },
  soini: { system: 'dynasty' },
  kuortane: { system: 'dynasty' },
  isojoki: { system: 'dynasty' },
  karijoki: { system: 'dynasty' },
  isokyro: { system: 'dynasty' },

  // Pohjanmaa
  mustasaari: { system: 'dynasty' },
  pietarsaari: { system: 'dynasty' },
  pedersore: { system: 'dynasty' },
  narpio: { system: 'dynasty' },
  kristiinankaupunki: { system: 'dynasty' },
  uusikaarlepyy: { system: 'dynasty' },
  kruunupyy: { system: 'dynasty' },
  luoto: { system: 'dynasty' },
  maalahti: { system: 'dynasty' },
  voyri: { system: 'dynasty' },
  korsnas: { system: 'dynasty' },
  laihia: { system: 'dynasty' },
  kaskinen: { system: 'dynasty' },

  // Keski-Pohjanmaa
  kannus: { system: 'dynasty' },
  kaustinen: { system: 'dynasty' },
  veteli: { system: 'dynasty' },
  halsua: { system: 'dynasty' },
  lestijarvi: { system: 'dynasty' },
  toholampi: { system: 'dynasty' },
  perho: { system: 'dynasty' },

  // Pohjois-Pohjanmaa
  raahe: { system: 'dynasty' },
  ylivieska: { system: 'dynasty' },
  kalajoki: { system: 'dynasty' },
  kuusamo: { system: 'dynasty' },
  nivala: { system: 'dynasty' },
  haapajarvi: { system: 'dynasty', urlOverride: 'https://dynasty.haapajarvi.fi/djulkaisu/cgi/DREQUEST.PHP?page=meeting_frames', pathPrefix: '/D10_Haapajarvi' },
  haapavesi: { system: 'dynasty' },
  oulainen: { system: 'dynasty' },
  ii: { system: 'dynasty' },
  muhos: { system: 'dynasty' },
  tyrnava: { system: 'dynasty' },
  lumijoki: { system: 'dynasty' },
  siikajoki: { system: 'dynasty' },
  pyhajoki: { system: 'dynasty' },
  merijarvi: { system: 'dynasty' },
  alavieska: { system: 'dynasty' },
  sievi: { system: 'dynasty' },
  pyhajarvi: { system: 'dynasty' },
  karsamaki: { system: 'dynasty' },
  reisjarvi: { system: 'dynasty' },
  pyhanta: { system: 'dynasty' },
  siikalatva: { system: 'dynasty' },
  pudasjarvi: { system: 'dynasty' },
  taivalkoski: { system: 'dynasty' },
  vaala: { system: 'dynasty' },
  utajarvi: { system: 'dynasty' },
  hailuoto: { system: 'dynasty' },

  // Kainuu
  sotkamo: { system: 'dynasty' },
  kuhmo: { system: 'dynasty' },
  suomussalmi: { system: 'dynasty' },
  puolanka: { system: 'dynasty' },
  paltamo: { system: 'dynasty' },
  ristijarvi: { system: 'dynasty' },
  hyrynsalmi: { system: 'dynasty' },

  // Lappi
  tornio: { system: 'dynasty' },
  kemi: { system: 'dynasty' },
  sodankyla: { system: 'dynasty' },
  kemijarvi: { system: 'dynasty' },
  kittila: { system: 'dynasty' },
  inari: { system: 'dynasty' },
  kolari: { system: 'dynasty' },
  muonio: { system: 'dynasty' },
  enontekio: { system: 'dynasty' },
  utsjoki: { system: 'dynasty' },
  savukoski: { system: 'dynasty' },
  pelkosenniemi: { system: 'dynasty' },
  salla: { system: 'dynasty' },
  posio: { system: 'dynasty' },
  ranua: { system: 'dynasty' },
  pello: { system: 'dynasty' },
  ylitornio: { system: 'dynasty' },
  tervola: { system: 'dynasty' },
  simo: { system: 'dynasty' },
  keminmaa: { system: 'dynasty' },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Åland — Swedish-speaking, may use own solutions
  // These are small islands; some may not have online systems at all
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  maarianhamina: { system: 'dynasty', confidence: 'medium', notes: 'Åland capital, Swedish: Mariehamn' },
  jomala: { system: 'dynasty', confidence: 'medium' },
  finstrom: { system: 'dynasty', confidence: 'medium' },
  lemland: { system: 'dynasty', confidence: 'medium' },
  saltvik: { system: 'dynasty', confidence: 'medium' },
  hammarland: { system: 'dynasty', confidence: 'medium' },
  sund: { system: 'dynasty', confidence: 'medium' },
  eckero: { system: 'dynasty', confidence: 'medium' },
  // Pienet Åland-kunnat — todennäköisesti ei verkko-pöytäkirjajärjestelmää
  foglo: { system: 'dynasty', confidence: 'medium', notes: 'Tiny island, may not have online system' },
  brando: { system: 'dynasty', confidence: 'medium', notes: 'Pop ~450' },
  kumlinge: { system: 'dynasty', confidence: 'medium', notes: 'Pop ~300' },
  kokar: { system: 'dynasty', confidence: 'medium', notes: 'Pop ~240' },
  sottunga: { system: 'dynasty', confidence: 'medium', notes: 'Pop ~100, smallest in Finland' },
  geta: { system: 'dynasty', confidence: 'medium', notes: 'Pop ~500' },
  vardo: { system: 'dynasty', confidence: 'medium', notes: 'Pop ~430' },
  lumparland: { system: 'dynasty', confidence: 'medium', notes: 'Pop ~400' },
}

/**
 * Helsinki decision-making bodies (toimielimet).
 * Each gets its own scraper config since they have separate document pages.
 */
export const HELSINKI_BODIES = [
  { slug: 'kaupunginvaltuusto', name: 'Helsinki / Kaupunginvaltuusto' },
  { slug: 'kaupunginhallitus', name: 'Helsinki / Kaupunginhallitus' },
  { slug: 'kaupunginhallituksen-konsernijaosto', name: 'Helsinki / Konsernijaosto' },
  { slug: 'kaupunginhallituksen-elinkeinojaosto', name: 'Helsinki / Elinkeinojaosto' },
  { slug: 'kasvatus-ja-koulutuslautakunta', name: 'Helsinki / Kasvatus- ja koulutuslautakunta' },
  { slug: 'kaupunkiymparistolautakunta', name: 'Helsinki / Kaupunkiympäristölautakunta' },
  { slug: 'sosiaali-terveys-ja-pelastuslautakunta', name: 'Helsinki / Sosiaali-, terveys- ja pelastuslautakunta' },
  { slug: 'kulttuuri-ja-vapaa-aikalautakunta', name: 'Helsinki / Kulttuuri- ja vapaa-aikalautakunta' },
  { slug: 'tarkastuslautakunta', name: 'Helsinki / Tarkastuslautakunta' },
  { slug: 'keskusvaalilautakunta', name: 'Helsinki / Keskusvaalilautakunta' },
] as const

/**
 * Get the known system type for a Finnish municipality.
 * Returns null if not mapped (the seed script will probe all URL patterns).
 */
export function getFiSystem(slug: string): FiSystemInfo | null {
  return FI_SYSTEM_MAP[slug] || null
}

/**
 * Build the standard URL for a Finnish municipality based on system type.
 */
export function buildFiUrl(slug: string, system: FiSystemType): string {
  switch (system) {
    case 'cloudnc':
      return `https://${slug}.cloudnc.fi/fi-FI`
    case 'dynasty':
      return `https://poytakirjat.${slug}.fi/cgi/DREQUEST.PHP?page=meeting_frames`
    case 'tweb':
      return `https://${slug}.tweb.fi/ktwebbin/dbisa.dll/ktwebscr/pk_tek_tweb.htm`
    case 'helsinki-paatokset':
      return `https://paatokset.hel.fi/fi/paattajat/kaupunginvaltuusto/asiakirjat`
    case 'none':
      return '' // Should not be called for 'none' entries
  }
}

/**
 * Get statistics about the system map.
 */
export function getMapStats(): { total: number; cloudnc: number; dynasty: number; tweb: number; highConfidence: number; mediumConfidence: number } {
  const entries = Object.values(FI_SYSTEM_MAP)
  return {
    total: entries.length,
    cloudnc: entries.filter(e => e.system === 'cloudnc').length,
    dynasty: entries.filter(e => e.system === 'dynasty').length,
    tweb: entries.filter(e => e.system === 'tweb').length,
    highConfidence: entries.filter(e => !e.confidence || e.confidence === 'high').length,
    mediumConfidence: entries.filter(e => e.confidence === 'medium').length,
  }
}
