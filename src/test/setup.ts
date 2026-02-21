import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll, vi } from "vitest";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Initialize i18n for tests — returns translation keys as values
i18n.use(initReactI18next).init({
  lng: "fi",
  fallbackLng: "fi",
  defaultNS: "common",
  ns: ["common"],
  resources: {
    fi: {
      common: {
        "scope.local": "Paikallinen",
        "scope.national": "Valtakunnallinen",
        "scope.european": "EU",
        "scope.all": "Kaikki",
        "contentEnd.upToDate": "You're up to date",
        "contentEnd.noMore": "No more content to show",
      },
    },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

// Mock fetch
(globalThis as unknown as { fetch: typeof vi.fn }).fetch = vi.fn();

beforeAll(() => {
  // Setup before all tests
});

afterEach(() => {
  // Cleanup after each test
});

afterAll(() => {
  // Cleanup after all tests
});
