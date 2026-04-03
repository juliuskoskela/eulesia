// =============================================================================
// Municipality / City data for Estonia and Germany
// =============================================================================
// Estonia: All 79 municipalities (15 urban + 64 rural) after 2017 reform
// Germany: Top 200 cities by population (approx. 2023/2024 figures)
// =============================================================================

export interface Municipality {
  name: string;
  slug: string;
  population: number;
}

// =============================================================================
// ESTONIA - 79 municipalities (omavalitsused)
// =============================================================================
// Slug convention for Amphora (atp.amphora.ee/{slug}/):
//   Cities (linnad): {nimi}lv   (e.g. tallinnlv, tartulv)
//   Parishes (vallad): {nimi}vald (e.g. sauevald, raevald)
// Population figures: approximate 2024
// =============================================================================

export const EE_MUNICIPALITIES: Municipality[] = [
  // ---------------------------------------------------------------------------
  // Harju maakond (16 municipalities)
  // ---------------------------------------------------------------------------
  // Urban municipalities (linnad)
  { name: "Tallinn", slug: "tallinnlv", population: 454000 },
  { name: "Keila", slug: "keilalv", population: 10600 },
  { name: "Loksa", slug: "loksalv", population: 2500 },
  { name: "Maardu", slug: "maardulv", population: 16200 },
  // Rural municipalities (vallad)
  { name: "Anija vald", slug: "anijavald", population: 6200 },
  { name: "Harku vald", slug: "harkuvald", population: 15800 },
  { name: "Jõelähtme vald", slug: "joelahtmevald", population: 7200 },
  { name: "Kiili vald", slug: "kiilivald", population: 7000 },
  { name: "Kose vald", slug: "kosevald", population: 7600 },
  { name: "Kuusalu vald", slug: "kuusaluvald", population: 6700 },
  { name: "Lääne-Harju vald", slug: "laaneharjuvald", population: 13200 },
  { name: "Raasiku vald", slug: "raasikuvald", population: 5600 },
  { name: "Rae vald", slug: "raevald", population: 22500 },
  { name: "Saku vald", slug: "sakuvald", population: 11800 },
  { name: "Saue vald", slug: "sauevald", population: 24000 },
  { name: "Viimsi vald", slug: "viimsivald", population: 21500 },

  // ---------------------------------------------------------------------------
  // Hiiu maakond (1 municipality)
  // ---------------------------------------------------------------------------
  { name: "Hiiumaa vald", slug: "hiiumaavald", population: 9400 },

  // ---------------------------------------------------------------------------
  // Ida-Viru maakond (8 municipalities)
  // ---------------------------------------------------------------------------
  // Urban municipalities (linnad)
  { name: "Kohtla-Järve", slug: "kohtlajarvelv", population: 33800 },
  { name: "Narva", slug: "narvalv", population: 55200 },
  { name: "Narva-Jõesuu", slug: "narvajoesuu", population: 4200 },
  { name: "Sillamäe", slug: "sillamaelv", population: 12500 },
  // Rural municipalities (vallad)
  { name: "Alutaguse vald", slug: "alutagusevald", population: 4300 },
  { name: "Jõhvi vald", slug: "johvivald", population: 11600 },
  { name: "Lüganuse vald", slug: "luganusevald", population: 8400 },
  { name: "Toila vald", slug: "toilavald", population: 5000 },

  // ---------------------------------------------------------------------------
  // Jõgeva maakond (3 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Jõgeva vald", slug: "jogevavald", population: 13200 },
  { name: "Mustvee vald", slug: "mustveevald", population: 5200 },
  { name: "Põltsamaa vald", slug: "poltsamaavald", population: 9800 },

  // ---------------------------------------------------------------------------
  // Järva maakond (3 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Järva vald", slug: "jarvavald", population: 8200 },
  { name: "Paide linn", slug: "paidelv", population: 10200 },
  { name: "Türi vald", slug: "turivald", population: 10600 },

  // ---------------------------------------------------------------------------
  // Lääne maakond (3 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Haapsalu linn", slug: "haapsalulv", population: 12700 },
  { name: "Lääne-Nigula vald", slug: "laanenigulavald", population: 5400 },
  { name: "Vormsi vald", slug: "vormsivald", population: 400 },

  // ---------------------------------------------------------------------------
  // Lääne-Viru maakond (8 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Haljala vald", slug: "haljalavald", population: 4100 },
  { name: "Kadrina vald", slug: "kadrinavald", population: 4800 },
  { name: "Rakvere linn", slug: "rakverelv", population: 15600 },
  { name: "Rakvere vald", slug: "rakverevald", population: 4600 },
  { name: "Tapa vald", slug: "tapavald", population: 8800 },
  { name: "Vinni vald", slug: "vinnivald", population: 5800 },
  { name: "Viru-Nigula vald", slug: "virunigulavald", population: 5600 },
  { name: "Väike-Maarja vald", slug: "vaikemaarjavald", population: 5900 },

  // ---------------------------------------------------------------------------
  // Põlva maakond (3 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Kanepi vald", slug: "kanepivald", population: 4900 },
  { name: "Põlva vald", slug: "polvavald", population: 13800 },
  { name: "Räpina vald", slug: "rapinavald", population: 6300 },

  // ---------------------------------------------------------------------------
  // Pärnu maakond (7 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Häädemeeste vald", slug: "haademeestevald", population: 4100 },
  { name: "Kihnu vald", slug: "kihnuvald", population: 500 },
  { name: "Lääneranna vald", slug: "laanerannavald", population: 5200 },
  { name: "Põhja-Pärnumaa vald", slug: "pohjaparnumaavald", population: 8600 },
  { name: "Pärnu linn", slug: "parnulv", population: 52200 },
  { name: "Saarde vald", slug: "saardevald", population: 4100 },
  { name: "Tori vald", slug: "torivald", population: 11300 },

  // ---------------------------------------------------------------------------
  // Rapla maakond (4 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Kehtna vald", slug: "kehtnavald", population: 5200 },
  { name: "Kohila vald", slug: "kohilavald", population: 7100 },
  { name: "Märjamaa vald", slug: "marjamaavald", population: 7400 },
  { name: "Rapla vald", slug: "raplavald", population: 13100 },

  // ---------------------------------------------------------------------------
  // Saare maakond (3 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Muhu vald", slug: "muhuvald", population: 1700 },
  { name: "Ruhnu vald", slug: "ruhnuvald", population: 100 },
  { name: "Saaremaa vald", slug: "saaremaavald", population: 31300 },

  // ---------------------------------------------------------------------------
  // Tartu maakond (8 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Elva vald", slug: "elvavald", population: 14500 },
  { name: "Kambja vald", slug: "kambjavald", population: 13000 },
  { name: "Kastre vald", slug: "kastrevald", population: 5600 },
  { name: "Luunja vald", slug: "luunjavald", population: 11200 },
  { name: "Nõo vald", slug: "noovald", population: 4600 },
  { name: "Peipsiääre vald", slug: "peipsiaaerevald", population: 5100 },
  { name: "Tartu linn", slug: "tartulv", population: 97600 },
  { name: "Tartu vald", slug: "tartuvald", population: 10900 },

  // ---------------------------------------------------------------------------
  // Valga maakond (3 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Otepää vald", slug: "otepaavald", population: 6200 },
  { name: "Tõrva vald", slug: "torvavald", population: 5400 },
  { name: "Valga vald", slug: "valgavald", population: 16300 },

  // ---------------------------------------------------------------------------
  // Viljandi maakond (4 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Mulgi vald", slug: "mulgivald", population: 8000 },
  { name: "Põhja-Sakala vald", slug: "pohjasakalavald", population: 8100 },
  { name: "Viljandi linn", slug: "viljandilv", population: 17100 },
  { name: "Viljandi vald", slug: "viljandivald", population: 6100 },

  // ---------------------------------------------------------------------------
  // Võru maakond (5 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Antsla vald", slug: "antslavald", population: 4300 },
  { name: "Rõuge vald", slug: "rougevald", population: 5100 },
  { name: "Setomaa vald", slug: "setomaavald", population: 3100 },
  { name: "Võru linn", slug: "vorulv", population: 11800 },
  { name: "Võru vald", slug: "voruvald", population: 8500 },
];

// =============================================================================
// GERMANY - Top 200 cities by population
// =============================================================================
// Slug convention: lowercase, umlauts expanded (ü→ue, ö→oe, ä→ae, ß→ss),
// spaces and hyphens removed.
// URLs: https://ratsinfo.{slug}.de/ or https://ratsinfo.stadt-{slug}.de/
// Population figures: approximate 2023/2024
// =============================================================================

