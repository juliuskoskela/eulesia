import type { Thread, Comment } from '../types'

export const threads: Thread[] = [
  {
    id: 'thread-1',
    title: 'City Centre Development Plan 2025–2030 — Public Consultation',
    scope: 'local',
    municipalityId: 'tampere',
    tags: ['urban-planning', 'consultation', 'development'],
    authorId: 'tampere-municipality',
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
        { q: 'Will there be public hearings?', a: 'Yes, public hearings are scheduled for February 10th and February 17th at the City Hall.' },
        { q: 'What areas are affected?', a: 'The plan covers the area bounded by Hämeenkatu, Satakunnankatu, and the railway station.' }
      ],
      contact: 'kaupunkisuunnittelu@tampere.fi'
    },
    content: `The City of Tampere is seeking public input on the proposed City Centre Development Plan for 2025–2030. This comprehensive plan aims to create a more pedestrian-friendly, sustainable, and vibrant city centre.

**Key proposals include:**

- Expansion of pedestrian zones along Hämeenkatu
- New cycling infrastructure connecting the railway station to Laukontori
- Mixed-use development opportunities in underutilized areas
- Green corridor connecting Koskipuisto to Näsinpuisto
- Improved public transport connections

We encourage all residents to review the attached documents and share their thoughts, concerns, and suggestions. Your input is valuable in shaping the future of our city centre.

The consultation period runs from January 15 to February 28, 2025.`,
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-20T14:30:00Z',
    replyCount: 24
  },
  {
    id: 'thread-2',
    title: 'New Public Library Branch — Location Feedback',
    scope: 'local',
    municipalityId: 'tampere',
    tags: ['libraries', 'services', 'consultation'],
    authorId: 'tampere-municipality',
    institutionalContext: {
      docs: [
        { title: 'Location Options Analysis', url: '#' },
        { title: 'Service Area Maps', url: '#' }
      ],
      timeline: [
        { date: '2025-01-20', event: 'Feedback collection begins' },
        { date: '2025-02-15', event: 'Feedback period ends' },
        { date: '2025-03-01', event: 'Location decision' }
      ],
      faq: [
        { q: 'What services will the new branch offer?', a: 'Full library services including book lending, digital services, reading rooms, and community meeting spaces.' }
      ],
      contact: 'kirjasto@tampere.fi'
    },
    content: `The City of Tampere is planning a new library branch to serve the growing eastern districts. We have identified three potential locations and would like to hear from residents about their preferences.

**Location Options:**

1. **Hervanta Centre** - Close to public transport hub, existing commercial area
2. **Hallila** - Residential area with limited current services
3. **Vuores** - New development area with young families

Please share your thoughts on which location would best serve your needs and why.`,
    createdAt: '2025-01-20T10:00:00Z',
    updatedAt: '2025-01-21T16:45:00Z',
    replyCount: 18
  },
  {
    id: 'thread-3',
    title: 'Winter Maintenance Feedback Thread',
    scope: 'local',
    municipalityId: 'tampere',
    tags: ['maintenance', 'winter', 'feedback'],
    authorId: 'matti-virtanen',
    content: `Fellow Tampere residents,

I've created this thread to collect feedback about winter maintenance in our neighborhoods. I've noticed some areas seem to get plowed much faster than others, and pedestrian paths are often neglected.

**My observations from Kaleva district:**
- Main roads are cleared quickly (within 4-6 hours of snowfall)
- Pedestrian paths often remain uncleared for 24+ hours
- Bus stops can become quite hazardous

Has anyone else noticed similar patterns? I'm thinking we could compile feedback and present it constructively to the city.

What's the situation like in your neighborhood?`,
    createdAt: '2025-01-18T08:30:00Z',
    updatedAt: '2025-01-21T11:20:00Z',
    replyCount: 31
  },
  {
    id: 'thread-4',
    title: 'National Climate Action Strategy — Public Input Phase',
    scope: 'national',
    tags: ['climate', 'environment', 'national-policy'],
    authorId: 'ministry-environment',
    institutionalContext: {
      docs: [
        { title: 'Climate Strategy Draft 2025', url: '#' },
        { title: 'Carbon Neutrality Roadmap', url: '#' },
        { title: 'Sector-Specific Guidelines', url: '#' }
      ],
      timeline: [
        { date: '2025-01-10', event: 'Public input phase begins' },
        { date: '2025-03-31', event: 'Input phase ends' },
        { date: '2025-06-01', event: 'Strategy finalization' }
      ],
      faq: [
        { q: 'How does this affect municipalities?', a: 'Municipalities will receive updated guidance on local climate action plans and potential funding mechanisms.' },
        { q: 'What are the key targets?', a: 'Carbon neutrality by 2035, with intermediate milestones in 2027 and 2030.' }
      ],
      contact: 'ilmasto@gov.fi'
    },
    content: `The Ministry of the Environment invites all citizens to participate in shaping Finland's updated National Climate Action Strategy.

**Key areas of focus:**

- Energy transition and renewable energy deployment
- Sustainable transportation systems
- Building efficiency standards
- Land use and carbon sinks
- Circular economy initiatives
- Just transition for affected communities

We are particularly interested in hearing:
1. How climate policies affect your daily life
2. What support would help you make sustainable choices
3. Concerns about proposed measures
4. Ideas for local implementation

Your voice matters in creating a fair and effective climate strategy for Finland.`,
    createdAt: '2025-01-10T12:00:00Z',
    updatedAt: '2025-01-19T09:15:00Z',
    replyCount: 156
  },
  {
    id: 'thread-5',
    title: 'Helsinki Central Library Oodi — Extended Hours Proposal',
    scope: 'local',
    municipalityId: 'helsinki',
    tags: ['libraries', 'services', 'helsinki'],
    authorId: 'helsinki-municipality',
    institutionalContext: {
      docs: [
        { title: 'Usage Statistics 2024', url: '#' },
        { title: 'Cost Analysis', url: '#' }
      ],
      timeline: [
        { date: '2025-01-22', event: 'Feedback collection' },
        { date: '2025-02-28', event: 'Decision expected' }
      ],
      faq: [
        { q: 'What are the proposed new hours?', a: 'Opening at 7:00 AM instead of 8:00 AM, closing at 23:00 instead of 22:00 on weekdays.' }
      ],
      contact: 'oodi@hel.fi'
    },
    content: `Based on user feedback and usage patterns, we are considering extending Oodi's opening hours. We would like to hear from library users about this proposal.

**Current hours:** 8:00 - 22:00 (weekdays), 10:00 - 20:00 (weekends)

**Proposed hours:** 7:00 - 23:00 (weekdays), 9:00 - 21:00 (weekends)

Would extended hours benefit you? What times are most important to you?`,
    createdAt: '2025-01-22T08:00:00Z',
    updatedAt: '2025-01-22T08:00:00Z',
    replyCount: 8
  },
  {
    id: 'thread-6',
    title: 'Public Transport App Feedback — Traficom Survey',
    scope: 'national',
    tags: ['transport', 'digital-services', 'feedback'],
    authorId: 'traficom',
    institutionalContext: {
      docs: [
        { title: 'Current App Landscape Analysis', url: '#' }
      ],
      timeline: [
        { date: '2025-01-15', event: 'Survey opens' },
        { date: '2025-02-15', event: 'Survey closes' },
        { date: '2025-04-01', event: 'Results published' }
      ],
      faq: [],
      contact: 'liikenne@traficom.fi'
    },
    content: `Traficom is conducting a nationwide survey on public transport applications and services.

We want to understand:
- Which apps do you currently use for public transport?
- What features work well?
- What's missing or frustrating?
- Would you support a unified national transport app?

Your feedback will inform our recommendations for improving digital transport services across Finland.`,
    createdAt: '2025-01-15T10:00:00Z',
    updatedAt: '2025-01-20T15:30:00Z',
    replyCount: 42
  }
]

