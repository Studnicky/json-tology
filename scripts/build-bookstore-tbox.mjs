/**
 * build-bookstore-tbox.mjs
 *
 * Generates docs/public/data/bookstore-tbox.jsonld from the live bookstore
 * registry. Required by the WebVOWL iframe which fetches it at a public URL.
 *
 * Run via: npm run build:bookstore-tbox
 */

import {
  mkdirSync, unlinkSync, writeFileSync
} from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DATA_DIR = join(ROOT, 'docs', 'public', 'data');
const UTILS_PATH = join(ROOT, 'docs', '.vitepress', 'theme', 'utils', 'bookstoreGraphData.ts');

// Use tsx to run a small extractor that imports the TS utility module
const tmpFile = join(tmpdir(), `bookstore-tbox-extract-${randomUUID()}.ts`);
const extractorContent = `
import { toJsonLd } from ${JSON.stringify(UTILS_PATH)};
process.stdout.write(JSON.stringify(toJsonLd()));
`;

writeFileSync(tmpFile, extractorContent, 'utf8');

let jsonLdContent;

try {
  const result = execFileSync(
    'npx',
    [
      'tsx',
      tmpFile
    ],
    {
      'cwd': ROOT,
      'encoding': 'utf8',
      'stdio': [
        'pipe',
        'pipe',
        'inherit'
      ]
    }
  );

  jsonLdContent = JSON.parse(result);
} finally {
  try {
    unlinkSync(tmpFile);
  } catch {
    // ignore cleanup error
  }
}

mkdirSync(DATA_DIR, { 'recursive': true });
writeFileSync(join(DATA_DIR, 'bookstore-tbox.jsonld'), JSON.stringify(jsonLdContent, null, 2));

const nodeCount = Array.isArray(jsonLdContent) ? jsonLdContent.length : Object.keys(jsonLdContent).length;

console.log(`bookstore-tbox.jsonld: ${nodeCount} nodes written`);
