import type { JsonSchemaDocumentObjectType } from './Schema.js';

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

/**
 * Named return type for {@link buildNameMap}.
 *
 * `nameMap` is an IRI-to-PascalCase-name map.  `collisions` is the set of
 * base names for which at least two IRIs produced the same local name — those
 * entries are suffixed with `_2`, `_3`, etc. in `nameMap`.
 *
 * @remarks
 * Used internally by `generateTypeScript` and `generateRegistryFiles` to
 * ensure every OWL class gets a unique TypeScript identifier.
 *
 * @example
 * ```ts
 * const { nameMap, collisions } = buildNameMap(iris);
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export interface BuildNameMapResultInterface {
  /** Set of base names that collided (used for banner warnings). */
  readonly 'collisions': Set<string>;
  /** Map from IRI to its assigned PascalCase identifier. */
  readonly 'nameMap': Map<string, string>;
}

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
 * Options object for the {@link emitBanner} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit the auto-generated banner comment
 * block into a single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * emitBanner(lines, { ts, sourceLabel, collisions, header });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export interface EmitBannerOptionsInterface {
  /** Set of IRI base names that collided during name generation. */
  readonly 'collisions': Set<string>;
  /** Extra comment lines to append after the standard banner. */
  readonly 'header': readonly string[];
  /** Human-readable source label (file path or IRI), or empty string. */
  readonly 'sourceLabel': string;
  /** ISO-8601 timestamp string. */
  readonly 'ts': string;
}

/**
 * Options object for the {@link emitSchemaConstants} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit per-class schema constants into a
 * single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * emitSchemaConstants(lines, { sortedIris, nameMap, schemas });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export interface EmitSchemaConstantsOptionsInterface {
  /** Map from IRI to PascalCase identifier. */
  readonly 'nameMap': Map<string, string>;
  /** All consumer-facing schemas. */
  readonly 'schemas': JsonSchemaDocumentObjectType[];
  /** IRIs in emission order. */
  readonly 'sortedIris': string[];
}

/**
 * Options object for the {@link emitRegistryConstruction} helper.
 *
 * @remarks
 * Bundles the parameters needed to emit the registry array and
 * `JsonTology.create()` call into a single options shape.
 *
 * @example
 * ```ts
 * emitRegistryConstruction(lines, { schemasConst, registryConstName, schemaNames, effectiveBaseIRI });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export interface EmitRegistryOptionsInterface {
  /** Effective base IRI for `JsonTology.create`. */
  readonly 'effectiveBaseIRI': string;
  /** Name of the exported registry constant. */
  readonly 'registryConstName': string;
  /** Ordered list of PascalCase schema identifiers. */
  readonly 'schemaNames': string[];
  /** Name of the exported schemas array constant. */
  readonly 'schemasConst': string;
}

/**
 * Options object for the {@link buildEntityFileSource} helper.
 *
 * @remarks
 * Bundles the parameters needed to build a single entity file source string
 * into a single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * buildEntityFileSource({ iri, name, schema, ts, sourceLabel });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateRegistryFiles}
 * @group OWL Codegen
 */
export interface BuildEntityFileOptionsInterface {
  /** Full IRI of the OWL class. */
  readonly 'iri': string;
  /** PascalCase identifier for this class. */
  readonly 'name': string;
  /** The JSON Schema object for this class. */
  readonly 'schema': JsonSchemaDocumentObjectType;
  /** Human-readable source label (file path or IRI), or empty string. */
  readonly 'sourceLabel': string;
  /** ISO-8601 timestamp string. */
  readonly 'ts': string;
}

/**
 * Serialization context for the literal-serializer helpers.
 *
 * @remarks
 * Bundles the pad and innerPad strings with the current indent depth so
 * the array and object serializer helpers do not need separate parameters.
 *
 * @example
 * ```ts
 * const ctx: SerializeContextType = { pad, innerPad, indent };
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export interface SerializeContextInterface {
  /** Current indentation depth (number of spaces). */
  readonly 'indent': number;
  /** Inner padding string for one level deeper. */
  readonly 'innerPad': string;
  /** Outer padding string for the current level. */
  readonly 'pad': string;
}

