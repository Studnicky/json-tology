/**
 * Return types for the OwlCodegen code-generation pipeline.
 *
 * Every helper in the OwlCodegen module that returns a structured value
 * declares that value as a named type here so the public contract is explicit
 * and the return-type naming rule is satisfied.
 *
 * @category Codegen
 * @since 0.18.0
 * @group OWL Codegen
 */

export type { BuildEntityFileOptionsType } from '../types/BuildEntityFileOptionsType.js';
export type { BuildIndexSourceOptionsType } from '../types/BuildIndexSourceOptionsType.js';
export type { BuildNameMapResultType } from '../types/BuildNameMapResultType.js';
export type { EmitBannerOptionsType } from '../types/EmitBannerOptionsType.js';
export type { EmitRegistryOptionsType } from '../types/EmitRegistryOptionsType.js';
export type { EmitSchemaConstantsOptionsType } from '../types/EmitSchemaConstantsOptionsType.js';
export type { KahnStepOptionsType } from '../types/KahnStepOptionsType.js';
export type { RegistryDirContextType } from '../types/RegistryDirContextType.js';
export type { SerializeContextType } from '../types/SerializeContextType.js';
export type { SingleFileBodyOptionsType } from '../types/SingleFileBodyOptionsType.js';

/**
 * Named return type for {@link buildDepsMap}.
 *
 * A map from each subject IRI to the set of IRIs it depends on via `$ref`.
 *
 * @remarks
 * Used by the topological sort to determine safe emission order for schema
 * constants: a schema must appear after all schemas it references.
 *
 * @example
 * ```ts
 * const deps = buildDepsMap(iris, schemaByIri, irisSet);
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export type BuildDepsMapType = Map<string, Set<string>>;

/**
 * Named return type for {@link buildInDegreeMap}.
 *
 * A map from each IRI to the count of schemas it directly depends on,
 * used as the forward in-degree during Kahn's topological sort.
 *
 * @remarks
 * When the in-degree reaches zero, the IRI has no unprocessed dependencies
 * and can safely be added to the sorted output.
 *
 * @example
 * ```ts
 * const inDegree = buildInDegreeMap(iris, deps);
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export type BuildInDegreeMapType = Map<string, number>;

/**
 * OWL codegen interfaces.
 *
 * Options and result contracts for the OWL 2 TBox → TypeScript code generator.
 *
 * @experimental This surface is subject to change before 1.0. Generated code
 * shapes and option names may evolve as the codegen path matures.
 */

/**
 * Options controlling the shape of the generated TypeScript source.
 */
export type OwlCodegenOptionsType = {
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
};

/**
 * Describes one entity file produced by {@link generateRegistryFiles}.
 */
export type RegistryFileEntryType = {
  /** Full IRI of the OWL class this file represents. */
  readonly 'iri': string;
  /** PascalCase identifier (without `Schema` suffix), e.g. `Person`. */
  readonly 'name': string;
  /** Relative path inside the output directory, e.g. `entities/Person.ts`. */
  readonly 'path': string;
  /** The TypeScript source content of this entity file. */
  readonly 'source': string;
};

/**
 * Result returned by {@link generateRegistryFiles}.
 */
export type RegistryFilesResultType = {
  /** Metadata + source for each generated `entities/<Name>.ts` file. */
  readonly 'entityFiles': readonly RegistryFileEntryType[];
  /** Source content for the generated `index.ts` file. */
  readonly 'indexSource': string;
};

/**
 * Options controlling registry-directory-mode code generation.
 */
export type OwlRegistryDirOptionsType = {
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
};
