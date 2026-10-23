import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/.expo/**', '**/next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Retained consumed-bootstrap source is hash-bound. Preserve its harmless
    // escaped quote while keeping the rule active for all other escapes.
    files: ['scripts/openbao/review-captured-authority.mjs'],
    rules: { 'no-useless-escape': ['error', { allowRegexCharacters: ['"'] }] },
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        AbortSignal: 'readonly',
        Buffer: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },
);
