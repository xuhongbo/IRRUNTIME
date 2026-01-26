module.exports = {
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest"],
  },
  moduleNameMapper: {
    "\\.(css|less|scss)$": "<rootDir>/src/test/styleMock.js",
  },
  setupFilesAfterEnv: ["<rootDir>/src/test/setupTests.ts"],
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts?(x)"],
  collectCoverageFrom: ["src/engine/**/*.{ts,tsx}", "src/studio/**/*.{ts,tsx}"],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    "./src/engine/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
    "./src/studio/": {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },
};