export const DE_MUNICIPALITIES: Municipality[] = [
  // ---------------------------------------------------------------------------
  // Baden-Württemberg
  // ---------------------------------------------------------------------------
  { name: "Stuttgart", slug: "stuttgart", population: 632865 },
  { name: "Mannheim", slug: "mannheim", population: 315100 },
  { name: "Karlsruhe", slug: "karlsruhe", population: 313092 },
  {
    name: "Freiburg im Breisgau",
    slug: "freiburgimbreisgau",
    population: 236140,
  },
  { name: "Heidelberg", slug: "heidelberg", population: 162273 },
  { name: "Heilbronn", slug: "heilbronn", population: 129138 },
  { name: "Ulm", slug: "ulm", population: 128928 },
  { name: "Pforzheim", slug: "pforzheim", population: 129368 },
  { name: "Reutlingen", slug: "reutlingen", population: 116456 },
  { name: "Esslingen am Neckar", slug: "esslingenamneckar", population: 94252 },
  { name: "Ludwigsburg", slug: "ludwigsburg", population: 93584 },
  { name: "Tübingen", slug: "tuebingen", population: 91877 },
  {
    name: "Villingen-Schwenningen",
    slug: "villingenschwenningen",
    population: 86253,
  },
  { name: "Konstanz", slug: "konstanz", population: 85524 },
  { name: "Aalen", slug: "aalen", population: 68907 },
  { name: "Sindelfingen", slug: "sindelfingen", population: 64655 },
  { name: "Schwäbisch Gmünd", slug: "schwaebischgmuend", population: 61817 },
  { name: "Friedrichshafen", slug: "friedrichshafen", population: 62007 },
  { name: "Offenburg", slug: "offenburg", population: 62183 },
  { name: "Göppingen", slug: "goeppingen", population: 59291 },
  { name: "Baden-Baden", slug: "badenbaden", population: 57203 },
  { name: "Waiblingen", slug: "waiblingen", population: 56776 },
  { name: "Ravensburg", slug: "ravensburg", population: 52218 },
  { name: "Böblingen", slug: "boeblingen", population: 51894 },
  { name: "Rastatt", slug: "rastatt", population: 50515 },

  // ---------------------------------------------------------------------------
  // Bayern (Bavaria)
  // ---------------------------------------------------------------------------
  { name: "München", slug: "muenchen", population: 1512491 },
  { name: "Nürnberg", slug: "nuernberg", population: 523026 },
  { name: "Augsburg", slug: "augsburg", population: 304059 },
  { name: "Regensburg", slug: "regensburg", population: 157440 },
  { name: "Ingolstadt", slug: "ingolstadt", population: 141312 },
  { name: "Würzburg", slug: "wuerzburg", population: 128226 },
  { name: "Fürth", slug: "fuerth", population: 131467 },
  { name: "Erlangen", slug: "erlangen", population: 116062 },
  { name: "Bamberg", slug: "bamberg", population: 79000 },
  { name: "Bayreuth", slug: "bayreuth", population: 74783 },
  { name: "Landshut", slug: "landshut", population: 73550 },
  { name: "Aschaffenburg", slug: "aschaffenburg", population: 72219 },
  { name: "Kempten", slug: "kempten", population: 71364 },
  { name: "Rosenheim", slug: "rosenheim", population: 65089 },
  { name: "Schweinfurt", slug: "schweinfurt", population: 54813 },
  { name: "Passau", slug: "passau", population: 53684 },
  { name: "Straubing", slug: "straubing", population: 49015 },
  { name: "Freising", slug: "freising", population: 50190 },
  { name: "Neu-Ulm", slug: "neululm", population: 62375 },
  { name: "Kaufbeuren", slug: "kaufbeuren", population: 46571 },
  { name: "Memmingen", slug: "memmingen", population: 45493 },
  { name: "Schwabach", slug: "schwabach", population: 42134 },
  { name: "Hof", slug: "hof", population: 46660 },
  { name: "Coburg", slug: "coburg", population: 42015 },
  {
    name: "Weiden in der Oberpfalz",
    slug: "weideninderoberpfalz",
    population: 43618,
  },
  { name: "Amberg", slug: "amberg", population: 42230 },

  // ---------------------------------------------------------------------------
  // Berlin
  // ---------------------------------------------------------------------------
  { name: "Berlin", slug: "berlin", population: 3748148 },

  // ---------------------------------------------------------------------------
  // Brandenburg
  // ---------------------------------------------------------------------------
  { name: "Potsdam", slug: "potsdam", population: 185750 },
  { name: "Cottbus", slug: "cottbus", population: 100219 },
  {
    name: "Brandenburg an der Havel",
    slug: "brandenburganderhavel",
    population: 73198,
  },
  { name: "Frankfurt (Oder)", slug: "frankfurtoder", population: 57015 },

  // ---------------------------------------------------------------------------
  // Bremen
  // ---------------------------------------------------------------------------
  { name: "Bremen", slug: "bremen", population: 569352 },
  { name: "Bremerhaven", slug: "bremerhaven", population: 118200 },

  // ---------------------------------------------------------------------------
  // Hamburg
  // ---------------------------------------------------------------------------
  { name: "Hamburg", slug: "hamburg", population: 1906411 },

  // ---------------------------------------------------------------------------
  // Hessen (Hesse)
  // ---------------------------------------------------------------------------
  { name: "Frankfurt am Main", slug: "frankfurtammain", population: 773068 },
  { name: "Wiesbaden", slug: "wiesbaden", population: 283083 },
  { name: "Kassel", slug: "kassel", population: 204202 },
  { name: "Darmstadt", slug: "darmstadt", population: 164044 },
  { name: "Offenbach am Main", slug: "offenbachammain", population: 132166 },
  { name: "Hanau", slug: "hanau", population: 101564 },
  { name: "Gießen", slug: "giessen", population: 92861 },
  { name: "Marburg", slug: "marburg", population: 77291 },
  { name: "Fulda", slug: "fulda", population: 69034 },
  {
    name: "Rüsselsheim am Main",
    slug: "ruesselsheimammain",
    population: 67780,
  },
  {
    name: "Bad Homburg vor der Höhe",
    slug: "badhomburgvorderhoehe",
    population: 55100,
  },
  { name: "Wetzlar", slug: "wetzlar", population: 54252 },

  // ---------------------------------------------------------------------------
  // Mecklenburg-Vorpommern
  // ---------------------------------------------------------------------------
  { name: "Rostock", slug: "rostock", population: 210220 },
  { name: "Schwerin", slug: "schwerin", population: 100516 },
  { name: "Neubrandenburg", slug: "neubrandenburg", population: 64886 },
  { name: "Stralsund", slug: "stralsund", population: 60447 },
  { name: "Greifswald", slug: "greifswald", population: 59832 },
  { name: "Wismar", slug: "wismar", population: 44741 },

  // ---------------------------------------------------------------------------
  // Niedersachsen (Lower Saxony)
  // ---------------------------------------------------------------------------
  { name: "Hannover", slug: "hannover", population: 545045 },
  { name: "Braunschweig", slug: "braunschweig", population: 248561 },
  { name: "Oldenburg", slug: "oldenburg", population: 172280 },
  { name: "Osnabrück", slug: "osnabrueck", population: 166195 },
  { name: "Wolfsburg", slug: "wolfsburg", population: 128227 },
  { name: "Göttingen", slug: "goettingen", population: 118911 },
  { name: "Salzgitter", slug: "salzgitter", population: 107112 },
  { name: "Hildesheim", slug: "hildesheim", population: 101667 },
  { name: "Delmenhorst", slug: "delmenhorst", population: 82489 },
  { name: "Wilhelmshaven", slug: "wilhelmshaven", population: 79219 },
  { name: "Lüneburg", slug: "lueneburg", population: 78235 },
  { name: "Celle", slug: "celle", population: 71139 },
  { name: "Garbsen", slug: "garbsen", population: 63898 },
  { name: "Langenhagen", slug: "langenhagen", population: 56422 },
  { name: "Hameln", slug: "hameln", population: 57981 },
  { name: "Wolfenbüttel", slug: "wolfenbuettel", population: 53058 },
  { name: "Nordhorn", slug: "nordhorn", population: 54707 },
  { name: "Lingen (Ems)", slug: "lingenems", population: 55937 },
  { name: "Emden", slug: "emden", population: 51404 },
  { name: "Cuxhaven", slug: "cuxhaven", population: 50355 },
  { name: "Goslar", slug: "goslar", population: 50753 },

  // ---------------------------------------------------------------------------
  // Nordrhein-Westfalen (North Rhine-Westphalia)
  // ---------------------------------------------------------------------------
  { name: "Köln", slug: "koeln", population: 1083498 },
  { name: "Düsseldorf", slug: "duesseldorf", population: 629047 },
  { name: "Dortmund", slug: "dortmund", population: 588250 },
  { name: "Essen", slug: "essen", population: 583109 },
  { name: "Duisburg", slug: "duisburg", population: 502634 },
  { name: "Bochum", slug: "bochum", population: 365742 },
  { name: "Wuppertal", slug: "wuppertal", population: 359566 },
  { name: "Bielefeld", slug: "bielefeld", population: 338332 },
  { name: "Bonn", slug: "bonn", population: 336465 },
  { name: "Münster", slug: "muenster", population: 320946 },
  { name: "Gelsenkirchen", slug: "gelsenkirchen", population: 262742 },
  { name: "Mönchengladbach", slug: "moenchengladbach", population: 261001 },
  { name: "Aachen", slug: "aachen", population: 259269 },
  { name: "Krefeld", slug: "krefeld", population: 227417 },
  { name: "Oberhausen", slug: "oberhausen", population: 211422 },
  { name: "Hagen", slug: "hagen", population: 189044 },
  { name: "Hamm", slug: "hamm", population: 181783 },
  {
    name: "Mülheim an der Ruhr",
    slug: "muelheimanderruhr",
    population: 171265,
  },
  { name: "Herne", slug: "herne", population: 157145 },
  { name: "Solingen", slug: "solingen", population: 163112 },
  { name: "Leverkusen", slug: "leverkusen", population: 164042 },
  { name: "Neuss", slug: "neuss", population: 159660 },
  { name: "Paderborn", slug: "paderborn", population: 155742 },
  { name: "Bottrop", slug: "bottrop", population: 117565 },
  { name: "Recklinghausen", slug: "recklinghausen", population: 112267 },
  { name: "Remscheid", slug: "remscheid", population: 112369 },
  { name: "Bergisch Gladbach", slug: "bergischgladbach", population: 113679 },
  { name: "Siegen", slug: "siegen", population: 103424 },
  { name: "Moers", slug: "moers", population: 104326 },
  { name: "Witten", slug: "witten", population: 97005 },
  { name: "Gütersloh", slug: "guetersloh", population: 103891 },
  { name: "Iserlohn", slug: "iserlohn", population: 93345 },
  { name: "Düren", slug: "dueren", population: 93440 },
  { name: "Ratingen", slug: "ratingen", population: 87996 },
  { name: "Lünen", slug: "luenen", population: 87298 },
  { name: "Marl", slug: "marl", population: 84586 },
  { name: "Minden", slug: "minden", population: 83998 },
  { name: "Velbert", slug: "velbert", population: 82127 },
  { name: "Viersen", slug: "viersen", population: 78352 },
  { name: "Rheine", slug: "rheine", population: 78144 },
  { name: "Dorsten", slug: "dorsten", population: 75491 },
  { name: "Gladbeck", slug: "gladbeck", population: 77131 },
  { name: "Arnsberg", slug: "arnsberg", population: 73166 },
  { name: "Bocholt", slug: "bocholt", population: 71790 },
  { name: "Detmold", slug: "detmold", population: 74959 },
  { name: "Troisdorf", slug: "troisdorf", population: 78000 },
  { name: "Castrop-Rauxel", slug: "castroprauxel", population: 74707 },
  { name: "Lüdenscheid", slug: "luedenscheid", population: 72000 },
  { name: "Dinslaken", slug: "dinslaken", population: 70368 },
  { name: "Herten", slug: "herten", population: 62261 },
  { name: "Kerpen", slug: "kerpen", population: 67803 },
  { name: "Dormagen", slug: "dormagen", population: 65321 },
  { name: "Grevenbroich", slug: "grevenbroich", population: 64850 },
  { name: "Bergheim", slug: "bergheim", population: 64182 },
  { name: "Lippstadt", slug: "lippstadt", population: 72068 },
  { name: "Unna", slug: "unna", population: 59597 },
  { name: "Herford", slug: "herford", population: 67089 },
  { name: "Sankt Augustin", slug: "sanktaugustin", population: 57062 },

  // ---------------------------------------------------------------------------
  // Rheinland-Pfalz (Rhineland-Palatinate)
  // ---------------------------------------------------------------------------
  { name: "Mainz", slug: "mainz", population: 220552 },
  {
    name: "Ludwigshafen am Rhein",
    slug: "ludwigshafenamrhein",
    population: 172557,
  },
  { name: "Koblenz", slug: "koblenz", population: 114052 },
  { name: "Trier", slug: "trier", population: 111580 },
  { name: "Kaiserslautern", slug: "kaiserslautern", population: 103520 },
  { name: "Worms", slug: "worms", population: 85260 },
  {
    name: "Neustadt an der Weinstraße",
    slug: "neustadtanderweinstrasse",
    population: 53260,
  },
  { name: "Speyer", slug: "speyer", population: 51010 },
  { name: "Bad Kreuznach", slug: "badkreuznach", population: 52065 },
  { name: "Frankenthal (Pfalz)", slug: "frankenthalpfalz", population: 49050 },

  // ---------------------------------------------------------------------------
  // Saarland
  // ---------------------------------------------------------------------------
  { name: "Saarbrücken", slug: "saarbruecken", population: 180741 },
  { name: "Neunkirchen", slug: "neunkirchen", population: 47172 },
  { name: "Homburg", slug: "homburg", population: 42978 },
  { name: "Völklingen", slug: "voelklingen", population: 39810 },
  { name: "Sankt Ingbert", slug: "sanktingbert", population: 36345 },

  // ---------------------------------------------------------------------------
  // Sachsen (Saxony)
  // ---------------------------------------------------------------------------
  { name: "Leipzig", slug: "leipzig", population: 616093 },
  { name: "Dresden", slug: "dresden", population: 563011 },
  { name: "Chemnitz", slug: "chemnitz", population: 249922 },
  { name: "Zwickau", slug: "zwickau", population: 88515 },
  { name: "Plauen", slug: "plauen", population: 64814 },
  { name: "Görlitz", slug: "goerlitz", population: 56780 },
  { name: "Freiberg", slug: "freiberg", population: 40810 },
  { name: "Bautzen", slug: "bautzen", population: 39429 },

  // ---------------------------------------------------------------------------
  // Sachsen-Anhalt (Saxony-Anhalt)
  // ---------------------------------------------------------------------------
  { name: "Halle (Saale)", slug: "hallesaale", population: 242083 },
  { name: "Magdeburg", slug: "magdeburg", population: 239364 },
  { name: "Dessau-Roßlau", slug: "dessaurosslau", population: 81237 },
  { name: "Halberstadt", slug: "halberstadt", population: 39998 },
  { name: "Stendal", slug: "stendal", population: 39167 },
  { name: "Wittenberg", slug: "wittenberg", population: 46379 },

  // ---------------------------------------------------------------------------
  // Schleswig-Holstein
  // ---------------------------------------------------------------------------
  { name: "Kiel", slug: "kiel", population: 249023 },
  { name: "Lübeck", slug: "luebeck", population: 217198 },
  { name: "Flensburg", slug: "flensburg", population: 91660 },
  { name: "Neumünster", slug: "neumuenster", population: 81884 },
  { name: "Norderstedt", slug: "norderstedt", population: 80502 },
  { name: "Elmshorn", slug: "elmshorn", population: 52690 },

  // ---------------------------------------------------------------------------
  // Thüringen (Thuringia)
  // ---------------------------------------------------------------------------
  { name: "Erfurt", slug: "erfurt", population: 214969 },
  { name: "Jena", slug: "jena", population: 111407 },
  { name: "Gera", slug: "gera", population: 93125 },
  { name: "Weimar", slug: "weimar", population: 65228 },
  { name: "Gotha", slug: "gotha", population: 46316 },
  { name: "Eisenach", slug: "eisenach", population: 42370 },
  { name: "Suhl", slug: "suhl", population: 36789 },
  { name: "Nordhausen", slug: "nordhausen", population: 42220 },
  { name: "Altenburg", slug: "altenburg", population: 31704 },
];

