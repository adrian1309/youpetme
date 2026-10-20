import base from '@youpetme/config/eslint/base';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(...base, {
  languageOptions: {
    globals: { ...globals.node, ...globals.jest },
  },
});
