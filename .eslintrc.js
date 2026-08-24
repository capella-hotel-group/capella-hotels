module.exports = {
  root: true,
  extends: [
    'airbnb-base',
    'plugin:json/recommended',
    'plugin:xwalk/recommended',
  ],
  env: {
    browser: true,
  },
  parser: '@babel/eslint-parser',
  parserOptions: {
    allowImportExportEverywhere: true,
    sourceType: 'module',
    requireConfigFile: false,
  },
  rules: {
    'import/extensions': ['error', { js: 'always' }], // require js file extensions in imports
    'linebreak-style': ['error', 'unix'], // enforce unix linebreaks
    'no-param-reassign': [2, { props: false }], // allow modifying properties of param
    'xwalk/max-cells': ['error', {
      '*': 8, // limit number of cells in a block to 8
      'newsletter-form': 12, // limit number of cells in newsletter form to 12
    }],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      extends: [
        'airbnb-base',
        'plugin:@typescript-eslint/recommended',
        'plugin:xwalk/recommended',
        'prettier',
      ],
      parserOptions: {
        sourceType: 'module',
        project: './tsconfig.json',
      },
      settings: {
        'import/resolver': {
          typescript: {
            alwaysTryTypes: true,
            project: './tsconfig.json',
          },
        },
      },
      rules: {
        'import/extensions': ['error', { ts: 'never', js: 'always' }],
        'linebreak-style': ['error', 'unix'],
        'no-param-reassign': [2, { props: false }],
        'import/prefer-default-export': 'off',
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
      },
    },
    {
      files: ['vite.config.ts', 'vite.config-editor.ts', 'vite.shared.ts'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
