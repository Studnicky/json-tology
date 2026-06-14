/**
 * owl-gen-node — Node-only file-writing skin over the browser-safe owl-gen core.
 *
 * The codegen itself lives in `json-tology/owl-gen` and is fully browser-safe
 * (returns strings/data). This entry adds the outer Node I/O layer: it imports
 * `node:fs`/`node:path` and writes the generated source to disk. Import it from
 * build scripts, the CLI, or any Node.js tooling that needs files on disk.
 *
 * @example
 * import { writeFromTbox } from 'json-tology/owl-gen-node';
 * writeFromTbox({ input: myJsonLd, name: 'acl', output: './src/acl-registry.ts' });
 *
 * @example
 * import { writeRegistryDirectory } from 'json-tology/owl-gen-node';
 * const written = writeRegistryDirectory({ input: myJsonLd, name: 'acl', outDir: './src/generated/acl' });
 * console.log(written.indexFile);
 */

import {
  mkdirSync, writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import {
  generateFromTbox, generateRegistryDirectory
} from './owl-gen.js';
import type {
  GenerateFromTboxOptionsType,
  GenerateRegistryDirectoryOptionsType,
  WrittenEntityFileType
} from './types/OwlGen.js';

export type { WrittenEntityFileType } from './types/OwlGen.js';

/**
 * Generate TypeScript source from an OWL 2 TBox and write it to `output`.
 *
 * @param options - Browser-safe codegen options plus the `output` file path.
 */
export function writeFromTbox(options: GenerateFromTboxOptionsType & { readonly 'output': string }): void {
  const {
    output,
    ...rest
  } = options;

  writeFileSync(output, generateFromTbox(rest), 'utf8');
}

/**
 * Generate a full registry directory from an OWL 2 TBox and write it to `outDir`.
 *
 * Writes `<outDir>/entities/<Name>.ts` per OWL class plus `<outDir>/index.ts`.
 *
 * @param options - Browser-safe codegen options plus the `outDir` directory.
 * @returns The written entity files (absolute paths) and the `index.ts` path.
 */
export function writeRegistryDirectory(options: GenerateRegistryDirectoryOptionsType & { readonly 'outDir': string }): { readonly 'entityFiles': readonly WrittenEntityFileType[];
  readonly 'indexFile': string } {
  const {
    outDir,
    ...rest
  } = options;

  const result = generateRegistryDirectory(rest);

  mkdirSync(join(outDir, 'entities'), { 'recursive': true });

  const entityFiles: WrittenEntityFileType[] = [];

  for (const entityFile of result.entityFiles) {
    const absPath = join(outDir, entityFile.path);

    writeFileSync(absPath, entityFile.source, 'utf8');
    entityFiles.push({
      'iri': entityFile.iri,
      'name': entityFile.name,
      'path': absPath
    });
  }

  const indexFile = join(outDir, 'index.ts');

  writeFileSync(indexFile, result.indexSource, 'utf8');

  return {
    entityFiles,
    indexFile
  };
}
