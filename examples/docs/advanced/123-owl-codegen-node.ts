/**
 * owl-gen-node — writeFromTbox and writeRegistryDirectory.
 *
 * The Node-only `owl-gen-node` entry adds disk I/O over the browser-safe
 * `owl-gen` core. `writeFromTbox` writes a single TypeScript source file;
 * `writeRegistryDirectory` writes `entities/<Name>.ts` per OWL class plus
 * an `index.ts` that constructs the full registry.
 *
 * This example writes to a unique temp directory under `os.tmpdir()` and
 * removes it on completion. No files are left in the repository.
 */

import {
  existsSync, mkdirSync, rmSync
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  writeFromTbox, writeRegistryDirectory
} from '../../../src/owl-gen-node.js';
import { foafSubset } from '../ontologies/foaf-subset.js';

// Unique temp directory — isolated per run, removed on completion.
const tempDir = join(tmpdir(), `jt-example-123-${Date.now()}`);

mkdirSync(tempDir, { 'recursive': true });

try {
  // ── writeFromTbox ────────────────────────────────────────────────────────
  // Writes a single TypeScript source file containing all OWL class schemas
  // derived from the TBox. The generated file exports `as const` schema
  // literals and re-exports `InferType`-derived types.
  const singleOutput = join(tempDir, 'foaf-schemas.ts');

  writeFromTbox({
    'input': JSON.stringify(foafSubset),
    'name': 'foaf',
    'output': singleOutput
  });

  console.assert(
    existsSync(singleOutput),
    'writeFromTbox must write the output file to disk'
  );
  console.log('writeFromTbox wrote:', singleOutput);

  // ── writeRegistryDirectory ───────────────────────────────────────────────
  // Writes `entities/<Name>.ts` per OWL class and `index.ts` that constructs
  // the full registry. Returns absolute paths for all written files.
  const dirOutput = join(tempDir, 'foaf-dir');

  const result = writeRegistryDirectory({
    'input': JSON.stringify(foafSubset),
    'name': 'foaf',
    'outDir': dirOutput
  });

  console.assert(
    result.entityFiles.length > 0,
    'writeRegistryDirectory must write at least one entity file'
  );

  const indexExists = existsSync(result.indexFile);

  console.assert(
    indexExists,
    'writeRegistryDirectory must write an index.ts file'
  );

  for (const entityFile of result.entityFiles) {
    console.assert(
      existsSync(entityFile.path),
      `entity file must exist on disk: ${entityFile.path}`
    );
  }

  console.log('writeRegistryDirectory entity files:', result.entityFiles.length);
  console.log('index.ts exists:', indexExists);
  console.log(
    'entity names:',
    result.entityFiles.map((entityFile) => {
      return entityFile.name;
    }).join(', ')
  );
} finally {
  // Always remove the temp directory — leaves no repo files.
  rmSync(tempDir, {
    'force': true,
    'recursive': true
  });
  console.log('temp directory removed (clean)');
}
