/**
 * OWL codegen interfaces.
 *
 * Options and result contracts for the OWL 2 TBox → TypeScript code generator.
 */

/**
 * Options controlling the shape of the generated TypeScript source.
 */
export interface OwlCodegenOptions {
  /**
   * Base IRI used in the `JsonTology.create` call. Defaults to empty string,
   * which causes the generator to derive it from the first schema $id.
   */
  readonly 'baseIRI'?: string | undefined;

  /**
   * Extra comment lines inserted immediately after the auto-generated banner.
   * Each element is emitted as a separate `// ` comment line.
   */
  readonly 'header'?: readonly string[] | undefined;

  /**
   * Import path for `InferType`. Defaults to `'json-tology/types'`.
   */
  readonly 'inferTypeImportPath'?: string | undefined;

  /**
   * Name of the exported registry array constant and registry instance.
   * E.g. `'foaf'` → `foafSchemas`, `foaf`.
   * Defaults to `'registry'`.
   */
  readonly 'registryConstName'?: string | undefined;

  /**
   * Human-readable label for the source (file path or IRI) emitted in the
   * auto-generated banner.
   */
  readonly 'sourceLabel'?: string | undefined;
}

/**
 * Describes one entity file produced by {@link generateRegistryFiles}.
 */
export interface RegistryFileEntry {
  /** Full IRI of the OWL class this file represents. */
  readonly 'iri': string;
  /** PascalCase identifier (without `Schema` suffix), e.g. `Person`. */
  readonly 'name': string;
  /** Relative path inside the output directory, e.g. `entities/Person.ts`. */
  readonly 'path': string;
  /** The TypeScript source content of this entity file. */
  readonly 'source': string;
}

/**
 * Result returned by {@link generateRegistryFiles}.
 */
export interface RegistryFilesResult {
  /** Metadata + source for each generated `entities/<Name>.ts` file. */
  readonly 'entityFiles': readonly RegistryFileEntry[];
  /** Source content for the generated `index.ts` file. */
  readonly 'indexSource': string;
}

/**
 * Options controlling registry-directory-mode code generation.
 */
export interface OwlRegistryDirOptions {
  /**
   * Base IRI used in the `JsonTology.create` call.
   * Defaults to an IRI derived from the first schema `$id`.
   */
  readonly 'baseIRI'?: string | undefined;

  /**
   * Extra comment lines inserted after the auto-generated banner in the
   * `index.ts` file. Each element is emitted as a `// ` comment line.
   */
  readonly 'header'?: readonly string[] | undefined;

  /**
   * Name of the exported registry constant and schemas array.
   * E.g. `'foaf'` → `foafSchemas`, `foaf`.
   * Defaults to `'registry'`.
   */
  readonly 'registryConstName'?: string | undefined;

  /**
   * Human-readable label for the source (file path or IRI) emitted in the
   * auto-generated banner.
   */
  readonly 'sourceLabel'?: string | undefined;
}
