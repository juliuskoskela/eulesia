import '@testing-library/jest-dom'
import { beforeAll, afterEach, afterAll, vi } from 'vitest'

// Mock fetch
;(globalThis as unknown as { fetch: typeof vi.fn }).fetch = vi.fn()

// Mock import.meta.env - this is handled by vitest automatically

beforeAll(() => {
  // Setup before all tests
})

afterEach(() => {
  // Cleanup after each test
})

afterAll(() => {
  // Cleanup after all tests
})