// =============================================================================
// SWEDEN - 290 municipalities (kommuner) grouped by county (län)
// Population figures: approximate 2023/2024
// Slug rules: lowercase, remove diacritics (ä→a, ö→o, å→a, é→e),
//             remove spaces and hyphens
// URL pattern: https://www.{slug}.se/kommun-och-politik/protokoll
// =============================================================================

export const SE_MUNICIPALITIES: Municipality[] = [
  // ---------------------------------------------------------------------------
  // Stockholms län (26 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Botkyrka", slug: "botkyrka", population: 94920 },
  { name: "Danderyd", slug: "danderyd", population: 33430 },
  { name: "Ekerö", slug: "ekero", population: 28870 },
  { name: "Haninge", slug: "haninge", population: 96100 },
  { name: "Huddinge", slug: "huddinge", population: 115590 },
  { name: "Järfälla", slug: "jarfalla", population: 81760 },
  { name: "Lidingö", slug: "lidingo", population: 48830 },
  { name: "Nacka", slug: "nacka", population: 107160 },
  { name: "Norrtälje", slug: "norrtalje", population: 65310 },
  { name: "Nykvarn", slug: "nykvarn", population: 12340 },
  { name: "Nynäshamn", slug: "nynashamn", population: 29560 },
  { name: "Salem", slug: "salem", population: 17350 },
  { name: "Sigtuna", slug: "sigtuna", population: 50560 },
  { name: "Sollentuna", slug: "sollentuna", population: 76130 },
  { name: "Solna", slug: "solna", population: 85560 },
  { name: "Stockholm", slug: "stockholm", population: 984000 },
  { name: "Sundbyberg", slug: "sundbyberg", population: 55070 },
  { name: "Södertälje", slug: "sodertalje", population: 104490 },
  { name: "Tyresö", slug: "tyreso", population: 49470 },
  { name: "Täby", slug: "taby", population: 73730 },
  { name: "Upplands Väsby", slug: "upplandsvasby", population: 48050 },
  { name: "Upplands-Bro", slug: "upplandsbro", population: 30250 },
  { name: "Vallentuna", slug: "vallentuna", population: 35350 },
  { name: "Vaxholm", slug: "vaxholm", population: 12510 },
  { name: "Värmdö", slug: "varmdo", population: 46760 },
  { name: "Österåker", slug: "osteraker", population: 47280 },

  // ---------------------------------------------------------------------------
  // Uppsala län (8 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Enköping", slug: "enkoping", population: 48130 },
  { name: "Heby", slug: "heby", population: 14010 },
  { name: "Håbo", slug: "habo", population: 22420 },
  { name: "Knivsta", slug: "knivsta", population: 20340 },
  { name: "Tierp", slug: "tierp", population: 21170 },
  { name: "Uppsala", slug: "uppsala", population: 237000 },
  { name: "Älvkarleby", slug: "alvkarleby", population: 9540 },
  { name: "Östhammar", slug: "osthammar", population: 22590 },

  // ---------------------------------------------------------------------------
  // Södermanlands län (9 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Eskilstuna", slug: "eskilstuna", population: 107480 },
  { name: "Flen", slug: "flen", population: 16730 },
  { name: "Gnesta", slug: "gnesta", population: 11460 },
  { name: "Katrineholm", slug: "katrineholm", population: 35400 },
  { name: "Nyköping", slug: "nykoping", population: 57480 },
  { name: "Oxelösund", slug: "oxelosund", population: 12200 },
  { name: "Strängnäs", slug: "strangnas", population: 37180 },
  { name: "Trosa", slug: "trosa", population: 13490 },
  { name: "Vingåker", slug: "vingaker", population: 8930 },

  // ---------------------------------------------------------------------------
  // Östergötlands län (13 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Boxholm", slug: "boxholm", population: 5480 },
  { name: "Finspång", slug: "finspang", population: 22020 },
  { name: "Kinda", slug: "kinda", population: 10030 },
  { name: "Linköping", slug: "linkoping", population: 167000 },
  { name: "Mjölby", slug: "mjolby", population: 28020 },
  { name: "Motala", slug: "motala", population: 44070 },
  { name: "Norrköping", slug: "norrkoping", population: 144700 },
  { name: "Söderköping", slug: "soderkoping", population: 15170 },
  { name: "Vadstena", slug: "vadstena", population: 7360 },
  { name: "Valdemarsvik", slug: "valdemarsvik", population: 7750 },
  { name: "Ydre", slug: "ydre", population: 3700 },
  { name: "Åtvidaberg", slug: "atvidaberg", population: 11560 },
  { name: "Ödeshög", slug: "odeshog", population: 5420 },

  // ---------------------------------------------------------------------------
  // Jönköpings län (13 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Aneby", slug: "aneby", population: 6870 },
  { name: "Eksjö", slug: "eksjo", population: 17310 },
  { name: "Gislaved", slug: "gislaved", population: 30440 },
  { name: "Gnosjö", slug: "gnosjo", population: 10310 },
  { name: "Habo", slug: "habo", population: 12700 },
  { name: "Jönköping", slug: "jonkoping", population: 144700 },
  { name: "Mullsjö", slug: "mullsjo", population: 7290 },
  { name: "Nässjö", slug: "nassjo", population: 32280 },
  { name: "Sävsjö", slug: "savsjo", population: 11670 },
  { name: "Tranås", slug: "tranas", population: 18860 },
  { name: "Vaggeryd", slug: "vaggeryd", population: 14270 },
  { name: "Vetlanda", slug: "vetlanda", population: 27640 },
  { name: "Värnamo", slug: "varnamo", population: 35020 },

  // ---------------------------------------------------------------------------
  // Kronobergs län (8 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Alvesta", slug: "alvesta", population: 20290 },
  { name: "Lessebo", slug: "lessebo", population: 8630 },
  { name: "Ljungby", slug: "ljungby", population: 28740 },
  { name: "Markaryd", slug: "markaryd", population: 10060 },
  { name: "Tingsryd", slug: "tingsryd", population: 12150 },
  { name: "Uppvidinge", slug: "uppvidinge", population: 9340 },
  { name: "Växjö", slug: "vaxjo", population: 96100 },
  { name: "Älmhult", slug: "almhult", population: 17160 },

  // ---------------------------------------------------------------------------
  // Kalmar län (12 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Borgholm", slug: "borgholm", population: 11010 },
  { name: "Emmaboda", slug: "emmaboda", population: 9280 },
  { name: "Hultsfred", slug: "hultsfred", population: 14110 },
  { name: "Högsby", slug: "hogsby", population: 5920 },
  { name: "Kalmar", slug: "kalmar", population: 72540 },
  { name: "Mönsterås", slug: "monsteras", population: 13530 },
  { name: "Mörbylånga", slug: "morbylanga", population: 15670 },
  { name: "Nybro", slug: "nybro", population: 20360 },
  { name: "Oskarshamn", slug: "oskarshamn", population: 27280 },
  { name: "Torsås", slug: "torsas", population: 7200 },
  { name: "Vimmerby", slug: "vimmerby", population: 15740 },
  { name: "Västervik", slug: "vastervik", population: 37110 },

  // ---------------------------------------------------------------------------
  // Gotlands län (1 municipality)
  // ---------------------------------------------------------------------------
  { name: "Gotland", slug: "gotland", population: 60700 },

  // ---------------------------------------------------------------------------
  // Blekinge län (5 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Karlshamn", slug: "karlshamn", population: 32670 },
  { name: "Karlskrona", slug: "karlskrona", population: 66790 },
  { name: "Olofström", slug: "olofstrom", population: 13330 },
  { name: "Ronneby", slug: "ronneby", population: 29410 },
  { name: "Sölvesborg", slug: "solvesborg", population: 17960 },

  // ---------------------------------------------------------------------------
  // Skåne län (33 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Bjuv", slug: "bjuv", population: 16430 },
  { name: "Bromölla", slug: "bromolla", population: 12930 },
  { name: "Burlöv", slug: "burlov", population: 20030 },
  { name: "Båstad", slug: "bastad", population: 15470 },
  { name: "Eslöv", slug: "eslov", population: 35070 },
  { name: "Helsingborg", slug: "helsingborg", population: 150880 },
  { name: "Hässleholm", slug: "hassleholm", population: 52950 },
  { name: "Höganäs", slug: "hoganas", population: 27770 },
  { name: "Hörby", slug: "horby", population: 15680 },
  { name: "Höör", slug: "hoor", population: 17050 },
  { name: "Klippan", slug: "klippan", population: 17700 },
  { name: "Kristianstad", slug: "kristianstad", population: 86960 },
  { name: "Kävlinge", slug: "kavlinge", population: 33290 },
  { name: "Landskrona", slug: "landskrona", population: 47610 },
  { name: "Lomma", slug: "lomma", population: 25770 },
  { name: "Lund", slug: "lund", population: 127570 },
  { name: "Malmö", slug: "malmo", population: 352930 },
  { name: "Osby", slug: "osby", population: 13510 },
  { name: "Perstorp", slug: "perstorp", population: 7430 },
  { name: "Simrishamn", slug: "simrishamn", population: 19320 },
  { name: "Sjöbo", slug: "sjobo", population: 19610 },
  { name: "Skurup", slug: "skurup", population: 16330 },
  { name: "Staffanstorp", slug: "staffanstorp", population: 25690 },
  { name: "Svalöv", slug: "svalov", population: 14630 },
  { name: "Svedala", slug: "svedala", population: 22480 },
  { name: "Tomelilla", slug: "tomelilla", population: 13750 },
  { name: "Trelleborg", slug: "trelleborg", population: 46140 },
  { name: "Vellinge", slug: "vellinge", population: 37960 },
  { name: "Ystad", slug: "ystad", population: 30820 },
  { name: "Åstorp", slug: "astorp", population: 16480 },
  { name: "Ängelholm", slug: "angelholm", population: 43750 },
  { name: "Örkelljunga", slug: "orkelljunga", population: 10270 },
  { name: "Östra Göinge", slug: "ostragoinge", population: 14810 },

  // ---------------------------------------------------------------------------
  // Hallands län (6 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Falkenberg", slug: "falkenberg", population: 46080 },
  { name: "Halmstad", slug: "halmstad", population: 105160 },
  { name: "Hylte", slug: "hylte", population: 10780 },
  { name: "Kungsbacka", slug: "kungsbacka", population: 84580 },
  { name: "Laholm", slug: "laholm", population: 25370 },
  { name: "Varberg", slug: "varberg", population: 66840 },

  // ---------------------------------------------------------------------------
  // Västra Götalands län (49 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Ale", slug: "ale", population: 32540 },
  { name: "Alingsås", slug: "alingsas", population: 42570 },
  { name: "Bengtsfors", slug: "bengtsfors", population: 9580 },
  { name: "Bollebygd", slug: "bollebygd", population: 9680 },
  { name: "Borås", slug: "boras", population: 114420 },
  { name: "Dals-Ed", slug: "dalsed", population: 4930 },
  { name: "Essunga", slug: "essunga", population: 5830 },
  { name: "Falköping", slug: "falkoping", population: 33560 },
  { name: "Färgelanda", slug: "fargelanda", population: 6860 },
  { name: "Grästorp", slug: "grastorp", population: 5830 },
  { name: "Gullspång", slug: "gullspang", population: 5190 },
  { name: "Göteborg", slug: "goteborg", population: 590000 },
  { name: "Götene", slug: "gotene", population: 13670 },
  { name: "Herrljunga", slug: "herrljunga", population: 9770 },
  { name: "Hjo", slug: "hjo", population: 9400 },
  { name: "Härryda", slug: "harryda", population: 40440 },
  { name: "Karlsborg", slug: "karlsborg", population: 7050 },
  { name: "Kungälv", slug: "kungalv", population: 49060 },
  { name: "Lerum", slug: "lerum", population: 43310 },
  { name: "Lidköping", slug: "lidkoping", population: 40230 },
  { name: "Lilla Edet", slug: "lillaedet", population: 13890 },
  { name: "Lysekil", slug: "lysekil", population: 14700 },
  { name: "Mariestad", slug: "mariestad", population: 24950 },
  { name: "Mark", slug: "mark", population: 35340 },
  { name: "Mellerud", slug: "mellerud", population: 9240 },
  { name: "Munkedal", slug: "munkedal", population: 10650 },
  { name: "Mölndal", slug: "molndal", population: 69730 },
  { name: "Orust", slug: "orust", population: 15660 },
  { name: "Partille", slug: "partille", population: 39640 },
  { name: "Skara", slug: "skara", population: 19040 },
  { name: "Skövde", slug: "skovde", population: 57550 },
  { name: "Sotenäs", slug: "sotenas", population: 9280 },
  { name: "Stenungsund", slug: "stenungsund", population: 27470 },
  { name: "Strömstad", slug: "stromstad", population: 13530 },
  { name: "Svenljunga", slug: "svenljunga", population: 11220 },
  { name: "Tanum", slug: "tanum", population: 13010 },
  { name: "Tibro", slug: "tibro", population: 11100 },
  { name: "Tidaholm", slug: "tidaholm", population: 12640 },
  { name: "Tjörn", slug: "tjorn", population: 16050 },
  { name: "Tranemo", slug: "tranemo", population: 11800 },
  { name: "Trollhättan", slug: "trollhattan", population: 59920 },
  { name: "Töreboda", slug: "toreboda", population: 9080 },
  { name: "Uddevalla", slug: "uddevalla", population: 57250 },
  { name: "Ulricehamn", slug: "ulricehamn", population: 25310 },
  { name: "Vara", slug: "vara", population: 16080 },
  { name: "Vårgårda", slug: "vargarda", population: 11810 },
  { name: "Vänersborg", slug: "vanersborg", population: 40450 },
  { name: "Åmål", slug: "amal", population: 12440 },
  { name: "Öckerö", slug: "ockero", population: 12800 },

  // ---------------------------------------------------------------------------
  // Värmlands län (16 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Arvika", slug: "arvika", population: 26010 },
  { name: "Eda", slug: "eda", population: 8620 },
  { name: "Filipstad", slug: "filipstad", population: 10580 },
  { name: "Forshaga", slug: "forshaga", population: 11600 },
  { name: "Grums", slug: "grums", population: 9130 },
  { name: "Hagfors", slug: "hagfors", population: 11640 },
  { name: "Hammarö", slug: "hammaro", population: 16450 },
  { name: "Karlstad", slug: "karlstad", population: 96600 },
  { name: "Kil", slug: "kil", population: 12140 },
  { name: "Kristinehamn", slug: "kristinehamn", population: 24830 },
  { name: "Munkfors", slug: "munkfors", population: 3680 },
  { name: "Storfors", slug: "storfors", population: 3910 },
  { name: "Sunne", slug: "sunne", population: 13120 },
  { name: "Säffle", slug: "saffle", population: 15340 },
  { name: "Torsby", slug: "torsby", population: 11640 },
  { name: "Årjäng", slug: "arjang", population: 10060 },

  // ---------------------------------------------------------------------------
  // Örebro län (12 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Askersund", slug: "askersund", population: 11290 },
  { name: "Degerfors", slug: "degerfors", population: 9450 },
  { name: "Hallsberg", slug: "hallsberg", population: 16150 },
  { name: "Hällefors", slug: "hallefors", population: 6870 },
  { name: "Karlskoga", slug: "karlskoga", population: 31190 },
  { name: "Kumla", slug: "kumla", population: 22370 },
  { name: "Laxå", slug: "laxa", population: 5660 },
  { name: "Lekeberg", slug: "lekeberg", population: 8130 },
  { name: "Lindesberg", slug: "lindesberg", population: 23800 },
  { name: "Ljusnarsberg", slug: "ljusnarsberg", population: 4870 },
  { name: "Nora", slug: "nora", population: 10970 },
  { name: "Örebro", slug: "orebro", population: 157700 },

  // ---------------------------------------------------------------------------
  // Västmanlands län (10 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Arboga", slug: "arboga", population: 14050 },
  { name: "Fagersta", slug: "fagersta", population: 13540 },
  { name: "Hallstahammar", slug: "hallstahammar", population: 16460 },
  { name: "Kungsör", slug: "kungsor", population: 8560 },
  { name: "Köping", slug: "koping", population: 26260 },
  { name: "Norberg", slug: "norberg", population: 5840 },
  { name: "Sala", slug: "sala", population: 22580 },
  { name: "Skinnskatteberg", slug: "skinnskatteberg", population: 4360 },
  { name: "Surahammar", slug: "surahammar", population: 10110 },
  { name: "Västerås", slug: "vasteras", population: 156500 },

  // ---------------------------------------------------------------------------
  // Dalarnas län (15 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Avesta", slug: "avesta", population: 22770 },
  { name: "Borlänge", slug: "borlange", population: 52880 },
  { name: "Falun", slug: "falun", population: 59560 },
  { name: "Gagnef", slug: "gagnef", population: 10330 },
  { name: "Hedemora", slug: "hedemora", population: 15370 },
  { name: "Leksand", slug: "leksand", population: 15860 },
  { name: "Ludvika", slug: "ludvika", population: 27130 },
  { name: "Malung-Sälen", slug: "malungsalen", population: 10210 },
  { name: "Mora", slug: "mora", population: 20580 },
  { name: "Orsa", slug: "orsa", population: 7010 },
  { name: "Rättvik", slug: "rattvik", population: 11050 },
  { name: "Smedjebacken", slug: "smedjebacken", population: 10850 },
  { name: "Säter", slug: "sater", population: 11280 },
  { name: "Vansbro", slug: "vansbro", population: 6850 },
  { name: "Älvdalen", slug: "alvdalen", population: 7130 },

  // ---------------------------------------------------------------------------
  // Gävleborgs län (10 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Bollnäs", slug: "bollnas", population: 27550 },
  { name: "Gävle", slug: "gavle", population: 103670 },
  { name: "Hofors", slug: "hofors", population: 9380 },
  { name: "Hudiksvall", slug: "hudiksvall", population: 37600 },
  { name: "Ljusdal", slug: "ljusdal", population: 18860 },
  { name: "Nordanstig", slug: "nordanstig", population: 9390 },
  { name: "Ockelbo", slug: "ockelbo", population: 5950 },
  { name: "Ovanåker", slug: "ovanaker", population: 11640 },
  { name: "Sandviken", slug: "sandviken", population: 39460 },
  { name: "Söderhamn", slug: "soderhamn", population: 25490 },

  // ---------------------------------------------------------------------------
  // Västernorrlands län (7 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Härnösand", slug: "harnosand", population: 25430 },
  { name: "Kramfors", slug: "kramfors", population: 18140 },
  { name: "Sollefteå", slug: "solleftea", population: 19630 },
  { name: "Sundsvall", slug: "sundsvall", population: 100060 },
  { name: "Timrå", slug: "timra", population: 18620 },
  { name: "Ånge", slug: "ange", population: 9660 },
  { name: "Örnsköldsvik", slug: "ornskoldsvik", population: 56120 },

  // ---------------------------------------------------------------------------
  // Jämtlands län (8 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Berg", slug: "berg", population: 7140 },
  { name: "Bräcke", slug: "bracke", population: 6480 },
  { name: "Härjedalen", slug: "harjedalen", population: 10210 },
  { name: "Krokom", slug: "krokom", population: 15080 },
  { name: "Ragunda", slug: "ragunda", population: 5280 },
  { name: "Strömsund", slug: "stromsund", population: 11490 },
  { name: "Åre", slug: "are", population: 12120 },
  { name: "Östersund", slug: "ostersund", population: 64470 },

  // ---------------------------------------------------------------------------
  // Västerbottens län (15 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Bjurholm", slug: "bjurholm", population: 2410 },
  { name: "Dorotea", slug: "dorotea", population: 2540 },
  { name: "Lycksele", slug: "lycksele", population: 12480 },
  { name: "Malå", slug: "mala", population: 3160 },
  { name: "Nordmaling", slug: "nordmaling", population: 7210 },
  { name: "Norsjö", slug: "norsjo", population: 4060 },
  { name: "Robertsfors", slug: "robertsfors", population: 6690 },
  { name: "Skellefteå", slug: "skelleftea", population: 73530 },
  { name: "Sorsele", slug: "sorsele", population: 2530 },
  { name: "Storuman", slug: "storuman", population: 5870 },
  { name: "Umeå", slug: "umea", population: 130740 },
  { name: "Vilhelmina", slug: "vilhelmina", population: 6790 },
  { name: "Vindeln", slug: "vindeln", population: 5340 },
  { name: "Vännäs", slug: "vannas", population: 9060 },
  { name: "Åsele", slug: "asele", population: 2860 },

  // ---------------------------------------------------------------------------
  // Norrbottens län (14 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Arjeplog", slug: "arjeplog", population: 2870 },
  { name: "Arvidsjaur", slug: "arvidsjaur", population: 6370 },
  { name: "Boden", slug: "boden", population: 28480 },
  { name: "Gällivare", slug: "gallivare", population: 17470 },
  { name: "Haparanda", slug: "haparanda", population: 9700 },
  { name: "Jokkmokk", slug: "jokkmokk", population: 5120 },
  { name: "Kalix", slug: "kalix", population: 16060 },
  { name: "Kiruna", slug: "kiruna", population: 22620 },
  { name: "Luleå", slug: "lulea", population: 79620 },
  { name: "Pajala", slug: "pajala", population: 5960 },
  { name: "Piteå", slug: "pitea", population: 42860 },
  { name: "Älvsbyn", slug: "alvsbyn", population: 8130 },
  { name: "Överkalix", slug: "overkalix", population: 3250 },
  { name: "Övertorneå", slug: "overtornea", population: 4350 },
];

