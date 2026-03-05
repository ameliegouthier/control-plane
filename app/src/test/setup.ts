/**
 * Vitest setup file
 * Runs before all tests
 */

// Mock environment variables
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
(process.env as Record<string, string>).NODE_ENV = "test";
