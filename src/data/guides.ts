export interface GuideStep {
  targetSelector: string
  titleKey: string
  descriptionKey: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

export interface GuideDefinition {
  id: string
  titleKey: string
  steps: GuideStep[]
}

export const guides: Record<string, GuideDefinition> = {
  global: {
    id: 'global',
    titleKey: 'guide:global.title',
    steps: [
      {
        targetSelector: '[data-guide="search"]',
        titleKey: 'guide:global.search.title',
        descriptionKey: 'guide:global.search.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="notifications"]',
        titleKey: 'guide:global.notifications.title',
        descriptionKey: 'guide:global.notifications.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="bottomnav"]',
        titleKey: 'guide:global.bottomnav.title',
        descriptionKey: 'guide:global.bottomnav.description',
        placement: 'top'
      }
    ]
  },
  agora: {
    id: 'agora',
    titleKey: 'guide:agora.title',
    steps: [
      {
        targetSelector: '[data-guide="agora-header"]',
        titleKey: 'guide:agora.header.title',
        descriptionKey: 'guide:agora.header.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="agora-scope"]',
        titleKey: 'guide:agora.scope.title',
        descriptionKey: 'guide:agora.scope.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="agora-sort"]',
        titleKey: 'guide:agora.sort.title',
        descriptionKey: 'guide:agora.sort.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="agora-newthread"]',
        titleKey: 'guide:agora.newthread.title',
        descriptionKey: 'guide:agora.newthread.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="agora-threadcard"]',
        titleKey: 'guide:agora.threadcard.title',
        descriptionKey: 'guide:agora.threadcard.description',
        placement: 'top'
      }
    ]
  },
  clubs: {
    id: 'clubs',
    titleKey: 'guide:clubs.title',
    steps: [
      {
        targetSelector: '[data-guide="clubs-header"]',
        titleKey: 'guide:clubs.header.title',
        descriptionKey: 'guide:clubs.header.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="clubs-search"]',
        titleKey: 'guide:clubs.search.title',
        descriptionKey: 'guide:clubs.search.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="clubs-create"]',
        titleKey: 'guide:clubs.create.title',
        descriptionKey: 'guide:clubs.create.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="clubs-clubcard"]',
        titleKey: 'guide:clubs.clubcard.title',
        descriptionKey: 'guide:clubs.clubcard.description',
        placement: 'top'
      }
    ]
  },
  messages: {
    id: 'messages',
    titleKey: 'guide:messages.title',
    steps: [
      {
        targetSelector: '[data-guide="messages-header"]',
        titleKey: 'guide:messages.header.title',
        descriptionKey: 'guide:messages.header.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="messages-conversation"]',
        titleKey: 'guide:messages.conversation.title',
        descriptionKey: 'guide:messages.conversation.description',
        placement: 'bottom'
      }
    ]
  },
  map: {
    id: 'map',
    titleKey: 'guide:map.title',
    steps: [
      {
        targetSelector: '[data-guide="map-header"]',
        titleKey: 'guide:map.header.title',
        descriptionKey: 'guide:map.header.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="map-filters"]',
        titleKey: 'guide:map.filters.title',
        descriptionKey: 'guide:map.filters.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="map-point"]',
        titleKey: 'guide:map.point.title',
        descriptionKey: 'guide:map.point.description',
        placement: 'top'
      }
    ]
  },
  home: {
    id: 'home',
    titleKey: 'guide:home.title',
    steps: [
      {
        targetSelector: '[data-guide="home-header"]',
        titleKey: 'guide:home.header.title',
        descriptionKey: 'guide:home.header.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="home-rooms"]',
        titleKey: 'guide:home.rooms.title',
        descriptionKey: 'guide:home.rooms.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="home-invitations"]',
        titleKey: 'guide:home.invitations.title',
        descriptionKey: 'guide:home.invitations.description',
        placement: 'bottom'
      },
      {
        targetSelector: '[data-guide="home-activity"]',
        titleKey: 'guide:home.activity.title',
        descriptionKey: 'guide:home.activity.description',
        placement: 'top'
      }
    ]
  }
}

export const guideIds = Object.keys(guides) as string[]