// =============================================================================
// NORWAY - 357 municipalities (kommuner) grouped by county (fylke)
// As of 2024 (15 counties after partial reversal of 2020 mergers)
// Population figures: approximate 2023/2024
// Slug rules: lowercase, ø→o, å→a, æ→ae, remove spaces
// URL pattern: https://www.{slug}.kommune.no/
// =============================================================================

export const NO_MUNICIPALITIES: Municipality[] = [
  // ---------------------------------------------------------------------------
  // Oslo (1 municipality — both county and municipality)
  // ---------------------------------------------------------------------------
  { name: "Oslo", slug: "oslo", population: 709037 },

  // ---------------------------------------------------------------------------
  // Akershus (21 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Asker", slug: "asker", population: 96220 },
  { name: "Aurskog-Høland", slug: "aurskogholand", population: 17140 },
  { name: "Bærum", slug: "baerum", population: 130800 },
  { name: "Eidsvoll", slug: "eidsvoll", population: 26300 },
  { name: "Enebakk", slug: "enebakk", population: 11530 },
  { name: "Frogn", slug: "frogn", population: 16100 },
  { name: "Gjerdrum", slug: "gjerdrum", population: 7350 },
  { name: "Hurdal", slug: "hurdal", population: 2940 },
  { name: "Jevnaker", slug: "jevnaker", population: 7210 },
  { name: "Lillestrøm", slug: "lillestrom", population: 89940 },
  { name: "Lunner", slug: "lunner", population: 9310 },
  { name: "Lørenskog", slug: "lorenskog", population: 44680 },
  { name: "Nannestad", slug: "nannestad", population: 14650 },
  { name: "Nes", slug: "nes-akershus", population: 23520 },
  { name: "Nesodden", slug: "nesodden", population: 20020 },
  { name: "Nittedal", slug: "nittedal", population: 25140 },
  { name: "Nordre Follo", slug: "nordrefollo", population: 62030 },
  { name: "Rælingen", slug: "raelingen", population: 19200 },
  { name: "Ullensaker", slug: "ullensaker", population: 42170 },
  { name: "Vestby", slug: "vestby", population: 18920 },
  { name: "Ås", slug: "as", population: 21280 },

  // ---------------------------------------------------------------------------
  // Østfold (12 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Aremark", slug: "aremark", population: 1410 },
  { name: "Fredrikstad", slug: "fredrikstad", population: 84020 },
  { name: "Halden", slug: "halden", population: 31620 },
  { name: "Hvaler", slug: "hvaler", population: 4880 },
  { name: "Indre Østfold", slug: "indreostfold", population: 47150 },
  { name: "Marker", slug: "marker", population: 3640 },
  { name: "Moss", slug: "moss", population: 50900 },
  { name: "Rakkestad", slug: "rakkestad", population: 8480 },
  { name: "Råde", slug: "rade", population: 7770 },
  { name: "Sarpsborg", slug: "sarpsborg", population: 58400 },
  { name: "Skiptvet", slug: "skiptvet", population: 3880 },
  { name: "Våler", slug: "valer-ostfold", population: 5790 },

  // ---------------------------------------------------------------------------
  // Buskerud (17 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Drammen", slug: "drammen", population: 103300 },
  { name: "Flå", slug: "fla", population: 1110 },
  { name: "Flesberg", slug: "flesberg", population: 2830 },
  { name: "Gol", slug: "gol", population: 4690 },
  { name: "Hemsedal", slug: "hemsedal", population: 2680 },
  { name: "Hol", slug: "hol", population: 4560 },
  { name: "Hole", slug: "hole", population: 7130 },
  { name: "Kongsberg", slug: "kongsberg", population: 28530 },
  { name: "Krødsherad", slug: "krodsherad", population: 2230 },
  { name: "Lier", slug: "lier", population: 27760 },
  { name: "Modum", slug: "modum", population: 14400 },
  { name: "Nesbyen", slug: "nesbyen", population: 3400 },
  { name: "Nore og Uvdal", slug: "noreoguvdal", population: 2520 },
  { name: "Ringerike", slug: "ringerike", population: 30790 },
  { name: "Rollag", slug: "rollag", population: 1430 },
  { name: "Sigdal", slug: "sigdal", population: 3550 },
  { name: "Øvre Eiker", slug: "ovreeiker", population: 19800 },

  // ---------------------------------------------------------------------------
  // Vestfold (6 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Færder", slug: "faerder", population: 27520 },
  { name: "Holmestrand", slug: "holmestrand", population: 25690 },
  { name: "Horten", slug: "horten", population: 27860 },
  { name: "Larvik", slug: "larvik", population: 47870 },
  { name: "Sandefjord", slug: "sandefjord", population: 66510 },
  { name: "Tønsberg", slug: "tonsberg", population: 57770 },

  // ---------------------------------------------------------------------------
  // Telemark (17 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Bamble", slug: "bamble", population: 14120 },
  { name: "Drangedal", slug: "drangedal", population: 4070 },
  { name: "Fyresdal", slug: "fyresdal", population: 1290 },
  { name: "Hjartdal", slug: "hjartdal", population: 1610 },
  { name: "Kragerø", slug: "kragero", population: 10480 },
  { name: "Kviteseid", slug: "kviteseid", population: 2480 },
  { name: "Midt-Telemark", slug: "midttelemark", population: 10930 },
  { name: "Nissedal", slug: "nissedal", population: 1480 },
  { name: "Nome", slug: "nome", population: 6560 },
  { name: "Notodden", slug: "notodden", population: 12970 },
  { name: "Porsgrunn", slug: "porsgrunn", population: 37140 },
  { name: "Seljord", slug: "seljord", population: 2930 },
  { name: "Siljan", slug: "siljan", population: 2370 },
  { name: "Skien", slug: "skien", population: 55670 },
  { name: "Tinn", slug: "tinn", population: 5660 },
  { name: "Tokke", slug: "tokke", population: 2190 },
  { name: "Vinje", slug: "vinje", population: 3740 },

  // ---------------------------------------------------------------------------
  // Innlandet (46 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Alvdal", slug: "alvdal", population: 2490 },
  { name: "Dovre", slug: "dovre", population: 2600 },
  { name: "Eidskog", slug: "eidskog", population: 6160 },
  { name: "Elverum", slug: "elverum", population: 21530 },
  { name: "Engerdal", slug: "engerdal", population: 1300 },
  { name: "Etnedal", slug: "etnedal", population: 1260 },
  { name: "Folldal", slug: "folldal", population: 1550 },
  { name: "Gausdal", slug: "gausdal", population: 6050 },
  { name: "Gjøvik", slug: "gjovik", population: 30530 },
  { name: "Gran", slug: "gran", population: 13860 },
  { name: "Grue", slug: "grue", population: 4680 },
  { name: "Hamar", slug: "hamar", population: 32450 },
  { name: "Kongsvinger", slug: "kongsvinger", population: 18170 },
  { name: "Lesja", slug: "lesja", population: 1990 },
  { name: "Lillehammer", slug: "lillehammer", population: 28740 },
  { name: "Lom", slug: "lom", population: 2260 },
  { name: "Løten", slug: "loten", population: 7900 },
  { name: "Nord-Aurdal", slug: "nordaurdal", population: 6470 },
  { name: "Nord-Fron", slug: "nordfron", population: 5780 },
  { name: "Nord-Odal", slug: "nordodal", population: 5070 },
  { name: "Nordre Land", slug: "nordreland", population: 6700 },
  { name: "Os", slug: "os-innlandet", population: 1930 },
  { name: "Rendalen", slug: "rendalen", population: 1760 },
  { name: "Ringebu", slug: "ringebu", population: 4330 },
  { name: "Ringsaker", slug: "ringsaker", population: 34750 },
  { name: "Sel", slug: "sel", population: 5710 },
  { name: "Skjåk", slug: "skjak", population: 2190 },
  { name: "Stange", slug: "stange", population: 21080 },
  { name: "Stor-Elvdal", slug: "storelvdal", population: 2360 },
  { name: "Søndre Land", slug: "sondreland", population: 5670 },
  { name: "Sør-Aurdal", slug: "soraurdal", population: 2960 },
  { name: "Sør-Fron", slug: "sorfron", population: 3180 },
  { name: "Sør-Odal", slug: "sorodal", population: 8020 },
  { name: "Tolga", slug: "tolga", population: 1580 },
  { name: "Trysil", slug: "trysil", population: 6500 },
  { name: "Tynset", slug: "tynset", population: 5600 },
  { name: "Vang", slug: "vang", population: 1670 },
  { name: "Vestre Slidre", slug: "vestreslidre", population: 2110 },
  { name: "Vestre Toten", slug: "vestretoten", population: 13550 },
  { name: "Våler", slug: "valer-innlandet", population: 3740 },
  { name: "Vågå", slug: "vaga", population: 3620 },
  { name: "Østre Toten", slug: "ostretoten", population: 14980 },
  { name: "Øyer", slug: "oyer", population: 5270 },
  { name: "Øystre Slidre", slug: "oystreslidre", population: 2230 },
  { name: "Åmot", slug: "amot", population: 4320 },
  { name: "Åsnes", slug: "asnes", population: 7320 },

  // ---------------------------------------------------------------------------
  // Agder (25 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Arendal", slug: "arendal", population: 45910 },
  { name: "Birkenes", slug: "birkenes", population: 5360 },
  { name: "Bygland", slug: "bygland", population: 1200 },
  { name: "Bykle", slug: "bykle", population: 970 },
  { name: "Evje og Hornnes", slug: "evjeoghornnes", population: 3700 },
  { name: "Farsund", slug: "farsund", population: 9720 },
  { name: "Flekkefjord", slug: "flekkefjord", population: 9370 },
  { name: "Froland", slug: "froland", population: 6020 },
  { name: "Gjerstad", slug: "gjerstad", population: 2430 },
  { name: "Grimstad", slug: "grimstad", population: 23930 },
  { name: "Hægebostad", slug: "haegebostad", population: 1750 },
  { name: "Iveland", slug: "iveland", population: 1350 },
  { name: "Kristiansand", slug: "kristiansand", population: 115590 },
  { name: "Kvinesdal", slug: "kvinesdal", population: 6100 },
  { name: "Lillesand", slug: "lillesand", population: 11200 },
  { name: "Lindesnes", slug: "lindesnes", population: 23220 },
  { name: "Lyngdal", slug: "lyngdal", population: 10690 },
  { name: "Risør", slug: "risor", population: 6740 },
  { name: "Sirdal", slug: "sirdal", population: 1880 },
  { name: "Tvedestrand", slug: "tvedestrand", population: 6180 },
  { name: "Valle", slug: "valle", population: 1170 },
  { name: "Vegårshei", slug: "vegarshei", population: 2090 },
  { name: "Vennesla", slug: "vennesla", population: 15040 },
  { name: "Åmli", slug: "amli", population: 1840 },
  { name: "Åseral", slug: "aseral", population: 940 },

  // ---------------------------------------------------------------------------
  // Rogaland (23 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Bjerkreim", slug: "bjerkreim", population: 2840 },
  { name: "Bokn", slug: "bokn", population: 870 },
  { name: "Eigersund", slug: "eigersund", population: 15160 },
  { name: "Gjesdal", slug: "gjesdal", population: 12560 },
  { name: "Haugesund", slug: "haugesund", population: 37900 },
  { name: "Hjelmeland", slug: "hjelmeland", population: 2620 },
  { name: "Hå", slug: "ha", population: 19000 },
  { name: "Karmøy", slug: "karmoy", population: 42360 },
  { name: "Klepp", slug: "klepp", population: 20060 },
  { name: "Kvitsøy", slug: "kvitsoy", population: 530 },
  { name: "Lund", slug: "lund-rogaland", population: 3360 },
  { name: "Randaberg", slug: "randaberg", population: 11720 },
  { name: "Sandnes", slug: "sandnes", population: 82870 },
  { name: "Sauda", slug: "sauda", population: 4580 },
  { name: "Sokndal", slug: "sokndal", population: 3330 },
  { name: "Sola", slug: "sola", population: 28620 },
  { name: "Stavanger", slug: "stavanger", population: 144700 },
  { name: "Strand", slug: "strand", population: 13080 },
  { name: "Suldal", slug: "suldal", population: 3870 },
  { name: "Time", slug: "time", population: 19580 },
  { name: "Tysvær", slug: "tysvaer", population: 11510 },
  { name: "Utsira", slug: "utsira", population: 190 },
  { name: "Vindafjord", slug: "vindafjord", population: 8730 },

  // ---------------------------------------------------------------------------
  // Vestland (43 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Alver", slug: "alver", population: 30610 },
  { name: "Askvoll", slug: "askvoll", population: 3020 },
  { name: "Askøy", slug: "askoy", population: 30000 },
  { name: "Aurland", slug: "aurland", population: 1820 },
  { name: "Austevoll", slug: "austevoll", population: 5470 },
  { name: "Austrheim", slug: "austrheim", population: 2930 },
  { name: "Bergen", slug: "bergen", population: 289330 },
  { name: "Bjørnafjorden", slug: "bjornafjorden", population: 25690 },
  { name: "Bremanger", slug: "bremanger", population: 3530 },
  { name: "Bømlo", slug: "bomlo", population: 12160 },
  { name: "Eidfjord", slug: "eidfjord", population: 940 },
  { name: "Etne", slug: "etne", population: 4030 },
  { name: "Fedje", slug: "fedje", population: 560 },
  { name: "Fitjar", slug: "fitjar", population: 3200 },
  { name: "Fjaler", slug: "fjaler", population: 2840 },
  { name: "Gloppen", slug: "gloppen", population: 5880 },
  { name: "Gulen", slug: "gulen", population: 2310 },
  { name: "Hyllestad", slug: "hyllestad", population: 1380 },
  { name: "Høyanger", slug: "hoyanger", population: 4130 },
  { name: "Kinn", slug: "kinn", population: 17430 },
  { name: "Kvam", slug: "kvam", population: 8560 },
  { name: "Kvinnherad", slug: "kvinnherad", population: 13010 },
  { name: "Luster", slug: "luster", population: 5220 },
  { name: "Lærdal", slug: "laerdal", population: 2150 },
  { name: "Masfjorden", slug: "masfjorden", population: 1680 },
  { name: "Modalen", slug: "modalen", population: 390 },
  { name: "Osterøy", slug: "osteroy", population: 8290 },
  { name: "Samnanger", slug: "samnanger", population: 2510 },
  { name: "Sogndal", slug: "sogndal", population: 12010 },
  { name: "Solund", slug: "solund", population: 770 },
  { name: "Stad", slug: "stad", population: 9250 },
  { name: "Stord", slug: "stord", population: 19050 },
  { name: "Stryn", slug: "stryn", population: 7220 },
  { name: "Sunnfjord", slug: "sunnfjord", population: 22220 },
  { name: "Sveio", slug: "sveio", population: 5750 },
  { name: "Tysnes", slug: "tysnes", population: 2860 },
  { name: "Ullensvang", slug: "ullensvang", population: 11110 },
  { name: "Ulvik", slug: "ulvik", population: 1070 },
  { name: "Vaksdal", slug: "vaksdal", population: 3960 },
  { name: "Vik", slug: "vik", population: 2690 },
  { name: "Voss", slug: "voss", population: 16070 },
  { name: "Øygarden", slug: "oygarden", population: 40120 },
  { name: "Årdal", slug: "ardal", population: 5210 },

  // ---------------------------------------------------------------------------
  // Møre og Romsdal (26 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Aukra", slug: "aukra", population: 3470 },
  { name: "Aure", slug: "aure", population: 3520 },
  { name: "Averøy", slug: "averoy", population: 5810 },
  { name: "Fjord", slug: "fjord", population: 2580 },
  { name: "Giske", slug: "giske", population: 8470 },
  { name: "Gjemnes", slug: "gjemnes", population: 2670 },
  { name: "Hareid", slug: "hareid", population: 5230 },
  { name: "Herøy", slug: "heroy-moreogromsdal", population: 8900 },
  { name: "Hustadvika", slug: "hustadvika", population: 13310 },
  { name: "Kristiansund", slug: "kristiansund", population: 24400 },
  { name: "Molde", slug: "molde", population: 32600 },
  { name: "Rauma", slug: "rauma", population: 7490 },
  { name: "Sande", slug: "sande", population: 2510 },
  { name: "Smøla", slug: "smola", population: 2100 },
  { name: "Stranda", slug: "stranda", population: 4450 },
  { name: "Sula", slug: "sula", population: 9360 },
  { name: "Sunndal", slug: "sunndal", population: 7120 },
  { name: "Surnadal", slug: "surnadal", population: 5870 },
  { name: "Sykkylven", slug: "sykkylven", population: 7610 },
  { name: "Tingvoll", slug: "tingvoll", population: 3070 },
  { name: "Ulstein", slug: "ulstein", population: 8650 },
  { name: "Vanylven", slug: "vanylven", population: 3200 },
  { name: "Vestnes", slug: "vestnes", population: 7020 },
  { name: "Volda", slug: "volda", population: 10370 },
  { name: "Ålesund", slug: "alesund", population: 67400 },
  { name: "Ørsta", slug: "orsta", population: 10720 },

  // ---------------------------------------------------------------------------
  // Trøndelag (38 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Flatanger", slug: "flatanger", population: 1070 },
  { name: "Frosta", slug: "frosta", population: 2660 },
  { name: "Frøya", slug: "froya", population: 5160 },
  { name: "Grong", slug: "grong", population: 2440 },
  { name: "Heim", slug: "heim", population: 5880 },
  { name: "Hitra", slug: "hitra", population: 5070 },
  { name: "Holtålen", slug: "holtalen", population: 1990 },
  { name: "Høylandet", slug: "hoylandet", population: 1240 },
  { name: "Inderøy", slug: "inderoy", population: 6850 },
  { name: "Indre Fosen", slug: "indrefosen", population: 10070 },
  { name: "Leka", slug: "leka", population: 560 },
  { name: "Levanger", slug: "levanger", population: 20470 },
  { name: "Lierne", slug: "lierne", population: 1370 },
  { name: "Malvik", slug: "malvik", population: 14780 },
  { name: "Melhus", slug: "melhus", population: 17010 },
  { name: "Meråker", slug: "meraker", population: 2440 },
  { name: "Midtre Gauldal", slug: "midtregauldal", population: 6340 },
  { name: "Namsos", slug: "namsos", population: 15240 },
  { name: "Namsskogan", slug: "namsskogan", population: 870 },
  { name: "Nærøysund", slug: "naeroysund", population: 9510 },
  { name: "Oppdal", slug: "oppdal", population: 7170 },
  { name: "Orkland", slug: "orkland", population: 18590 },
  { name: "Osen", slug: "osen", population: 920 },
  { name: "Overhalla", slug: "overhalla", population: 3780 },
  { name: "Rennebu", slug: "rennebu", population: 2530 },
  { name: "Rindal", slug: "rindal", population: 2020 },
  { name: "Røros", slug: "roros", population: 5650 },
  { name: "Røyrvik", slug: "royrvik", population: 470 },
  { name: "Selbu", slug: "selbu", population: 4090 },
  { name: "Skaun", slug: "skaun", population: 8720 },
  { name: "Snåsa", slug: "snasa", population: 2110 },
  { name: "Steinkjer", slug: "steinkjer", population: 24200 },
  { name: "Stjørdal", slug: "stjordal", population: 24400 },
  { name: "Trondheim", slug: "trondheim", population: 212660 },
  { name: "Tydal", slug: "tydal", population: 790 },
  { name: "Verdal", slug: "verdal", population: 15390 },
  { name: "Ørland", slug: "orland", population: 10200 },
  { name: "Åfjord", slug: "afjord", population: 4160 },

  // ---------------------------------------------------------------------------
  // Nordland (41 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Alstahaug", slug: "alstahaug", population: 7380 },
  { name: "Andøy", slug: "andoy", population: 4700 },
  { name: "Beiarn", slug: "beiarn", population: 1020 },
  { name: "Bindal", slug: "bindal", population: 1430 },
  { name: "Bodø", slug: "bodo", population: 53210 },
  { name: "Brønnøy", slug: "bronnoy", population: 7910 },
  { name: "Bø", slug: "bo-nordland", population: 2530 },
  { name: "Dønna", slug: "donna", population: 1330 },
  { name: "Evenes", slug: "evenes", population: 1400 },
  { name: "Fauske", slug: "fauske", population: 9540 },
  { name: "Flakstad", slug: "flakstad", population: 1280 },
  { name: "Gildeskål", slug: "gildeskal", population: 1880 },
  { name: "Grane", slug: "grane", population: 1430 },
  { name: "Hadsel", slug: "hadsel", population: 8020 },
  { name: "Hamarøy", slug: "hamaroy", population: 2710 },
  { name: "Hemnes", slug: "hemnes", population: 4530 },
  { name: "Hattfjelldal", slug: "hattfjelldal", population: 1350 },
  { name: "Herøy", slug: "heroy-nordland", population: 1790 },
  { name: "Leirfjord", slug: "leirfjord", population: 2230 },
  { name: "Lurøy", slug: "luroy", population: 1860 },
  { name: "Lødingen", slug: "lodingen", population: 2040 },
  { name: "Meløy", slug: "meloy", population: 6290 },
  { name: "Moskenes", slug: "moskenes", population: 1010 },
  { name: "Narvik", slug: "narvik", population: 21260 },
  { name: "Nesna", slug: "nesna", population: 1790 },
  { name: "Rana", slug: "rana", population: 26350 },
  { name: "Rødøy", slug: "rodoy", population: 1190 },
  { name: "Røst", slug: "rost", population: 470 },
  { name: "Saltdal", slug: "saltdal", population: 4740 },
  { name: "Sortland", slug: "sortland", population: 10710 },
  { name: "Steigen", slug: "steigen", population: 2520 },
  { name: "Sømna", slug: "somna", population: 1950 },
  { name: "Sørfold", slug: "sorfold", population: 1890 },
  { name: "Træna", slug: "traena", population: 430 },
  { name: "Vefsn", slug: "vefsn", population: 13370 },
  { name: "Vega", slug: "vega", population: 1180 },
  { name: "Vestvågøy", slug: "vestvagoy", population: 11590 },
  { name: "Vevelstad", slug: "vevelstad", population: 470 },
  { name: "Vågan", slug: "vagan", population: 9710 },
  { name: "Værøy", slug: "vaeroy", population: 720 },
  { name: "Øksnes", slug: "oksnes", population: 4410 },

  // ---------------------------------------------------------------------------
  // Troms (21 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Balsfjord", slug: "balsfjord", population: 5580 },
  { name: "Bardu", slug: "bardu", population: 3800 },
  { name: "Dyrøy", slug: "dyroy", population: 1060 },
  { name: "Gratangen", slug: "gratangen", population: 1090 },
  { name: "Harstad", slug: "harstad", population: 24910 },
  { name: "Ibestad", slug: "ibestad", population: 1300 },
  { name: "Karlsøy", slug: "karlsoy", population: 2190 },
  { name: "Kvæfjord", slug: "kvaefjord", population: 2860 },
  { name: "Kvænangen", slug: "kvaenangen", population: 1160 },
  { name: "Kåfjord", slug: "kafjord", population: 2010 },
  { name: "Lavangen", slug: "lavangen", population: 980 },
  { name: "Lyngen", slug: "lyngen", population: 2810 },
  { name: "Målselv", slug: "malselv", population: 6630 },
  { name: "Nordreisa", slug: "nordreisa", population: 4890 },
  { name: "Salangen", slug: "salangen", population: 2140 },
  { name: "Senja", slug: "senja", population: 14680 },
  { name: "Skjervøy", slug: "skjervoy", population: 2830 },
  { name: "Storfjord", slug: "storfjord", population: 1860 },
  { name: "Sørreisa", slug: "sorreisa", population: 3440 },
  { name: "Tjeldsund", slug: "tjeldsund", population: 4240 },
  { name: "Tromsø", slug: "tromso", population: 78000 },

  // ---------------------------------------------------------------------------
  // Finnmark (18 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Alta", slug: "alta", population: 21150 },
  { name: "Berlevåg", slug: "berlevag", population: 920 },
  { name: "Båtsfjord", slug: "batsfjord", population: 2200 },
  { name: "Gamvik", slug: "gamvik", population: 1040 },
  { name: "Hammerfest", slug: "hammerfest", population: 11600 },
  { name: "Hasvik", slug: "hasvik", population: 990 },
  { name: "Karasjok", slug: "karasjok", population: 2600 },
  { name: "Kautokeino", slug: "kautokeino", population: 2880 },
  { name: "Lebesby", slug: "lebesby", population: 1230 },
  { name: "Loppa", slug: "loppa", population: 880 },
  { name: "Måsøy", slug: "masoy", population: 1170 },
  { name: "Nesseby", slug: "nesseby", population: 910 },
  { name: "Nordkapp", slug: "nordkapp", population: 3100 },
  { name: "Porsanger", slug: "porsanger", population: 3860 },
  { name: "Sør-Varanger", slug: "sorvaranger", population: 10120 },
  { name: "Tana", slug: "tana", population: 2870 },
  { name: "Vardø", slug: "vardo", population: 1990 },
  { name: "Vadsø", slug: "vadso", population: 5890 },
];

