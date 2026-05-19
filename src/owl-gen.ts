/**
 * owl-gen — programmatic API for OWL TBox → TypeScript codegen.
 *
 * Import this entry point from build scripts, vite plugins, tsup hooks,
 * or any Node.js tooling that needs to generate typed registry source.
 *
 * Two modes:
 *   - Single-file: `generateFromTbox` → all schemas + registry in one `.ts` file.
 *   - Registry-directory: `generateRegistryDirectory` → `entities/<Name>.ts` per class
 *     plus an `index.ts` that imports all entities and constructs the registry.
 *
 * @example
 * import { generateFromTbox } from 'json-tology/owl-gen';
 * const src = generateFromTbox({ input: myJsonLd, name: 'acl' });
 * fs.writeFileSync('src/acl-registry.ts', src);
 *
 * @example
 * import { generateRegistryDirectory } from 'json-tology/owl-gen';
 * generateRegistryDirectory({ input: myJsonLd, name: 'acl', outDir: './src/generated/acl' });
 */

import {
  mkdirSync, writeFileSync
} from 'node:fs';
import { join } from 'node:path';
import { JsonTology } from './JsonTology.js';
import type { QuadInterface } from './interfaces/Quad.js';
import type {
  OwlCodegenOptions,
  OwlRegistryDirOptions
} from './modules/codegen/OwlCodegen.js';
import {
  generateRegistryFiles,
  generateTypeScript
} from './modules/codegen/OwlCodegen.js';

/**
 * Options accepted by {@link generateFromTbox}.
 */
export interface GenerateFromTboxOptions {
  /**
   * Override the base IRI. When omitted the generator derives it from
   * the first schema `$id` in the import result.
   */
  readonly 'baseIRI'?: string | undefined;

  /**
   * Extra header comment lines inserted after the banner.
   */
  readonly 'header'?: readonly string[] | undefined;

  /**
   * The OWL 2 TBox source — a JSON-LD object, a JSON-LD string, or an
   * array of {@link QuadInterface} quads.
   */
  readonly 'input': object | QuadInterface[] | string;

  /**
   * Registry constant name (e.g. `'acl'` → `aclSchemas`, `acl`).
   * Defaults to `'registry'`.
   */
  readonly 'name'?: string | undefined;

  /**
   * Output file path. When provided, the source is written to that path
   * and the function returns `void`. When omitted, the source string is
   * returned.
   */
  readonly 'output'?: string | undefined;

  /**
   * Human-readable label emitted in the banner (file path or IRI).
   * When omitted, derived from `input` when it is a string.
   */
  readonly 'sourceLabel'?: string | undefined;
}

/**
 * Generate TypeScript source from an OWL 2 TBox.
 *
 * When `options.output` is provided the source is written to disk and
 * the function returns `void`. When omitted the source string is returned.
 *
 * @param options - Input source, optional output path, and codegen knobs.
 * @returns The generated TS source string when `output` is not set; `void` otherwise.
 */
export function generateFromTbox(
  options: GenerateFromTboxOptions & { 'output': string }
): void;
export function generateFromTbox(
  options: Omit<GenerateFromTboxOptions, 'output'> & { 'output'?: undefined }
): string;
export function generateFromTbox(options: GenerateFromTboxOptions): string | void {
  const {
    baseIRI,
    header,
    input,
    name,
    output,
    sourceLabel
  } = options;

  const result = JsonTology.fromTbox(input);

  const defaultSourceLabel = typeof input === 'string' ? input.slice(0, 80) : '(object/quads)';

  const codegenOptions: OwlCodegenOptions = {
    ...(baseIRI === undefined ? {} : { 'baseIRI': baseIRI }),
    ...(header === undefined ? {} : { 'header': header }),
    ...(name === undefined ? {} : { 'registryConstName': name }),
    'sourceLabel': sourceLabel ?? defaultSourceLabel
  };

  const source = generateTypeScript(result, codegenOptions);

  if (output === undefined) {
    return source;
  }

  writeFileSync(output, source, 'utf8');

  return undefined;
}

