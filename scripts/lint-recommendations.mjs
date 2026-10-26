import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { nextJsConfig } from '../packages/eslint-config/next.js';

const { ESLint } = createRequire(new URL('../apps/web/package.json', import.meta.url))('eslint');
// The repository's default lint does not select TS/TSX, and its Babel preset
// resolves from the app instead of the shared-config package. Keep F01 checks
// explicit without changing the lint policy of unrelated modules.
const files = {
  web: [
    'services/recommendations.service.ts',
    'app/[locale]/(dashboard)/components/learning-recommendations.tsx',
  ],
  'admin-web': [
    'services/recommendations.service.ts',
    'app/[locale]/(dashboard)/learning/recommendations/page.tsx',
  ],
};
if (process.argv.includes('--mistakes')) {
  files.web.push('services/mistakes.service.ts','app/[locale]/(dashboard)/learning/mistakes/page.tsx');
  files['admin-web'].push('services/mistakes.service.ts','app/[locale]/(dashboard)/learning/mistakes/page.tsx');
}
if (process.argv.includes('--publication')) {
  files['admin-web'].push('services/publication.service.ts','components/publication/publication-controls.tsx');
}
for (const [app, paths] of Object.entries(files)) {
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL(`../apps/${app}/`, import.meta.url)),
    overrideConfigFile: true,
    overrideConfig: [
      ...nextJsConfig,
      {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
          parserOptions: {
            requireConfigFile: false,
            babelOptions: {
              babelrc: false, configFile: false, presets: [],
              parserOpts: { plugins: ['typescript', 'jsx'] },
            },
          },
        },
        // Core JS scope rules misread TS types; tsc and Oxlint check these.
        rules: { 'no-unused-vars': 'off', 'no-undef': 'off' },
      },
    ],
  });
  const results = await eslint.lintFiles(paths);
  process.stdout.write(await (await eslint.loadFormatter('stylish')).format(results));
  const problems = results.reduce((count, item) => count + item.errorCount + item.warningCount, 0);
  console.log(`${app}: ${results.length} ${process.argv.includes('--mistakes') ? 'F01/F02' : 'F01'} TypeScript files, ${problems} lint problems`);
  if (problems) process.exitCode = 1;
}
