import { build } from 'esbuild';
import {
  existsSync, rmSync
} from 'node:fs';

const outDir = 'dist-browser';

if (existsSync(outDir)) {
  rmSync(outDir, { 'recursive': true });
}

await build({
  'bundle': true,
  'conditions': [
    'browser',
    'import',
    'default'
  ],
  'entryPoints': {
    'json-tology': 'src/index.ts',
    'json-tology.ontology': 'src/ontology.ts',
    'json-tology.schema': 'src/schema.browser.ts',
    'json-tology.value': 'src/value.ts',
    'json-tology.viz': 'src/viz.ts'
  },
  'external': [],
  'format': 'esm',
  'logLevel': 'info',
  'metafile': true,
  'outdir': outDir,
  'platform': 'browser',
  'sourcemap': true,
  'target': 'es2022',
  'treeShaking': true
});

console.log('Browser bundle written to', outDir);
