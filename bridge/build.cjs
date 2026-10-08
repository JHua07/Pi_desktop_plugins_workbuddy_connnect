'use strict';
const path = require('node:path');
require('esbuild').buildSync({
  entryPoints: [path.join(__dirname, 'core-entry.ts')],
  outfile: path.join(__dirname, 'core.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  alias: { '@deepseek-ai/dsh-home-paths': path.join(__dirname, 'home.cjs') },
  legalComments: 'inline',
  banner: { js: '// Bundled from corrinehu/dsh-workbuddy-connect (MIT), commit fa570627016f56adfd2f91ccd706356b9157f2a7. See vendor/dsh-workbuddy-connect/LICENSE and THIRD_PARTY_NOTICES.md.' }
});
