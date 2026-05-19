/**
 * owl-gen — programmatic API for OWL TBox → TypeScript codegen.
 *
 * Import this entry point from build scripts, vite plugins, tsup hooks,
 * or any Node.js tooling that needs to generate typed registry source.
 *
 * @example
 * import { generateFromTbox } from 'json-tology/owl-gen';
 * const src = generateFromTbox({ input: myJsonLd, name: 'acl' });
 * fs.writeFileSync('src/acl-registry.ts', src);
 */

import { writeFileSync } from 'node:fs';
import { JsonTology } from './JsonTology.js';
import type { QuadInterface } from './interfaces/Quad.js';
import type { OwlCodegenOptions } from './modules/codegen/OwlCodegen.js';
import { generateTypeScript } from './modules/codegen/OwlCodegen.js';

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

export type { OwlCodegenOptions } from './modules/codegen/OwlCodegen.js';
