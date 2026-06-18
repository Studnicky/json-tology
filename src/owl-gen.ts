/**
 * owl-gen — browser-safe programmatic API for OWL TBox → TypeScript codegen.
 *
 * This entry point is fully browser-safe: it has no `node:` imports and returns
 * generated source as strings/data. File-writing is in the Node-only skin:
 * `json-tology/owl-gen-node` (`writeFromTbox` / `writeRegistryDirectory`).
 *
 * Two functions:
 *   - Single-file: `generateFromTbox` → all schemas + registry in one TS string.
 *   - Registry-directory: `generateRegistryDirectory` → per-entity source files
 *     plus an `index.ts` source, returned as data (no disk I/O).
 *
 * @example
 * // Browser / bundler / Vite plugin — string return only
 * import { generateFromTbox } from 'json-tology/owl-gen';
 * const source = generateFromTbox({ input: myJsonLd, name: 'acl' });
 * // pass `source` to your virtual-module plugin, a Blob, or a Node writer
 *
 * @example
 * // Node.js — use the node skin for disk I/O
 * import { writeFromTbox } from 'json-tology/owl-gen-node';
 * writeFromTbox({ input: myJsonLd, name: 'acl', output: './src/acl-registry.ts' });
 *
 * @example
 * // Registry-directory — browser-safe data return
 * import { generateRegistryDirectory } from 'json-tology/owl-gen';
 * const result = generateRegistryDirectory({ input: myJsonLd, name: 'acl' });
 * for (const file of result.entityFiles) {
 *   console.log(file.path, file.source.length); // relative path + source string
 * }
 *
 * @example
 * // Registry-directory — Node.js disk I/O
 * import { writeRegistryDirectory } from 'json-tology/owl-gen-node';
 * const written = writeRegistryDirectory({ input: myJsonLd, name: 'acl', outDir: './src/generated/acl' });
 * console.log(written.indexFile); // absolute path
 */

import { JsonTology } from './JsonTology.js';
import type {
  GenerateFromTboxOptionsType,
  GenerateRegistryDirectoryOptionsType,
  GenerateRegistryDirectoryResultType
} from './types/OwlGen.js';
import type {
  OwlCodegenOptionsType,
  OwlRegistryDirOptionsType
} from './types/OwlCodegen.js';
import { OwlCodegen } from './modules/codegen/OwlCodegen.js';

export type {
  OwlCodegenOptionsType, OwlRegistryDirOptionsType
} from './modules/codegen/OwlCodegen.js';

/**
 * Generate TypeScript source from an OWL 2 TBox.
 *
 * Browser-safe: always returns the generated source string. No disk I/O.
 * For file writing, use `writeFromTbox` from `json-tology/owl-gen-node`.
 *
 * @param options - Input source and codegen knobs.
 * @returns The generated TypeScript source string.
 *
 * @example
 * const source = generateFromTbox({ input: myJsonLd, name: 'acl' });
 * fs.writeFileSync('src/acl-registry.ts', source);
 */
export function generateFromTbox(options: GenerateFromTboxOptionsType): string {
  const {
    baseIRI,
    header,
    input,
    name,
    sourceLabel
  } = options;

  const result = JsonTology.fromTbox(input);

  const defaultSourceLabel = typeof input === 'string' ? input.slice(0, 80) : '(object/quads)';

  const codegenOptions: OwlCodegenOptionsType = {
    ...(!(baseIRI === undefined) && { 'baseIRI': baseIRI }),
    ...(!(header === undefined) && { 'header': header }),
    ...(!(name === undefined) && { 'registryConstName': name }),
    'sourceLabel': sourceLabel ?? defaultSourceLabel
  };

  return OwlCodegen.toTypeScript(result, codegenOptions);
}

// ---------------------------------------------------------------------------
// Registry-directory mode
// ---------------------------------------------------------------------------

/**
 * Generate a full registry directory source from an OWL 2 TBox.
 *
 * Browser-safe: returns generated files as data — relative paths and source
 * strings — without writing to disk. For file writing, use
 * `writeRegistryDirectory` from `json-tology/owl-gen-node`.
 *
 * The returned `entityFiles` array contains one entry per OWL class with:
 *   - `iri` — full class IRI
 *   - `name` — PascalCase class name
 *   - `path` — relative path, e.g. `entities/Person.ts`
 *   - `source` — TypeScript source string
 *
 * @param options - Input source and codegen knobs (no `outDir`).
 * @returns Generated entity files (relative paths + source) and `indexSource`.
 *
 * @example
 * const result = generateRegistryDirectory({ input: myJsonLd, name: 'acl' });
 * for (const f of result.entityFiles) {
 *   fs.writeFileSync(join(outDir, f.path), f.source, 'utf8');
 * }
 * fs.writeFileSync(join(outDir, 'index.ts'), result.indexSource, 'utf8');
 */
export function generateRegistryDirectory(options: GenerateRegistryDirectoryOptionsType): GenerateRegistryDirectoryResultType {
  const {
    baseIRI,
    header,
    input,
    name,
    sourceLabel
  } = options;

  const result = JsonTology.fromTbox(input);

  const defaultSourceLabel = typeof input === 'string' ? input.slice(0, 80) : '(object/quads)';

  const codegenOptions: OwlRegistryDirOptionsType = {
    ...(!(baseIRI === undefined) && { 'baseIRI': baseIRI }),
    ...(!(header === undefined) && { 'header': header }),
    ...(!(name === undefined) && { 'registryConstName': name }),
    'sourceLabel': sourceLabel ?? defaultSourceLabel
  };

  return OwlCodegen.toRegistryFiles(result, codegenOptions);
}

export type {
  GenerateFromTboxOptionsType,
  GenerateRegistryDirectoryEntityFileType,
  GenerateRegistryDirectoryOptionsType,
  GenerateRegistryDirectoryResultType,
  WrittenEntityFileType
} from './types/OwlGen.js';
