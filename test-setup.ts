import '@testing-library/jest-dom'

// Mock useMediaQuery to avoid issues in tests
import { vi } from 'vitest'

vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(() => false), // Always return desktop view by default
}))
