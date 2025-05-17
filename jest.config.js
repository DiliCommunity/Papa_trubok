module.exports = {
    testEnvironment: 'node',
    verbose: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov'],
    testMatch: [
        '**/tests/**/*.js',
        '**/?(*.)+(spec|test).js'
    ],
    moduleFileExtensions: ['js', 'json', 'node']
}; 