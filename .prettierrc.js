// these options configure formatting behavior of prettier.js
// https://prettier.io/docs/en/configuration.html
module.exports = {
  printWidth: 80,
  trailingComma: 'all',
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: true,
  quoteProps: 'as-needed',
  bracketSpacing: true,
  bracketSameLine: false,
  arrowParens: 'always',
  overrides: [
    {
      files: ['*.md', '*.mdx'],
      options: {
        proseWrap: 'always',
        embeddedLanguageFormatting: 'off',
        // printWidth is already 80 globally; keep it explicit for clarity
        printWidth: 80,
      },
    },
  ],
};
