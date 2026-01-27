import { db, municipalities, users, threads, threadTags, comments, clubs, clubMembers, clubThreads, rooms, roomMessages, places } from './index.js'
import { renderMarkdown } from '../utils/markdown.js'

async function seed() {
  console.log('🌱 Seeding database...')

  // Create municipalities with coordinates
  console.log('Creating municipalities...')
  const [tampere, helsinki, turku, oulu, espoo, _vantaa, _jyvaskyla, _kuopio, _lahti, _pori] = await db.insert(municipalities).values([
    { name: 'Tampere', nameFi: 'Tampere', nameSv: 'Tammerfors', region: 'Pirkanmaa', population: 244000, latitude: '61.4978', longitude: '23.7610' },
    { name: 'Helsinki', nameFi: 'Helsinki', nameSv: 'Helsingfors', region: 'Uusimaa', population: 658000, latitude: '60.1699', longitude: '24.9384' },
    { name: 'Turku', nameFi: 'Turku', nameSv: 'Åbo', region: 'Varsinais-Suomi', population: 195000, latitude: '60.4518', longitude: '22.2666' },
    { name: 'Oulu', nameFi: 'Oulu', nameSv: 'Uleåborg', region: 'Pohjois-Pohjanmaa', population: 210000, latitude: '65.0121', longitude: '25.4651' },
    { name: 'Espoo', nameFi: 'Espoo', nameSv: 'Esbo', region: 'Uusimaa', population: 300000, latitude: '60.2055', longitude: '24.6559' },
    { name: 'Vantaa', nameFi: 'Vantaa', nameSv: 'Vanda', region: 'Uusimaa', population: 240000, latitude: '60.2934', longitude: '25.0378' },
    { name: 'Jyväskylä', nameFi: 'Jyväskylä', nameSv: 'Jyväskylä', region: 'Keski-Suomi', population: 145000, latitude: '62.2426', longitude: '25.7473' },
    { name: 'Kuopio', nameFi: 'Kuopio', nameSv: 'Kuopio', region: 'Pohjois-Savo', population: 121000, latitude: '62.8924', longitude: '27.6783' },
    { name: 'Lahti', nameFi: 'Lahti', nameSv: 'Lahtis', region: 'Päijät-Häme', population: 120000, latitude: '60.9827', longitude: '25.6612' },
    { name: 'Pori', nameFi: 'Pori', nameSv: 'Björneborg', region: 'Satakunta', population: 84000, latitude: '61.4851', longitude: '21.7975' }
  ]).returning()

  // Add some European cities for broader map coverage
  console.log('Adding European cities...')
  await db.insert(municipalities).values([
    { name: 'Stockholm', nameFi: 'Tukholma', nameSv: 'Stockholm', region: 'Stockholms län', country: 'SE', population: 975000, latitude: '59.3293', longitude: '18.0686' },
    { name: 'Göteborg', nameFi: 'Göteborg', nameSv: 'Göteborg', region: 'Västra Götaland', country: 'SE', population: 580000, latitude: '57.7089', longitude: '11.9746' },
    { name: 'Malmö', nameFi: 'Malmö', nameSv: 'Malmö', region: 'Skåne', country: 'SE', population: 350000, latitude: '55.6050', longitude: '13.0038' },
    { name: 'Oslo', nameFi: 'Oslo', nameSv: 'Oslo', region: 'Oslo', country: 'NO', population: 700000, latitude: '59.9139', longitude: '10.7522' },
    { name: 'Bergen', nameFi: 'Bergen', nameSv: 'Bergen', region: 'Vestland', country: 'NO', population: 285000, latitude: '60.3913', longitude: '5.3221' },
    { name: 'Copenhagen', nameFi: 'Kööpenhamina', nameSv: 'Köpenhamn', region: 'Hovedstaden', country: 'DK', population: 800000, latitude: '55.6761', longitude: '12.5683' },
    { name: 'Tallinn', nameFi: 'Tallinna', nameSv: 'Tallinn', region: 'Harju', country: 'EE', population: 450000, latitude: '59.4370', longitude: '24.7536' },
    { name: 'Riga', nameFi: 'Riika', nameSv: 'Riga', region: 'Riga', country: 'LV', population: 630000, latitude: '56.9496', longitude: '24.1052' },
    { name: 'Vilnius', nameFi: 'Vilna', nameSv: 'Vilnius', region: 'Vilnius', country: 'LT', population: 590000, latitude: '54.6872', longitude: '25.2797' },
    { name: 'Warsaw', nameFi: 'Varsova', nameSv: 'Warszawa', region: 'Masovia', country: 'PL', population: 1800000, latitude: '52.2297', longitude: '21.0122' },
    { name: 'Berlin', nameFi: 'Berliini', nameSv: 'Berlin', region: 'Berlin', country: 'DE', population: 3600000, latitude: '52.5200', longitude: '13.4050' },
    { name: 'Amsterdam', nameFi: 'Amsterdam', nameSv: 'Amsterdam', region: 'Noord-Holland', country: 'NL', population: 870000, latitude: '52.3676', longitude: '4.9041' },
    { name: 'Brussels', nameFi: 'Bryssel', nameSv: 'Bryssel', region: 'Brussels-Capital', country: 'BE', population: 185000, latitude: '50.8503', longitude: '4.3517' },
    { name: 'Paris', nameFi: 'Pariisi', nameSv: 'Paris', region: 'Île-de-France', country: 'FR', population: 2100000, latitude: '48.8566', longitude: '2.3522' },
    { name: 'London', nameFi: 'Lontoo', nameSv: 'London', region: 'Greater London', country: 'GB', population: 8900000, latitude: '51.5074', longitude: '-0.1278' },
    { name: 'Vienna', nameFi: 'Wien', nameSv: 'Wien', region: 'Vienna', country: 'AT', population: 1900000, latitude: '48.2082', longitude: '16.3738' },
    { name: 'Prague', nameFi: 'Praha', nameSv: 'Prag', region: 'Prague', country: 'CZ', population: 1300000, latitude: '50.0755', longitude: '14.4378' },
    { name: 'Budapest', nameFi: 'Budapest', nameSv: 'Budapest', region: 'Budapest', country: 'HU', population: 1750000, latitude: '47.4979', longitude: '19.0402' },
    { name: 'Rome', nameFi: 'Rooma', nameSv: 'Rom', region: 'Lazio', country: 'IT', population: 2800000, latitude: '41.9028', longitude: '12.4964' },
    { name: 'Barcelona', nameFi: 'Barcelona', nameSv: 'Barcelona', region: 'Catalonia', country: 'ES', population: 1600000, latitude: '41.3851', longitude: '2.1734' }
  ])

  // Create places
  console.log('Creating places...')
  await db.insert(places).values([
    // Tampere places
    {
      name: 'Näsijärvi',
      nameFi: 'Näsijärvi',
      nameSv: 'Näsijärvi',
      description: 'One of the largest lakes in Finland, offering beautiful scenery and recreational opportunities.',
      latitude: '61.5167',
      longitude: '23.7500',
      radiusKm: '5',
      type: 'area',
      category: 'lake',
      municipalityId: tampere.id
    },
    {
      name: 'Pyynikki Observation Tower',
      nameFi: 'Pyynikin näkötorni',
      nameSv: 'Pyynikki utsiktstorn',
      description: 'Historic observation tower with famous café serving traditional munkki donuts.',
      latitude: '61.4908',
      longitude: '23.7383',
      type: 'landmark',
      category: 'landmark',
      municipalityId: tampere.id
    },
    {
      name: 'Särkänniemi',
      nameFi: 'Särkänniemi',
      nameSv: 'Särkänniemi',
      description: 'Amusement park and adventure area with Näsinneula observation tower.',
      latitude: '61.5047',
      longitude: '23.7461',
      type: 'poi',
      category: 'entertainment',
      municipalityId: tampere.id
    },
    {
      name: 'Vapriikki Museum Centre',
      nameFi: 'Vapriikin museokeskus',
      nameSv: 'Vapriikki museicenter',
      description: 'Museum centre in a renovated factory building, housing multiple museums.',
      latitude: '61.4969',
      longitude: '23.7722',
      type: 'poi',
      category: 'museum',
      municipalityId: tampere.id
    },
    {
      name: 'Hatanpään arboretum',
      nameFi: 'Hatanpään arboretum',
      nameSv: 'Hatanpään arboretum',
      description: 'Beautiful park with diverse plant collections and walking paths.',
      latitude: '61.4833',
      longitude: '23.7833',
      type: 'area',
      category: 'park',
      municipalityId: tampere.id
    },
    // Helsinki places
    {
      name: 'Suomenlinna',
      nameFi: 'Suomenlinna',
      nameSv: 'Sveaborg',
      description: 'UNESCO World Heritage sea fortress, accessible by ferry from Market Square.',
      latitude: '60.1454',
      longitude: '24.9881',
      type: 'landmark',
      category: 'landmark',
      municipalityId: helsinki.id
    },
    {
      name: 'Senate Square',
      nameFi: 'Senaatintori',
      nameSv: 'Senatstorget',
      description: 'Historic square with Helsinki Cathedral and Government Palace.',
      latitude: '60.1693',
      longitude: '24.9527',
      type: 'poi',
      category: 'square',
      municipalityId: helsinki.id
    },
    {
      name: 'Central Park',
      nameFi: 'Keskuspuisto',
      nameSv: 'Centralparken',
      description: 'Large forested park stretching from Töölönlahti to Vantaa border.',
      latitude: '60.2167',
      longitude: '24.9167',
      radiusKm: '3',
      type: 'area',
      category: 'park',
      municipalityId: helsinki.id
    },
    {
      name: 'Nuuksio National Park',
      nameFi: 'Nuuksion kansallispuisto',
      nameSv: 'Noux nationalpark',
      description: 'National park with forests, lakes, and hiking trails near Helsinki.',
      latitude: '60.3167',
      longitude: '24.4667',
      radiusKm: '10',
      type: 'area',
      category: 'trail',
      municipalityId: espoo.id
    },
    {
      name: 'Market Square',
      nameFi: 'Kauppatori',
      nameSv: 'Salutorget',
      description: 'Historic market square by the harbor, heart of Helsinki.',
      latitude: '60.1673',
      longitude: '24.9520',
      type: 'poi',
      category: 'square',
      municipalityId: helsinki.id
    },
    // Turku places
    {
      name: 'Turku Castle',
      nameFi: 'Turun linna',
      nameSv: 'Åbo slott',
      description: 'Medieval castle, one of the largest surviving medieval buildings in Finland.',
      latitude: '60.4356',
      longitude: '22.2289',
      type: 'landmark',
      category: 'landmark',
      municipalityId: turku.id
    },
    {
      name: 'Turku Cathedral',
      nameFi: 'Turun tuomiokirkko',
      nameSv: 'Åbo domkyrka',
      description: 'Medieval cathedral, national shrine of Finland.',
      latitude: '60.4527',
      longitude: '22.2778',
      type: 'landmark',
      category: 'landmark',
      municipalityId: turku.id
    },
    // Oulu places
    {
      name: 'Nallikari Beach',
      nameFi: 'Nallikarin uimaranta',
      nameSv: 'Nallikari strand',
      description: 'Popular beach and recreation area in Oulu.',
      latitude: '65.0333',
      longitude: '25.3833',
      type: 'poi',
      category: 'beach',
      municipalityId: oulu.id
    },
    // National parks and natural areas (not tied to municipalities)
    {
      name: 'Helvetinjärvi National Park',
      nameFi: 'Helvetinjärven kansallispuisto',
      nameSv: 'Helvetinjärvi nationalpark',
      description: 'National park known for its deep gorges and pristine wilderness.',
      latitude: '62.0167',
      longitude: '23.8500',
      radiusKm: '15',
      type: 'area',
      category: 'trail',
      country: 'FI'
    },
    {
      name: 'Koli National Park',
      nameFi: 'Kolin kansallispuisto',
      nameSv: 'Koli nationalpark',
      description: 'National park with iconic Finnish landscape views.',
      latitude: '63.0833',
      longitude: '29.8000',
      radiusKm: '10',
      type: 'area',
      category: 'trail',
      country: 'FI'
    }
  ])

  // Create users
  console.log('Creating users...')
  const [tampereMunicipality, _helsinkiMunicipality, _traficom, ministryEnv, matti, anna, liisa, juha, maria] = await db.insert(users).values([
    // Institutions
    {
      email: 'kaupunki@tampere.fi',
      name: 'City of Tampere',
      role: 'institution',
      institutionType: 'municipality',
      institutionName: 'City of Tampere',
      municipalityId: tampere.id,
      identityVerified: true,
      identityProvider: 'institutional',
      identityLevel: 'high'
    },
    {
      email: 'kaupunki@hel.fi',
      name: 'City of Helsinki',
      role: 'institution',
      institutionType: 'municipality',
      institutionName: 'City of Helsinki',
      municipalityId: helsinki.id,
      identityVerified: true,
      identityProvider: 'institutional',
      identityLevel: 'high'
    },
    {
      email: 'info@traficom.fi',
      name: 'Finnish Transport and Communications Agency',
      role: 'institution',
      institutionType: 'agency',
      institutionName: 'Traficom',
      identityVerified: true,
      identityProvider: 'institutional',
      identityLevel: 'high'
    },
    {
      email: 'kirjaamo@gov.fi',
      name: 'Ministry of the Environment',
      role: 'institution',
      institutionType: 'ministry',
      institutionName: 'Ministry of the Environment',
      identityVerified: true,
      identityProvider: 'institutional',
      identityLevel: 'high'
    },
    // Citizens
    {
      email: 'matti.virtanen@example.com',
      name: 'Matti Virtanen',
      role: 'citizen',
      municipalityId: tampere.id,
      identityVerified: true,
      identityProvider: 'magic_link',
      identityLevel: 'basic'
    },
    {
      email: 'anna.korhonen@example.com',
      name: 'Anna Korhonen',
      role: 'citizen',
      municipalityId: tampere.id,
      identityVerified: true,
      identityProvider: 'magic_link',
      identityLevel: 'basic'
    },
    {
      email: 'liisa.makinen@example.com',
      name: 'Liisa Mäkinen',
      role: 'citizen',
      municipalityId: tampere.id,
      identityVerified: true,
      identityProvider: 'magic_link',
      identityLevel: 'basic'
    },
    {
      email: 'juha.nieminen@example.com',
      name: 'Juha Nieminen',
      role: 'citizen',
      municipalityId: helsinki.id,
      identityVerified: true,
      identityProvider: 'magic_link',
      identityLevel: 'basic'
    },
    {
      email: 'maria.lahtinen@example.com',
      name: 'Maria Lahtinen',
      role: 'citizen',
      municipalityId: tampere.id,
      identityVerified: true,
      identityProvider: 'magic_link',
      identityLevel: 'basic'
    }
  ]).returning()

  // Create threads
  console.log('Creating threads...')
  const thread1Content = `The City of Tampere is seeking public input on the proposed City Centre Development Plan for 2025–2030. This comprehensive plan aims to create a more pedestrian-friendly, sustainable, and vibrant city centre.

**Key proposals include:**

- Expansion of pedestrian zones along Hämeenkatu
- New cycling infrastructure connecting the railway station to Laukontori
- Mixed-use development opportunities in underutilized areas
- Green corridor connecting Koskipuisto to Näsinpuisto
- Improved public transport connections

We encourage all residents to review the attached documents and share their thoughts, concerns, and suggestions. Your input is valuable in shaping the future of our city centre.

The consultation period runs from January 15 to February 28, 2025.`

  const [thread1, thread2, thread3, thread4] = await db.insert(threads).values([
    {
      title: 'City Centre Development Plan 2025–2030 — Public Consultation',
      content: thread1Content,
      contentHtml: renderMarkdown(thread1Content),
      authorId: tampereMunicipality.id,
      scope: 'municipal',
      municipalityId: tampere.id,
      latitude: '61.4978',
      longitude: '23.7610',
      institutionalContext: {
        docs: [
          { title: 'Development Plan Draft (PDF)', url: '#' },
          { title: 'Environmental Impact Assessment', url: '#' },
          { title: 'Traffic Analysis Report', url: '#' }
        ],
        timeline: [
          { date: '2025-01-15', event: 'Public consultation opens' },
          { date: '2025-02-28', event: 'Consultation period ends' },
          { date: '2025-04-01', event: 'City Council review' },
          { date: '2025-06-15', event: 'Final decision expected' }
        ],
        faq: [
          { q: 'How can I submit feedback?', a: 'You can comment directly in this thread or submit written feedback to kaupunkisuunnittelu@tampere.fi' },
          { q: 'Will there be public hearings?', a: 'Yes, public hearings are scheduled for February 10th and February 17th at the City Hall.' }
        ],
        contact: 'kaupunkisuunnittelu@tampere.fi'
      },
      replyCount: 3
    },
    {
      title: 'New Public Library Branch — Location Feedback',
      content: `The City of Tampere is planning a new library branch to serve the growing eastern districts. We have identified three potential locations and would like to hear from residents about their preferences.

**Location Options:**

1. **Hervanta Centre** - Close to public transport hub, existing commercial area
2. **Hallila** - Residential area with limited current services
3. **Vuores** - New development area with young families

Please share your thoughts on which location would best serve your needs and why.`,
      contentHtml: renderMarkdown(`The City of Tampere is planning a new library branch...`),
      authorId: tampereMunicipality.id,
      scope: 'municipal',
      municipalityId: tampere.id,
      institutionalContext: {
        docs: [{ title: 'Location Options Analysis', url: '#' }],
        timeline: [
          { date: '2025-01-20', event: 'Feedback collection begins' },
          { date: '2025-02-15', event: 'Feedback period ends' }
        ],
        contact: 'kirjasto@tampere.fi'
      },
      replyCount: 0
    },
    {
      title: 'Winter Maintenance Feedback Thread',
      content: `Fellow Tampere residents,

I've created this thread to collect feedback about winter maintenance in our neighborhoods. I've noticed some areas seem to get plowed much faster than others, and pedestrian paths are often neglected.

**My observations from Kaleva district:**
- Main roads are cleared quickly (within 4-6 hours of snowfall)
- Pedestrian paths often remain uncleared for 24+ hours
- Bus stops can become quite hazardous

Has anyone else noticed similar patterns? I'm thinking we could compile feedback and present it constructively to the city.`,
      contentHtml: renderMarkdown(`Fellow Tampere residents...`),
      authorId: matti.id,
      scope: 'municipal',
      municipalityId: tampere.id,
      replyCount: 2
    },
    {
      title: 'National Climate Action Strategy — Public Input Phase',
      content: `The Ministry of the Environment invites all citizens to participate in shaping Finland's updated National Climate Action Strategy.

**Key areas of focus:**

- Energy transition and renewable energy deployment
- Sustainable transportation systems
- Building efficiency standards
- Land use and carbon sinks
- Circular economy initiatives

We are particularly interested in hearing how climate policies affect your daily life and what support would help you make sustainable choices.`,
      contentHtml: renderMarkdown(`The Ministry of the Environment invites...`),
      authorId: ministryEnv.id,
      scope: 'national',
      institutionalContext: {
        docs: [
          { title: 'Climate Strategy Draft 2025', url: '#' },
          { title: 'Carbon Neutrality Roadmap', url: '#' }
        ],
        timeline: [
          { date: '2025-01-10', event: 'Public input phase begins' },
          { date: '2025-03-31', event: 'Input phase ends' }
        ],
        contact: 'ilmasto@gov.fi'
      },
      replyCount: 0
    }
  ]).returning()

  // Add tags
  console.log('Adding thread tags...')
  await db.insert(threadTags).values([
    { threadId: thread1.id, tag: 'urban-planning' },
    { threadId: thread1.id, tag: 'consultation' },
    { threadId: thread1.id, tag: 'development' },
    { threadId: thread2.id, tag: 'libraries' },
    { threadId: thread2.id, tag: 'services' },
    { threadId: thread3.id, tag: 'maintenance' },
    { threadId: thread3.id, tag: 'winter' },
    { threadId: thread3.id, tag: 'feedback' },
    { threadId: thread4.id, tag: 'climate' },
    { threadId: thread4.id, tag: 'environment' },
    { threadId: thread4.id, tag: 'national-policy' }
  ])

  // Add comments
  console.log('Adding comments...')
  const [_comment1] = await db.insert(comments).values([
    {
      threadId: thread1.id,
      authorId: anna.id,
      content: `Thank you for this comprehensive plan. I'm particularly supportive of the cycling infrastructure improvements. Currently, cycling from the station to Laukontori feels quite unsafe, especially during rush hour.

One suggestion: could the plan include secure bicycle parking facilities at key points?`,
      contentHtml: renderMarkdown(`Thank you for this comprehensive plan...`)
    },
    {
      threadId: thread1.id,
      authorId: juha.id,
      content: `I have concerns about the pedestrianization of Hämeenkatu. While I understand the benefits, how will this affect delivery vehicles and emergency services?`,
      contentHtml: renderMarkdown(`I have concerns...`)
    },
    {
      threadId: thread1.id,
      authorId: tampereMunicipality.id,
      content: `Thank you for raising these important points.

Regarding deliveries and emergency services: The plan includes designated time windows for deliveries (6-10 AM) and emergency vehicle access will be maintained through retractable bollards.

These details are covered in Section 4.3 of the Environmental Impact Assessment document.`,
      contentHtml: renderMarkdown(`Thank you for raising...`),
      parentId: null
    },
    {
      threadId: thread3.id,
      authorId: anna.id,
      content: `Same situation in Hervanta. The main roads are fine, but the walking paths to schools are often icy for days. This is a safety issue.`,
      contentHtml: renderMarkdown(`Same situation in Hervanta...`)
    },
    {
      threadId: thread3.id,
      authorId: liisa.id,
      content: `I've documented this over the past three winters. The pattern is consistent. I think we need to advocate for adjusting the priority system.`,
      contentHtml: renderMarkdown(`I've documented this...`)
    }
  ]).returning()

  // Create clubs
  console.log('Creating clubs...')
  const [historyClub, cyclingClub, hervantaClub] = await db.insert(clubs).values([
    {
      name: 'Tampere History Enthusiasts',
      slug: 'tampere-history',
      description: 'A community for those interested in the rich industrial and cultural history of Tampere.',
      rules: [
        'Be respectful of different perspectives on historical events',
        'Cite sources when sharing historical claims',
        'No political debates about current events'
      ],
      category: 'Local History',
      creatorId: liisa.id,
      memberCount: 3,
      municipalityId: tampere.id,
      latitude: '61.4969',
      longitude: '23.7722',
      address: 'Vapriikki, Alaverstaanraitti 5, 33101 Tampere'
    },
    {
      name: 'Cycling in Tampere',
      slug: 'cycling-tampere',
      description: 'For cyclists of all levels in the Tampere region. Share routes, discuss infrastructure, organize group rides.',
      rules: [
        'Be inclusive of all cycling levels',
        'Safety discussions welcome, but no shaming',
        'Keep advocacy constructive'
      ],
      category: 'Sports & Outdoors',
      creatorId: anna.id,
      memberCount: 2,
      municipalityId: tampere.id,
      latitude: '61.4908',
      longitude: '23.7383'
    },
    {
      name: 'Hervanta Neighbors',
      slug: 'hervanta-neighbors',
      description: 'The community hub for Hervanta residents.',
      rules: [
        'Keep discussions relevant to Hervanta',
        'No commercial advertising without approval',
        'Be helpful and neighborly'
      ],
      category: 'Neighborhoods',
      creatorId: matti.id,
      memberCount: 2,
      municipalityId: tampere.id,
      latitude: '61.4500',
      longitude: '23.8500'
    }
  ]).returning()

  // Add club members
  console.log('Adding club members...')
  await db.insert(clubMembers).values([
    { clubId: historyClub.id, userId: liisa.id, role: 'admin' },
    { clubId: historyClub.id, userId: matti.id, role: 'member' },
    { clubId: historyClub.id, userId: maria.id, role: 'member' },
    { clubId: cyclingClub.id, userId: anna.id, role: 'admin' },
    { clubId: cyclingClub.id, userId: matti.id, role: 'member' },
    { clubId: hervantaClub.id, userId: matti.id, role: 'admin' },
    { clubId: hervantaClub.id, userId: maria.id, role: 'member' }
  ])

  // Create club threads
  console.log('Creating club threads...')
  await db.insert(clubThreads).values([
    {
      clubId: historyClub.id,
      authorId: liisa.id,
      title: 'Welcome & Resources for New Members',
      content: `Welcome to Tampere History Enthusiasts! This thread serves as an introduction to our community.

**Recommended starting points:**
- Vapriikki Museum Center
- Tampere City Archives
- "Tampere: A History of Industrial Finland" by Pertti Haapala`,
      contentHtml: renderMarkdown(`Welcome to Tampere History Enthusiasts!...`),
      isPinned: true,
      replyCount: 0
    },
    {
      clubId: cyclingClub.id,
      authorId: anna.id,
      title: '2025 Infrastructure Updates & Advocacy',
      content: `Let's use this thread to track cycling infrastructure updates in 2025.

**Confirmed projects for 2025:**
- Ratina-Lielahti cycling bridge completion
- Hervanta main cycling route resurfacing`,
      contentHtml: renderMarkdown(`Let's use this thread...`),
      isPinned: true,
      replyCount: 0
    }
  ])

  // Create rooms for Home system
  console.log('Creating rooms...')
  const [mattiPublicRoom, mattiPrivateRoom, annaRoom] = await db.insert(rooms).values([
    {
      ownerId: matti.id,
      name: 'Avoin keskustelu',
      description: 'Tervetuloa juttelemaan kaikesta!',
      visibility: 'public',
      messageCount: 2
    },
    {
      ownerId: matti.id,
      name: 'Projektiryhmä',
      description: 'Yksityinen tila projektitiimille',
      visibility: 'private',
      messageCount: 1
    },
    {
      ownerId: anna.id,
      name: 'Pyöräilykeskustelu',
      description: 'Vapaamuotoista keskustelua pyöräilystä',
      visibility: 'public',
      messageCount: 1
    }
  ]).returning()

  // Create room messages
  console.log('Creating room messages...')
  await db.insert(roomMessages).values([
    {
      roomId: mattiPublicRoom.id,
      authorId: matti.id,
      content: 'Tervetuloa kotiini! Täällä voi keskustella mistä vain.',
      contentHtml: renderMarkdown('Tervetuloa kotiini! Täällä voi keskustella mistä vain.')
    },
    {
      roomId: mattiPublicRoom.id,
      authorId: anna.id,
      content: 'Kiitos kutsusta! Mukava paikka.',
      contentHtml: renderMarkdown('Kiitos kutsusta! Mukava paikka.')
    },
    {
      roomId: mattiPrivateRoom.id,
      authorId: matti.id,
      content: 'Projekti etenee hyvin, palataan huomenna.',
      contentHtml: renderMarkdown('Projekti etenee hyvin, palataan huomenna.')
    },
    {
      roomId: annaRoom.id,
      authorId: anna.id,
      content: 'Suosittelen Pyynikin lenkkiä iltapyöräilyyn!',
      contentHtml: renderMarkdown('Suosittelen Pyynikin lenkkiä iltapyöräilyyn!')
    }
  ])

  console.log('✅ Seeding complete!')
  console.log('')
  console.log('Test accounts (use magic link to login):')
  console.log('  - matti.virtanen@example.com (citizen, Tampere)')
  console.log('  - anna.korhonen@example.com (citizen, Tampere)')
  console.log('  - kaupunki@tampere.fi (institution, Tampere)')
  console.log('')
  console.log('In development mode, magic links are printed to console.')
}

seed()
  .catch(console.error)
  .finally(() => process.exit())