// =============================================================================
// DENMARK - 98 municipalities (kommuner) grouped by region
// Population figures: approximate 2023/2024
// Slug rules: lowercase, ø→o, å→a, æ→ae, remove spaces
// URL pattern: https://www.{slug}.dk/
// Note: Some Danish municipalities use abbreviated slugs for their domains
// =============================================================================

export const DK_MUNICIPALITIES: Municipality[] = [
  // ---------------------------------------------------------------------------
  // Region Hovedstaden (29 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Albertslund", slug: "albertslund", population: 28060 },
  { name: "Allerød", slug: "allerod", population: 26220 },
  { name: "Ballerup", slug: "ballerup", population: 49200 },
  { name: "Bornholm", slug: "brk", population: 39270 },
  { name: "Brøndby", slug: "brondby", population: 35570 },
  { name: "Dragør", slug: "dragoer", population: 14170 },
  { name: "Egedal", slug: "egedal", population: 44210 },
  { name: "Fredensborg", slug: "fredensborg", population: 41060 },
  { name: "Frederiksberg", slug: "frederiksberg", population: 104410 },
  { name: "Frederikssund", slug: "frederikssund", population: 46030 },
  { name: "Furesø", slug: "furesoe", population: 41290 },
  { name: "Gentofte", slug: "gentofte", population: 75940 },
  { name: "Gladsaxe", slug: "gladsaxe", population: 70100 },
  { name: "Glostrup", slug: "glostrup", population: 23260 },
  { name: "Gribskov", slug: "gribskov", population: 41530 },
  { name: "Halsnæs", slug: "halsnaes", population: 31340 },
  { name: "Helsingør", slug: "helsingor", population: 63010 },
  { name: "Herlev", slug: "herlev", population: 28920 },
  { name: "Hillerød", slug: "hillerod", population: 52240 },
  { name: "Hvidovre", slug: "hvidovre", population: 54120 },
  { name: "Høje-Taastrup", slug: "htk", population: 50220 },
  { name: "Hørsholm", slug: "horsholm", population: 25100 },
  { name: "Ishøj", slug: "ishoj", population: 23300 },
  { name: "København", slug: "kk", population: 644431 },
  { name: "Lyngby-Taarbæk", slug: "ltk", population: 56350 },
  { name: "Rudersdal", slug: "rudersdal", population: 57120 },
  { name: "Rødovre", slug: "rodovre", population: 41050 },
  { name: "Tårnby", slug: "taarnby", population: 43210 },
  { name: "Vallensbæk", slug: "vallensbaek", population: 16740 },

  // ---------------------------------------------------------------------------
  // Region Sjælland (17 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Faxe", slug: "faxe", population: 36790 },
  { name: "Greve", slug: "greve", population: 51400 },
  { name: "Guldborgsund", slug: "guldborgsund", population: 60170 },
  { name: "Holbæk", slug: "holbaek", population: 71930 },
  { name: "Kalundborg", slug: "kalundborg", population: 48890 },
  { name: "Køge", slug: "koege", population: 62050 },
  { name: "Lejre", slug: "lejre", population: 28620 },
  { name: "Lolland", slug: "lolland", population: 41170 },
  { name: "Næstved", slug: "naestved", population: 83900 },
  { name: "Odsherred", slug: "odsherred", population: 33250 },
  { name: "Ringsted", slug: "ringsted", population: 35360 },
  { name: "Roskilde", slug: "roskilde", population: 88860 },
  { name: "Slagelse", slug: "slagelse", population: 79580 },
  { name: "Solrød", slug: "solrod", population: 23530 },
  { name: "Sorø", slug: "soroe", population: 30220 },
  { name: "Stevns", slug: "stevns", population: 23250 },
  { name: "Vordingborg", slug: "vordingborg", population: 46100 },

  // ---------------------------------------------------------------------------
  // Region Syddanmark (22 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Assens", slug: "assens", population: 41270 },
  { name: "Billund", slug: "billund", population: 26870 },
  { name: "Esbjerg", slug: "esbjerg", population: 116050 },
  { name: "Fanø", slug: "fanoe", population: 3440 },
  { name: "Fredericia", slug: "fredericia", population: 52170 },
  { name: "Faaborg-Midtfyn", slug: "faaborgmidtfyn", population: 52060 },
  { name: "Haderslev", slug: "haderslev", population: 56200 },
  { name: "Kerteminde", slug: "kerteminde", population: 24210 },
  { name: "Kolding", slug: "kolding", population: 94530 },
  { name: "Langeland", slug: "langeland", population: 12240 },
  { name: "Middelfart", slug: "middelfart", population: 39340 },
  { name: "Nordfyns", slug: "nordfyns", population: 29520 },
  { name: "Nyborg", slug: "nyborg", population: 32340 },
  { name: "Odense", slug: "odense", population: 206580 },
  { name: "Svendborg", slug: "svendborg", population: 59070 },
  { name: "Sønderborg", slug: "sonderborg", population: 73820 },
  { name: "Tønder", slug: "tonder", population: 36910 },
  { name: "Varde", slug: "varde", population: 50730 },
  { name: "Vejen", slug: "vejen", population: 43270 },
  { name: "Vejle", slug: "vejle", population: 118490 },
  { name: "Ærø", slug: "aeroe", population: 5930 },
  { name: "Aabenraa", slug: "aabenraa", population: 59010 },

  // ---------------------------------------------------------------------------
  // Region Midtjylland (19 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Favrskov", slug: "favrskov", population: 49230 },
  { name: "Hedensted", slug: "hedensted", population: 47170 },
  { name: "Herning", slug: "herning", population: 90760 },
  { name: "Holstebro", slug: "holstebro", population: 59240 },
  { name: "Horsens", slug: "horsens", population: 93070 },
  { name: "Ikast-Brande", slug: "ikastbrande", population: 42050 },
  { name: "Lemvig", slug: "lemvig", population: 19840 },
  { name: "Norddjurs", slug: "norddjurs", population: 37490 },
  { name: "Odder", slug: "odder", population: 23340 },
  { name: "Randers", slug: "randers", population: 98890 },
  { name: "Ringkøbing-Skjern", slug: "rksk", population: 57140 },
  { name: "Samsø", slug: "samsoe", population: 3610 },
  { name: "Silkeborg", slug: "silkeborg", population: 94710 },
  { name: "Skanderborg", slug: "skanderborg", population: 63590 },
  { name: "Skive", slug: "skive", population: 46240 },
  { name: "Struer", slug: "struer", population: 21230 },
  { name: "Syddjurs", slug: "syddjurs", population: 43510 },
  { name: "Viborg", slug: "viborg", population: 98050 },
  { name: "Aarhus", slug: "aarhus", population: 357130 },

  // ---------------------------------------------------------------------------
  // Region Nordjylland (11 municipalities)
  // ---------------------------------------------------------------------------
  { name: "Aalborg", slug: "aalborg", population: 220100 },
  { name: "Brønderslev", slug: "bronderslev", population: 36730 },
  { name: "Frederikshavn", slug: "frederikshavn", population: 59990 },
  { name: "Hjørring", slug: "hjoerring", population: 64660 },
  { name: "Jammerbugt", slug: "jammerbugt", population: 38560 },
  { name: "Læsø", slug: "laesoe", population: 1810 },
  { name: "Mariagerfjord", slug: "mariagerfjord", population: 42390 },
  { name: "Morsø", slug: "morsoe", population: 20250 },
  { name: "Rebild", slug: "rebild", population: 30440 },
  { name: "Thisted", slug: "thisted", population: 43780 },
  { name: "Vesthimmerland", slug: "vesthimmerland", population: 36820 },
];
