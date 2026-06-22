const { jestConfig } = require('@salesforce/sfdx-lwc-jest/config');

module.exports = {
    ...jestConfig,
    moduleNameMapper: {
        ...jestConfig.moduleNameMapper,
        '^lightning/flowSupport$': '<rootDir>/jest-mocks/lightning/flowSupport'
    },
    setupFilesAfterEnv: [
        ...(jestConfig.setupFilesAfterEnv || []),
        '<rootDir>/jest.setup.a11y.js'
    ],
    testTimeout: 15000
};
