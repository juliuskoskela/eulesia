import type { Service } from "../types";

export const services: Service[] = [
  {
    id: "service-booking",
    name: "Sports Facility Booking",
    category: "Recreation",
    provider: "City of Tampere",
    description:
      "Book time slots at municipal sports facilities, swimming pools, and outdoor courts. Integrated with city recreation services.",
    integrationDemoType: "booking",
  },
  {
    id: "service-events",
    name: "Local Events Calendar",
    category: "Community",
    provider: "Eulesia Foundation",
    description:
      "Discover public events, cultural activities, and community gatherings in your area. Events from verified institutions and community organizations.",
    integrationDemoType: "events",
  },
  {
    id: "service-volunteering",
    name: "Volunteer Matching",
    category: "Community",
    provider: "Finnish Red Cross",
    description:
      "Find volunteering opportunities that match your skills and interests. Connect with local organizations that need help.",
    integrationDemoType: "volunteering",
  },
  {
    id: "service-library",
    name: "Library Services",
    category: "Culture",
    provider: "Pirkanmaa Libraries",
    description:
      "Browse library collections, reserve books, and manage your library account. Access to all Pirkanmaa region libraries.",
    integrationDemoType: "booking",
  },
  {
    id: "service-local-media",
    name: "Local News Hub",
    category: "Media",
    provider: "Verified News Partners",
    description:
      "Curated local news from verified regional media sources. No algorithmic engagement optimization — just news.",
    integrationDemoType: "media",
  },
  {
    id: "service-transit",
    name: "Public Transport",
    category: "Transport",
    provider: "Nysse",
    description:
      "Plan routes, check schedules, and purchase tickets for Tampere region public transport.",
    integrationDemoType: "booking",
  },
];

export const getServiceById = (id: string): Service | undefined => {
  return services.find((service) => service.id === id);
};

export const getServicesByCategory = (category: string): Service[] => {
  return services.filter((service) => service.category === category);
};

export const getServiceCategories = (): string[] => {
  const categories = new Set(services.map((service) => service.category));
  return Array.from(categories).sort();
};
