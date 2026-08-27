import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import xwalkPlugin from 'eslint-plugin-xwalk';
import * as jsoncParser from 'jsonc-eslint-parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default defineConfig([
  // Global ignores (generated build output, never hand-edited)
  {
    ignores: [
      'dist/',
      'blocks/*/*.js',
      'chunks/',
      'scripts/aem.js',
      'scripts/scripts.js',
      'scripts/delayed.js',
      'scripts/editor-support.js',
      'component-definition.json',
      'component-models.json',
      'component-filters.json',
      'package-lock.json',
      'helix-importer-ui',
      '.agents/', // vendored third-party skill scripts, not app code
    ],
  },

  // JavaScript files
  {
    files: ['**/*.{js,mjs,cjs}'],
    plugins: { js },
    extends: ['js/recommended'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-param-reassign': ['error', { props: false }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },

  // Node.js build/tooling scripts (git hooks, config files)
  {
    files: ['.husky/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript files
  {
    files: ['**/*.ts'],
    plugins: { js },
    extends: ['js/recommended', ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'no-param-reassign': ['error', { props: false }],
      'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // JSON files — AEM component model validation
  {
    files: ['**/*.json'],
    plugins: { xwalk: xwalkPlugin },
    languageOptions: { parser: jsoncParser },
    rules: {
      'xwalk/max-cells': [
        'error',
        {
          '*': 8,
          'newsletter-form': 12,
        },
      ],
      'xwalk/no-duplicate-fields': 'error',
      'xwalk/invalid-field-name': 'error',
      'xwalk/no-orphan-collapsible-fields': 'error',
      'xwalk/no-custom-resource-types': 'error',
    },
  },

  // Disable all ESLint formatting rules — Prettier handles formatting
  prettier,
]);