export const comments: Comment[] = [
  // Comments for thread-1 (City Centre Development)
  {
    id: 'comment-1',
    threadId: 'thread-1',
    authorId: 'anna-korhonen',
    content: `Thank you for this comprehensive plan. I'm particularly supportive of the cycling infrastructure improvements. Currently, cycling from the station to Laukontori feels quite unsafe, especially during rush hour.

One suggestion: could the plan include secure bicycle parking facilities at key points? This would encourage more people to combine cycling with train travel.`,
    createdAt: '2025-01-15T14:30:00Z'
  },
  {
    id: 'comment-2',
    threadId: 'thread-1',
    authorId: 'juha-nieminen',
    content: `I have concerns about the pedestrianization of Hämeenkatu. While I understand the benefits, how will this affect delivery vehicles and emergency services? Has this been analyzed?

Also, what about accessibility for people who cannot walk long distances?`,
    createdAt: '2025-01-16T09:15:00Z'
  },
  {
    id: 'comment-3',
    threadId: 'thread-1',
    authorId: 'tampere-municipality',
    parentId: 'comment-2',
    content: `Thank you for raising these important points.

Regarding deliveries and emergency services: The plan includes designated time windows for deliveries (6-10 AM) and emergency vehicle access will be maintained through retractable bollards.

For accessibility: We are planning enhanced public transport connections, including a free city centre shuttle service, and ensuring adequate seating areas throughout the pedestrian zone. We will also maintain some vehicle access points for those with mobility permits.

These details are covered in Section 4.3 of the Environmental Impact Assessment document.`,
    createdAt: '2025-01-16T11:00:00Z'
  },
  {
    id: 'comment-4',
    threadId: 'thread-1',
    authorId: 'matti-virtanen',
    content: `The green corridor idea is excellent. Tampere needs more connected green spaces. However, I'm wondering about the mixed-use development areas — what safeguards are in place to ensure we don't just get more luxury apartments that ordinary people can't afford?`,
    createdAt: '2025-01-17T16:45:00Z'
  },
  // Comments for thread-3 (Winter Maintenance)
  {
    id: 'comment-5',
    threadId: 'thread-3',
    authorId: 'anna-korhonen',
    content: `Same situation in Hervanta. The main roads are fine, but the walking paths to schools are often icy for days. This is a safety issue, especially for children walking to school.`,
    createdAt: '2025-01-18T10:20:00Z'
  },
  {
    id: 'comment-6',
    threadId: 'thread-3',
    authorId: 'liisa-makinen',
    content: `I've actually documented this over the past three winters. The pattern is consistent:
- Priority 1 roads: cleared within 4 hours
- Priority 2 roads: cleared within 8-12 hours
- Pedestrian paths: highly variable, sometimes 48+ hours

I think we need to advocate for adjusting the priority system to give pedestrian paths equal importance to secondary roads.`,
    createdAt: '2025-01-18T14:55:00Z'
  },
  {
    id: 'comment-7',
    threadId: 'thread-3',
    authorId: 'maria-lahtinen',
    content: `In Lielahti, the situation varies a lot by specific area. Some housing companies seem to coordinate well with city services, others don't. Maybe we need better communication channels between housing companies and the city's maintenance services?`,
    createdAt: '2025-01-19T08:30:00Z'
  }
]

export const getThreadById = (id: string): Thread | undefined => {
  return threads.find(thread => thread.id === id)
}

export const getThreadsByScope = (scope: string): Thread[] => {
  if (scope === 'all') return threads
  return threads.filter(thread => thread.scope === scope)
}

export const getThreadsByMunicipality = (municipalityId: string): Thread[] => {
  return threads.filter(thread => thread.municipalityId === municipalityId)
}

export const getThreadsByTag = (tag: string): Thread[] => {
  return threads.filter(thread => thread.tags.includes(tag))
}

export const getCommentsByThread = (threadId: string): Comment[] => {
  return comments.filter(comment => comment.threadId === threadId)
}

export const getAllTags = (): string[] => {
  const tagSet = new Set<string>()
  threads.forEach(thread => thread.tags.forEach(tag => tagSet.add(tag)))
  return Array.from(tagSet).sort()
}
