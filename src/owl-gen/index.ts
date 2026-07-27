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

import { JsonTology } from '../JsonTology.js';
import type { GenerateFromTboxOptionsInterface } from '../interfaces/GenerateFromTboxOptionsInterface.js';
import type { GenerateRegistryDirectoryOptionsInterface } from '../interfaces/GenerateRegistryDirectoryOptionsInterface.js';
import type { GenerateRegistryDirectoryResultEntity } from '../entities/GenerateRegistryDirectoryResultEntity.js';
import type { OwlCodegenOptionsInterface } from '../interfaces/OwlCodegenOptionsInterface.js';
import type { OwlRegistryDirOptionsInterface } from '../interfaces/OwlRegistryDirOptionsInterface.js';
import { OwlCodegen } from '../modules/codegen/OwlCodegen.js';

export type { GenerateRegistryDirectoryEntityFileEntity } from '../entities/GenerateRegistryDirectoryEntityFileEntity.js';
export type { GenerateRegistryDirectoryResultEntity } from '../entities/GenerateRegistryDirectoryResultEntity.js';

class OwlGen {
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
  static generateFromTbox(options: GenerateFromTboxOptionsInterface): string {
    const {
      baseIri,
      header,
      input,
      name,
      sourceLabel
    } = options;

    const result = JsonTology.fromTbox(input);

    const defaultSourceLabel = typeof input === 'string' ? input.slice(0, 80) : '(object/quads)';

    const codegenOptions: OwlCodegenOptionsInterface = {
      ...(!(baseIri === undefined) && { 'baseIri': baseIri }),
      ...(!(header === undefined) && { 'header': header }),
      ...(!(name === undefined) && { 'registryConstName': name }),
      'sourceLabel': sourceLabel ?? defaultSourceLabel
    };

    return OwlCodegen.toTypeScript(result, codegenOptions);
  }

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
  static generateRegistryDirectory(options: GenerateRegistryDirectoryOptionsInterface): GenerateRegistryDirectoryResultEntity.Type {
    const {
      baseIri,
      header,
      input,
      name,
      sourceLabel
    } = options;

    const result = JsonTology.fromTbox(input);

    const defaultSourceLabel = typeof input === 'string' ? input.slice(0, 80) : '(object/quads)';

    const codegenOptions: OwlRegistryDirOptionsInterface = {
      ...(!(baseIri === undefined) && { 'baseIri': baseIri }),
      ...(!(header === undefined) && { 'header': header }),
      ...(!(name === undefined) && { 'registryConstName': name }),
      'sourceLabel': sourceLabel ?? defaultSourceLabel
    };

    return OwlCodegen.toRegistryFiles(result, codegenOptions);
  }
}

// ---------------------------------------------------------------------------
// Public API — flat named exports for `json-tology/owl-gen` consumers.
// Aliasing a static method reference (not a function/arrow expression) keeps
// the documented `import { generateFromTbox } from 'json-tology/owl-gen'`
// surface stable while the implementation lives on a class.
// ---------------------------------------------------------------------------

export const generateFromTbox = OwlGen.generateFromTbox;
export const generateRegistryDirectory = OwlGen.generateRegistryDirectory;

export type { WrittenEntityFileEntity } from '../entities/WrittenEntityFileEntity.js';
export type { GenerateFromTboxOptionsInterface } from '../interfaces/GenerateFromTboxOptionsInterface.js';
export type { GenerateRegistryDirectoryOptionsInterface } from '../interfaces/GenerateRegistryDirectoryOptionsInterface.js';
export type { OwlCodegenOptionsInterface } from '../interfaces/OwlCodegenOptionsInterface.js';
export type { OwlRegistryDirOptionsInterface } from '../interfaces/OwlRegistryDirOptionsInterface.js';
