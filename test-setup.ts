// Copyright the original author or authors
import '@testing-library/jest-dom'

// Note: useMediaQuery mock might not be needed since jsdom 
// naturally returns false for media queries, but keeping it 
// for explicit behavior and future-proofing
import { vi } from 'vitest'

vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(() => false), // Always return desktop view by default
}))