// ---------------------------------------------------------------------------
// Registry-directory mode
// ---------------------------------------------------------------------------

/**
 * Options accepted by {@link generateRegistryDirectory}.
 */
export interface GenerateRegistryDirectoryOptions {
  /**
   * Override the base IRI. When omitted the generator derives it from
   * the first schema `$id` in the import result.
   */
  readonly 'baseIRI'?: string | undefined;

  /**
   * Extra header comment lines inserted after the banner in `index.ts`.
   */
  readonly 'header'?: readonly string[] | undefined;

  /**
   * The OWL 2 TBox source — a JSON-LD object, a JSON-LD string, or an
   * array of {@link QuadInterface} quads.
   */
  readonly 'input': object | QuadInterface[] | string;

  /**
   * Registry constant name (e.g. `'acl'` → `aclSchemas`, `acl`).
   * Defaults to `'registry'`.
   */
  readonly 'name'?: string | undefined;

  /**
   * Directory to write the generated files to.
   * Created recursively when it does not yet exist.
   * An `entities/` subdirectory is created inside it.
   */
  readonly 'outDir': string;

  /**
   * Human-readable label emitted in the banner (file path or IRI).
   * When omitted, derived from `input` when it is a string.
   */
  readonly 'sourceLabel'?: string | undefined;
}

/**
 * Description of an entity file written by {@link generateRegistryDirectory}.
 */
export interface GenerateRegistryDirectoryEntityFile {
  /** Full IRI of the OWL class. */
  readonly 'iri': string;
  /** PascalCase class name without `Schema` suffix. */
  readonly 'name': string;
  /** Absolute file path as written. */
  readonly 'path': string;
}

/**
 * Generate a full registry directory from an OWL 2 TBox.
 *
 * Writes:
 *   - `<outDir>/entities/<Name>.ts` — one file per OWL class.
 *   - `<outDir>/index.ts` — imports all entities, constructs the registry,
 *     and re-exports all types and schema constants.
 *
 * @param options - Input source, output directory, and codegen knobs.
 * @returns Metadata about the written entity files and the `index.ts` path.
 */
export function generateRegistryDirectory(options: GenerateRegistryDirectoryOptions): {
  readonly 'entityFiles': readonly GenerateRegistryDirectoryEntityFile[];
  readonly 'indexFile': string;
} {
  const {
    baseIRI,
    header,
    input,
    name,
    outDir,
    sourceLabel
  } = options;

  const result = JsonTology.fromTbox(input);

  const defaultSourceLabel = typeof input === 'string' ? input.slice(0, 80) : '(object/quads)';

  const codegenOptions: OwlRegistryDirOptions = {
    ...(baseIRI === undefined ? {} : { 'baseIRI': baseIRI }),
    ...(header === undefined ? {} : { 'header': header }),
    ...(name === undefined ? {} : { 'registryConstName': name }),
    'sourceLabel': sourceLabel ?? defaultSourceLabel
  };

  const filesResult = generateRegistryFiles(result, codegenOptions);

  // Write entities/ subdirectory
  const entitiesDir = join(outDir, 'entities');

  mkdirSync(entitiesDir, { 'recursive': true });

  const writtenEntityFiles: GenerateRegistryDirectoryEntityFile[] = [];

  for (const entityFile of filesResult.entityFiles) {
    const absPath = join(outDir, entityFile.path);

    writeFileSync(absPath, entityFile.source, 'utf8');
    writtenEntityFiles.push({
      'iri': entityFile.iri,
      'name': entityFile.name,
      'path': absPath
    });
  }

  // Write index.ts
  const indexPath = join(outDir, 'index.ts');

  writeFileSync(indexPath, filesResult.indexSource, 'utf8');

  return {
    'entityFiles': writtenEntityFiles,
    'indexFile': indexPath
  };
}

export type {
  OwlCodegenOptions, OwlRegistryDirOptions
} from './modules/codegen/OwlCodegen.js';
