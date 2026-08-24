/** @type {import('prettier').Config} */
const config = {
  printWidth: 120,
  singleQuote: true,
  trailingComma: 'all',
  semi: true,
  tabWidth: 2,
  endOfLine: 'lf',
  overrides: [
    {
      // Match .editorconfig indent for CSS files
      files: ['**/*.css'],
      options: { tabWidth: 4 },
    },
  ],
};

export default config;
