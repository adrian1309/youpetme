import react from '@youpetme/config/eslint/react';

export default [...react, { ignores: ['e2e/playwright-report/**', 'e2e/test-results/**'] }];
