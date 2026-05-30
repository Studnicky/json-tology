/**
 * build-bookstore-tbox.mjs
 *
 * Runs the single-source-of-truth utility (bookstoreGraphData.ts) at build
 * time in Node and writes the three outputs the docs site needs:
 *
 *   docs/public/data/bookstore-tbox.jsonld   — for the WebVOWL iframe
 *   docs/public/data/bookstore-graph.json    — for the Cytoscape <BookstoreGraph /> component
 *   docs/public/data/bookstore-schemas.json  — schema literals for the click-to-inspect panel
 *
 * Why build-time and not browser-runtime: json-tology imports `node:net` for
 * IP-format validation, which Vite cannot bundle into a browser build. The
 * utility module runs in Node here; the browser fetches the resulting JSON.
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

const tmpFile = join(tmpdir(), `bookstore-extract-${randomUUID()}.ts`);
const extractorContent = `
import { toCytoscapeElements, toJsonLd, toJsonLdMap, toSchemaMap } from ${JSON.stringify(UTILS_PATH)};
process.stdout.write(JSON.stringify({
  cytoscape: toCytoscapeElements(),
  jsonLd: toJsonLd(),
  jsonLdMap: toJsonLdMap(),
  schemaMap: toSchemaMap()
}));
`;

writeFileSync(tmpFile, extractorContent, 'utf8');

let payload;

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

  payload = JSON.parse(result);
} finally {
  try {
    unlinkSync(tmpFile);
  } catch {
    // ignore cleanup error
  }
}

mkdirSync(DATA_DIR, { 'recursive': true });
writeFileSync(join(DATA_DIR, 'bookstore-tbox.jsonld'), JSON.stringify(payload.jsonLd, null, 2));
writeFileSync(join(DATA_DIR, 'bookstore-graph.json'), JSON.stringify(payload.cytoscape, null, 2));
writeFileSync(join(DATA_DIR, 'bookstore-schemas.json'), JSON.stringify(payload.schemaMap, null, 2));
writeFileSync(join(DATA_DIR, 'bookstore-jsonld.json'), JSON.stringify(payload.jsonLdMap, null, 2));

const nodeCount = payload.cytoscape.nodes.length;
const edgeCount = payload.cytoscape.edges.length;
const schemaCount = Object.keys(payload.schemaMap).length;
const jsonLdCount = Object.keys(payload.jsonLdMap).length;

console.log(`bookstore-graph.json:   ${nodeCount} nodes, ${edgeCount} edges`);
console.log(`bookstore-schemas.json: ${schemaCount} schemas`);
console.log(`bookstore-jsonld.json:  ${jsonLdCount} node fragments`);
console.log('bookstore-tbox.jsonld:  written for WebVOWL');
