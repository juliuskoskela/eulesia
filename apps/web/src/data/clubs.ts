// Demo fixture data — loosely typed, not matching current API shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clubs: any[] = [
  {
    id: "tampere-history",
    name: "Tampere History Enthusiasts",
    description:
      "A community for those interested in the rich industrial and cultural history of Tampere. Share old photos, discuss historical events, and explore the heritage of our city together.",
    rules: [
      "Be respectful of different perspectives on historical events",
      "Cite sources when sharing historical claims",
      "No political debates about current events",
      "Original photos must include approximate date and location if known",
    ],
    moderators: ["liisa-makinen"],
    memberCount: 847,
    threads: ["club-thread-1", "club-thread-2"],
    pinnedThreadId: "club-thread-1",
    category: "Local History",
  },
  {
    id: "cycling-tampere",
    name: "Cycling in Tampere",
    description:
      "For cyclists of all levels in the Tampere region. Share routes, discuss infrastructure, organize group rides, and advocate for better cycling conditions.",
    rules: [
      "Be inclusive of all cycling levels and types",
      "Safety discussions welcome, but no shaming",
      "Keep advocacy constructive",
      "Event posts must include date, time, and meeting point",
    ],
    moderators: ["anna-korhonen"],
    memberCount: 1243,
    threads: ["club-thread-3", "club-thread-4"],
    pinnedThreadId: "club-thread-3",
    category: "Sports & Outdoors",
  },
  {
    id: "hervanta-neighbors",
    name: "Hervanta Neighbors",
    description:
      "The community hub for Hervanta residents. Share local news, organize events, help neighbors, and discuss everything related to life in Hervanta.",
    rules: [
      "Keep discussions relevant to Hervanta",
      "No commercial advertising without moderator approval",
      "Be helpful and neighborly",
      "Lost & found posts welcome",
    ],
    moderators: ["matti-virtanen"],
    memberCount: 2156,
    threads: ["club-thread-5"],
    pinnedThreadId: undefined,
    category: "Neighborhoods",
  },
  {
    id: "finnish-photography",
    name: "Finnish Landscapes",
    description:
      "Capturing the beauty of Finland through photography. Share your landscape photos, discuss techniques, and discover new locations across the country.",
    rules: [
      "Original photos only",
      "Include location (approximately) with submissions",
      "Constructive feedback encouraged",
      "No AI-generated images",
    ],
    moderators: ["maria-lahtinen"],
    memberCount: 3421,
    threads: [],
    pinnedThreadId: undefined,
    category: "Photography",
  },
  {
    id: "urban-gardening",
    name: "Urban Gardening Finland",
    description:
      "For balcony gardeners, community garden enthusiasts, and anyone interested in growing food and plants in urban environments across Finland.",
    rules: [
      "Share your successes and failures — we learn from both",
      "Be patient with beginners",
      "Local seed/plant swaps encouraged",
      "Keep discussions civil",
    ],
    moderators: ["juha-nieminen"],
    memberCount: 1876,
    threads: [],
    pinnedThreadId: undefined,
    category: "Hobbies",
  },
  {
    id: "board-games-tampere",
    name: "Board Games Tampere",
    description:
      "Find gaming partners, organize game nights, discuss your favorite games, and discover new ones. All types of tabletop gaming welcome.",
    rules: [
      "Be welcoming to new players",
      "Event posts: include game type, experience level needed, and venue",
      "No harassment or exclusionary behavior",
      "Keep discussions friendly",
    ],
    moderators: ["anna-korhonen", "matti-virtanen"],
    memberCount: 567,
    threads: [],
    pinnedThreadId: undefined,
    category: "Hobbies",
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clubThreads: any[] = [
  {
    id: "club-thread-1",
    clubId: "tampere-history",
    title: "Welcome & Resources for New Members",
    authorId: "liisa-makinen",
    content: `Welcome to Tampere History Enthusiasts!

This thread serves as an introduction to our community and a collection of useful resources.

**Recommended starting points:**
- Vapriikki Museum Center — excellent permanent exhibitions on Tampere history
- Tampere City Archives — open to public researchers
- "Tampere: A History of Industrial Finland" by Pertti Haapala

**Regular activities:**
- Monthly history walks (announced in this club)
- Guest speaker sessions (quarterly)
- Photo digitization workshops

Feel free to introduce yourself below and tell us what aspects of Tampere history interest you most!`,
    createdAt: "2024-06-15T10:00:00Z",
    updatedAt: "2025-01-10T14:30:00Z",
    replyCount: 89,
    isPinned: true,
  },
  {
    id: "club-thread-2",
    clubId: "tampere-history",
    title: "Photos: Finlayson Factory Area 1960s-1980s",
    authorId: "matti-virtanen",
    content: `I've been digitizing my father's photo collection and found some gems from the Finlayson factory area during its final decades of operation.

The transformation of this area into a cultural center is remarkable when you compare these photos to today.

I'll share them in batches over the coming weeks. First batch attached below — showing the main factory building and worker housing in approximately 1967.

Does anyone have similar photos from this era? I'd love to see different perspectives.`,
    createdAt: "2025-01-08T16:20:00Z",
    updatedAt: "2025-01-20T11:45:00Z",
    replyCount: 34,
    isPinned: false,
  },
  {
    id: "club-thread-3",
    clubId: "cycling-tampere",
    title: "2025 Infrastructure Updates & Advocacy",
    authorId: "anna-korhonen",
    content: `Let's use this thread to track cycling infrastructure updates in 2025 and coordinate our advocacy efforts.

**Confirmed projects for 2025:**
- Ratina-Lielahti cycling bridge completion (spring)
- Hervanta main cycling route resurfacing
- New bike parking at the railway station

**Under discussion:**
- City centre development plan (see Agora thread for official consultation)
- Winter maintenance priority changes

I'll update this post as we learn more. Please share any news or observations about infrastructure in your area!`,
    createdAt: "2025-01-05T09:00:00Z",
    updatedAt: "2025-01-21T08:30:00Z",
    replyCount: 56,
    isPinned: true,
  },
  {
    id: "club-thread-4",
    clubId: "cycling-tampere",
    title: "Group Ride: Pyynikki Loop - Saturday Jan 25",
    authorId: "anna-korhonen",
    content: `Let's kick off the year with a scenic winter ride!

**Details:**
- Date: Saturday, January 25, 2025
- Time: 10:00 AM
- Meeting point: Keskustori (by the old church)
- Route: Keskustori → Pyynikki observation tower → Pispala → return via Näsijärvi shore
- Distance: ~15 km
- Pace: Relaxed, with photo stops
- Difficulty: Easy to moderate (some hills in Pispala)

**What to bring:**
- Winter tires recommended (roads may be icy)
- Warm clothing in layers
- Small backpack with snacks/water
- Lights (required by law, but still!)

RSVP below so I know roughly how many to expect. All welcome regardless of experience!`,
    createdAt: "2025-01-18T12:00:00Z",
    updatedAt: "2025-01-21T19:15:00Z",
    replyCount: 12,
    isPinned: false,
  },
  {
    id: "club-thread-5",
    clubId: "hervanta-neighbors",
    title: "Lost cat - gray tabby, Hervannan valtaväylä area",
    authorId: "maria-lahtinen",
    content: `Our cat Misu went missing yesterday evening (Jan 20) around Hervannan valtaväylä near the shopping center.

**Description:**
- Gray tabby, female, 4 years old
- Green collar with bell (may have lost it)
- Microchipped
- Responds to "Misu"
- Quite shy with strangers

Last seen near the bicycle parking behind Duo shopping center around 6 PM.

If you see her, please don't chase — she's likely scared. Just note the location and time and contact me. I'll come look immediately.

Thank you for any help!

UPDATE Jan 21 evening: Still missing. Expanded search to Hervantajärvi area.`,
    createdAt: "2025-01-21T08:00:00Z",
    updatedAt: "2025-01-21T20:30:00Z",
    replyCount: 23,
    isPinned: false,
  },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getClubById = (id: string): any =>
  clubs.find((club: any) => club.id === id);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getClubsByCategory = (category: string): any[] =>
  clubs.filter((club: any) => club.category === category);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getClubThreadsByClub = (clubId: string): any[] =>
  clubThreads.filter((thread: any) => thread.clubId === clubId);

export const getClubCategories = (): string[] => {
  const categories = new Set(
    clubs.map((club: any) => club.category).filter(Boolean),
  );
  return Array.from(categories).sort() as string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const searchClubs = (query: string): any[] => {
  const lowerQuery = query.toLowerCase();
  return clubs.filter(
    (club: any) =>
      club.name?.toLowerCase().includes(lowerQuery) ||
      club.description?.toLowerCase().includes(lowerQuery),
  );
};
