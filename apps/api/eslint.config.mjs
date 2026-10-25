import base from '@youpetme/config/eslint/base';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  ...base,
  { ignores: ['src/platform/database/generated/**'] },
  {
    languageOptions: {
      globals: { ...globals.node, ...globals.jest },
    },
  },
);
