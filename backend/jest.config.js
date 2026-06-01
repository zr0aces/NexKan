module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testTimeout: 10000,
  moduleNameMapper: {
    '^@nexkan/shared$': '<rootDir>/../shared/src/index.ts',
    '^@nexkan/shared/(.*)$': '<rootDir>/../shared/src/$1',
  },
};