/**
 * Options object for {@link buildEntityFiles} and {@link buildIndexSource}.
 *
 * @remarks
 * Bundles the common registry-directory context into a single shape so
 * helpers with many parameters can accept a single options object.
 *
 * @example
 * ```ts
 * buildEntityFiles({ sortedIris, nameMap, schemas, ts, sourceLabel });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateRegistryFiles}
 * @group OWL Codegen
 */
export interface RegistryDirContextInterface {
  /** Map from IRI to PascalCase identifier. */
  readonly 'nameMap': Map<string, string>;
  /** All consumer-facing schemas. */
  readonly 'schemas': JsonSchemaDocumentObjectType[];
  /** Sorted IRIs in emission order. */
  readonly 'sortedIris': string[];
  /** Human-readable source label, or empty string. */
  readonly 'sourceLabel': string;
  /** ISO-8601 timestamp string. */
  readonly 'ts': string;
}

/**
 * Options object for {@link buildIndexSource}.
 *
 * @remarks
 * Bundles all parameters needed to generate the index.ts content for
 * registry-directory mode into a single options shape.
 *
 * @example
 * ```ts
 * buildIndexSource({ ctx, collisions, header, schemasConst, registryConstName, effectiveBaseIRI, result });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateRegistryFiles}
 * @group OWL Codegen
 */
export interface BuildIndexSourceOptionsInterface {
  /** Set of IRI base names that collided during name generation. */
  readonly 'collisions': Set<string>;
  /** Effective base IRI for `JsonTology.create`. */
  readonly 'effectiveBaseIRI': string;
  /** Extra comment lines for the banner. */
  readonly 'header': readonly string[];
  /** Name of the exported registry constant. */
  readonly 'registryConstName': string;
  /** Name of the schemas array constant. */
  readonly 'schemasConst': string;
}

/**
 * Options object for {@link processKahnStep}.
 *
 * @remarks
 * Bundles the mutable state for a single Kahn's algorithm processing step
 * into a single options shape, satisfying the parameter-count limit.
 *
 * @example
 * ```ts
 * processKahnStep({ current, deps, fwdInDegree, visited, queue });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export interface KahnStepOptionsInterface {
  /** The IRI currently being processed. */
  readonly 'current': string;
  /** Forward dependency map. */
  readonly 'deps': BuildDepsMapType;
  /** Mutable in-degree map (updated in-place). */
  readonly 'fwdInDegree': BuildInDegreeMapType;
  /** Queue of IRIs ready to emit (appended in-place). */
  readonly 'queue': string[];
  /** Set of already-visited IRIs. */
  readonly 'visited': Set<string>;
}

/**
 * Options object for {@link buildSingleFileBody}.
 *
 * @remarks
 * Bundles the computed context for single-file mode TypeScript emission
 * so that `generateTypeScript` stays within the 50-line limit.
 *
 * @example
 * ```ts
 * buildSingleFileBody({ sortedIris, nameMap, schemas, effectiveBaseIRI, inferTypeImportPath, registryConstName });
 * ```
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export interface SingleFileBodyOptionsInterface {
  /** Effective base IRI for `JsonTology.create`. */
  readonly 'effectiveBaseIRI': string;
  /** Import path for `InferType`. */
  readonly 'inferTypeImportPath': string;
  /** Map from IRI to PascalCase identifier. */
  readonly 'nameMap': Map<string, string>;
  /** Name of the exported registry constant. */
  readonly 'registryConstName': string;
  /** All consumer-facing schemas. */
  readonly 'schemas': JsonSchemaDocumentObjectType[];
  /** Sorted IRIs in emission order. */
  readonly 'sortedIris': string[];
}
