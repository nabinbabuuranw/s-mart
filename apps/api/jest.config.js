const base = { preset: 'ts-jest', testEnvironment: 'node', rootDir: '.', setupFiles: ['<rootDir>/test/env.js'], transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', diagnostics: false }] } };
module.exports = {
  testTimeout: 60000,
  globalSetup: '<rootDir>/test/global-setup.js',
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts'],
  coverageReporters: ['text-summary', 'json-summary'],
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    { ...base, displayName: 'integration', testMatch: ['<rootDir>/test/integration/**/*.spec.ts'] },
    { ...base, displayName: 'security', testMatch: ['<rootDir>/test/security/**/*.spec.ts'] },
  ],
};
