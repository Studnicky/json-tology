/**
 * OwlCodegen — code generator for OWL 2 TBox import results.
 *
 * Pure functions:
 *   generateTypeScript(result, options)   → single TS source string (single-file mode).
 *   generateRegistryFiles(result, options) → per-entity file sources + index source
 *                                            (registry-directory mode).
 *
 * Single-file emission order:
 *   1. Auto-generated banner comment (timestamp, source IRI, "do not edit").
 *   2. Imports: JsonTology + InferType.
 *   3. Per-class `export const <Name>Schema = { ... } as const;`
 *      — dependency-ordered (primitives before composites).
 *   4. `export const <registryConst>Schemas = [...] as const;`
 *   5. `export const <registryConst> = JsonTology.create({ ... });`
 *   6. Per-class `export type <Name> = InferType<typeof <Name>Schema>;`
 *   7. sameAs / addCharacteristic calls.
 *   8. Closing footer comment.
 *
 * Registry-directory mode produces:
 *   entities/<Name>.ts  — one file per class, `<Name>Schema as const` + `type <Name>`
 *   index.ts            — imports all entities, builds schemas array + registry,
 *                         re-exports types and schema constants
 */

import type { OwlImportResult } from '../../interfaces/OwlImport.js';
import type {
  OwlCodegenOptions, OwlRegistryDirOptions, RegistryFileEntry, RegistryFilesResult
} from '../../interfaces/OwlCodegen.js';
import type { JsonSchemaDocumentObjectType } from '../../types/Schema.js';
import type {
  BuildDepsMapType,
  BuildEntityFileOptionsInterface,
  BuildInDegreeMapType,
  BuildIndexSourceOptionsInterface,
  BuildNameMapResultInterface,
  EmitBannerOptionsInterface,
  EmitRegistryOptionsInterface,
  EmitSchemaConstantsOptionsInterface,
  KahnStepOptionsInterface,
  RegistryDirContextInterface,
  SerializeContextInterface,
  SingleFileBodyOptionsInterface
} from '../../types/OwlCodegen.js';

export type {
  OwlCodegenOptions, OwlRegistryDirOptions, RegistryFileEntry, RegistryFilesResult
} from '../../interfaces/OwlCodegen.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the local name from an IRI and return it capitalised.
 *
 * Resolution priority:
 *   1. After '#' fragment identifier — `http://example.com/ns#Widget` → `Widget`
 *   2. After last '/' segment — `http://example.com/Widget` → `Widget`
 *   3. After last ':' (URN-style) — `urn:example:Widget` → `Widget`
 *   4. Fallback: PascalCase the whole IRI stripped of non-word chars.
 */
function localName(iri: string): string {
  const hashIdx = iri.indexOf('#');

  if (hashIdx !== -1) {
    const fragment = iri.slice(hashIdx + 1);

    if (fragment.length > 0) {
      return fragment.charAt(0).toUpperCase() + fragment.slice(1);
    }
  }

  const slashIdx = iri.lastIndexOf('/');

  if (slashIdx !== -1) {
    const segment = iri.slice(slashIdx + 1);

    if (segment.length > 0) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
  }

  const colonIdx = iri.lastIndexOf(':');

  if (colonIdx !== -1) {
    const segment = iri.slice(colonIdx + 1);

    if (segment.length > 0) {
      return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
  }

  return iri
    .replaceAll(/\W+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .map((word: string): string => {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
}

/**
 * Build a collision-free name → IRI map. When multiple IRIs collapse to the
 * same PascalCase name, suffix duplicates with `_2`, `_3`, etc.
 * Returns `{ nameMap, collisions }` where `collisions` is the set of base
 * names that collided (used for banner warnings).
 */
function buildNameMap(iris: readonly string[]): BuildNameMapResultInterface {
  // base name → first IRI that claimed it
  const nameMap = new Map<string, string>();
  const iriToName = new Map<string, string>();
  const collisions = new Set<string>();
  const counters = new Map<string, number>();

  for (const iri of iris) {
    const base = localName(iri);
    const existing = nameMap.get(base);

    if (existing === undefined) {
      nameMap.set(base, iri);
      iriToName.set(iri, base);
      counters.set(base, 1);
    } else {
      collisions.add(base);
      const n = (counters.get(base) ?? 1) + 1;

      counters.set(base, n);
      const suffixed = `${base}_${n}`;

      iriToName.set(iri, suffixed);
    }
  }

  // Build a clean iri→name map from iriToName
  const result = new Map<string, string>(iriToName);

  return {
    collisions,
    'nameMap': result
  };
}

// ---------------------------------------------------------------------------
// topoSort helpers
// ---------------------------------------------------------------------------

/** Collect all $ref IRIs from an object tree that are present in the known set. */
function collectRefs(obj: unknown, irisSet: Set<string>, acc: Set<string>): void {
  if (obj === null || typeof obj !== 'object') {
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectRefs(item, irisSet, acc);
    }

    return;
  }

  const rec = obj as Record<string, unknown>;

  if (typeof rec.$ref === 'string' && irisSet.has(rec.$ref)) {
    acc.add(rec.$ref);
  }

  for (const val of Object.values(rec)) {
    collectRefs(val, irisSet, acc);
  }
}

/** Build the forward dependency map: IRI → set of IRIs it depends on. */
function buildDepsMap(
  iris: readonly string[],
  schemaByIri: Map<string, JsonSchemaDocumentObjectType>,
  irisSet: Set<string>
): BuildDepsMapType {
  const deps = new Map<string, Set<string>>();

  for (const iri of iris) {
    const schema = schemaByIri.get(iri);
    const refs = new Set<string>();

    if (schema !== undefined) {
      const {
        '$id': _id,
        ...rest
      } = schema;

      void _id;
      collectRefs(rest, irisSet, refs);
    }

    deps.set(iri, refs);
  }

  return deps;
}

/** Build the initial in-degree map (number of deps each IRI has). */
function buildInDegreeMap(iris: readonly string[], deps: BuildDepsMapType): BuildInDegreeMapType {
  const fwdInDegree: BuildInDegreeMapType = new Map<string, number>();

  for (const iri of iris) {
    fwdInDegree.set(iri, deps.get(iri)?.size ?? 0);
  }

  return fwdInDegree;
}

/** Build the initial processing queue: IRIs with no dependencies first. */
function buildInitialQueue(iris: readonly string[], fwdInDegree: Map<string, number>): string[] {
  const queue: string[] = [];

  for (const iri of iris) {
    if ((fwdInDegree.get(iri) ?? 0) === 0) {
      queue.push(iri);
    }
  }

  return queue;
}

/** Reduce the in-degree of dependents and enqueue newly-zero entries. */
function processKahnStep(opts: KahnStepOptionsInterface): void {
  const {
    current,
    deps,
    fwdInDegree,
    queue,
    visited
  } = opts;

  for (const [
    iri,
    refSet
  ] of deps.entries()) {
    if (refSet.has(current) && !visited.has(iri)) {
      const newDeg = (fwdInDegree.get(iri) ?? 1) - 1;

      fwdInDegree.set(iri, newDeg);

      if (newDeg === 0) {
        queue.push(iri);
      }
    }
  }
}

/** Run Kahn's algorithm on the forward dependency graph and return sorted IRIs. */
function kahnSort(iris: readonly string[], deps: BuildDepsMapType): string[] {
  const fwdInDegree = buildInDegreeMap(iris, deps);
  const queue = buildInitialQueue(iris, fwdInDegree);
  const sorted: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    visited.add(current);
    sorted.push(current);
    processKahnStep({
      current,
      deps,
      fwdInDegree,
      queue,
      visited
    });
  }

  // Append any unvisited (cycles — treat as-is)
  for (const iri of iris) {
    if (!visited.has(iri)) {
      sorted.push(iri);
    }
  }

  return sorted;
}

/**
 * Topological sort: returns iris in dependency order (leaves first).
 * An IRI X depends on IRI Y if X's schema contains a `$ref` to Y.
 */
function topoSort(
  iris: readonly string[],
  schemas: readonly JsonSchemaDocumentObjectType[]
): string[] {
  const irisSet = new Set(iris);
  const schemaByIri = new Map<string, JsonSchemaDocumentObjectType>();

  for (const schema of schemas) {
    if (typeof schema.$id === 'string') {
      schemaByIri.set(schema.$id, schema);
    }
  }

  const deps = buildDepsMap(iris, schemaByIri, irisSet);

  return kahnSort(iris, deps);
}

/**
 * Derive the base IRI portion of an IRI (before '#' or last '/').
 * Used to compute the default baseIRI when one is not specified.
 */
function deriveBaseIRI(firstIri: string): string {
  const hashIdx = firstIri.indexOf('#');

  if (hashIdx !== -1) {
    return firstIri.slice(0, hashIdx);
  }

  const lastSlash = firstIri.lastIndexOf('/');

  return lastSlash > 0 ? firstIri.slice(0, lastSlash) : firstIri;
}

/** Serialize an array to a stable TS `as const` literal string. */
function serializeArrayLiteral(arr: unknown[], ctx: SerializeContextInterface): string {
  if (arr.length === 0) {
    return '[]';
  }

  const items = arr
    .map((item: unknown): string => {
      return `${ctx.innerPad}${serializeSchemaLiteral(item, ctx.indent + 2)}`;
    })
    .join(',\n');

  return `[\n${items},\n${ctx.pad}]`;
}

/** Serialize an object to a stable TS `as const` literal string. */
function serializeObjectLiteral(rec: Record<string, unknown>, ctx: SerializeContextInterface): string {
  const keys = Object.keys(rec).sort();

  if (keys.length === 0) {
    return '{}';
  }

  const entries = keys
    .map((key: string): string => {
      const val = serializeSchemaLiteral(rec[key], ctx.indent + 2);

      return `${ctx.innerPad}${JSON.stringify(key)}: ${val}`;
    })
    .join(',\n');

  return `{\n${entries},\n${ctx.pad}}`;
}

/**
 * Serialize a JSON Schema object to a stable TS `as const` literal string.
 * Keys are sorted lexicographically per the perfectionist/sort-objects rule.
 * Strings use JSON.stringify to avoid injection.
 */
function serializeSchemaLiteral(obj: unknown, indent: number): string {
  const pad = ' '.repeat(indent);
  const innerPad = ' '.repeat(indent + 2);
  const ctx: SerializeContextInterface = {
    indent,
    innerPad,
    pad
  };

  if (obj === null) {
    return 'null';
  }

  if (typeof obj === 'boolean' || typeof obj === 'number') {
    return String(obj);
  }

  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return serializeArrayLiteral(obj, ctx);
  }

  if (typeof obj === 'object') {
    return serializeObjectLiteral(obj as Record<string, unknown>, ctx);
  }

  return 'undefined';
}

// ---------------------------------------------------------------------------
// generateTypeScript helpers
// ---------------------------------------------------------------------------

/** Emit the auto-generated banner lines into an array. */
function emitBanner(lines: string[], opts: EmitBannerOptionsInterface): void {
  const {
    collisions,
    header,
    sourceLabel,
    ts
  } = opts;

  lines.push('// ============================================================');
  lines.push('// AUTO-GENERATED — DO NOT EDIT');
  lines.push(`// Generated: ${ts}`);

  if (sourceLabel !== '') {
    lines.push(`// Source:    ${sourceLabel}`);
  }

  if (collisions.size > 0) {
    lines.push('//');
    lines.push('// WARNING: IRI name collisions detected. Suffixed names used:');

    for (const collidedName of [...collisions].sort()) {
      lines.push(`//   ${collidedName} (_2, _3, ...)`);
    }
  }

  for (const line of header) {
    lines.push(`// ${line}`);
  }

  lines.push('// ============================================================');
  lines.push('');
}

/** Emit per-class schema constants in dependency order. */
function emitSchemaConstants(lines: string[], opts: EmitSchemaConstantsOptionsInterface): void {
  const {
    nameMap,
    schemas,
    sortedIris
  } = opts;

  for (const iri of sortedIris) {
    const name = nameMap.get(iri);

    if (name === undefined || name === '') {
      continue;
    }

    const schema = schemas.find((schemaEntry: JsonSchemaDocumentObjectType): boolean => {
      return schemaEntry.$id === iri;
    });

    if (schema === undefined) {
      continue;
    }

    const literal = serializeSchemaLiteral(schema, 0);

    lines.push(`export const ${name}Schema = ${literal} as const;`);
    lines.push('');
  }
}

/** Emit the registry array and JsonTology.create() call. */
function emitRegistryConstruction(lines: string[], opts: EmitRegistryOptionsInterface): void {
  const {
    effectiveBaseIRI,
    registryConstName,
    schemaNames,
    schemasConst
  } = opts;

  if (schemaNames.length === 0) {
    lines.push(`export const ${schemasConst} = [] as const;`);
  } else {
    const schemaRefs = schemaNames
      .map((constName: string): string => {
        return `  ${constName}Schema`;
      })
      .join(',\n');

    lines.push(`export const ${schemasConst} = [\n${schemaRefs},\n] as const;`);
  }

  lines.push('');

  const createArg = serializeSchemaLiteral(
    {
      'baseIRI': effectiveBaseIRI,
      'schemas': '__SCHEMAS_PLACEHOLDER__'
    },
    0
  );

  const createArgFixed = createArg.replace(
    '"__SCHEMAS_PLACEHOLDER__"',
    schemasConst
  );

  lines.push(`export const ${registryConstName} = JsonTology.create(${createArgFixed} as const);`);
  lines.push('');
}

/** Emit per-class type aliases. */
function emitTypeAliases(
  lines: string[],
  sortedIris: string[],
  nameMap: Map<string, string>,
  schemasConst: string
): void {
  const names = extractSchemaNames(sortedIris, nameMap);

  if (names.length === 0) {
    return;
  }

  // Reference map over the registered schema tuple. Threading it into each
  // per-class `InferType` resolves cross-class `$ref`s to the precise sibling
  // type instead of `unknown`, so the generated `.ts` round-trips losslessly:
  // a `$ref: B` on class A surfaces B's inferred type, not an opaque hole.
  const refsName = `${schemasConst}Refs`;

  lines.push(`type ${refsName} = SchemaReferencesMapType<typeof ${schemasConst}>;`);
  lines.push('');

  for (const name of names) {
    lines.push(`export type ${name} = InferType<typeof ${name}Schema, ${refsName}>;`);
  }

  lines.push('');
}

/** Emit owl:sameAs and addCharacteristic post-processing calls. */
function emitPostProcessing(
  lines: string[],
  result: OwlImportResult,
  registryConstName: string
): void {
  if (result.sameAs.length > 0) {
    lines.push('// owl:sameAs identity assertions');

    for (const sameAsPair of result.sameAs) {
      const iriA = sameAsPair[0];
      const iriB = sameAsPair[1];

      lines.push(`${registryConstName}.sameAs(${JSON.stringify(iriA)}, ${JSON.stringify(iriB)});`);
    }

    lines.push('');
  }

  if (result.characteristics.length > 0) {
    lines.push('// OWL property characteristics');

    for (const charEntry of result.characteristics) {
      const {
        characteristic,
        propertyIri
      } = charEntry;

      lines.push(`${registryConstName}.registry.addCharacteristic(${JSON.stringify(propertyIri)}, ${JSON.stringify(characteristic)});`);
    }

    lines.push('');
  }
}

/** Filter schemas to consumer-facing class IRIs (no pointer-fragment entries). */
function filterSchemas(schemas: readonly JsonSchemaDocumentObjectType[]): JsonSchemaDocumentObjectType[] {
  return schemas.filter((schema: JsonSchemaDocumentObjectType): boolean => {
    // Skip $ids carrying a JSON-pointer fragment (e.g. `urn:x:EBook#/allOf/1/if`).
    // These are internal scaffolds the forward projector emits when serialising
    // complex `allOf` / `if/then/else` structures; they are not consumer-facing
    // classes and would produce invalid TypeScript identifiers if exported.
    return typeof schema.$id === 'string'
      && schema.$id.length > 0
      && !schema.$id.includes('#/');
  });
}

/** Extract the list of named schema identifiers from the name map. */
function extractSchemaNames(sortedIris: string[], nameMap: Map<string, string>): string[] {
  const result: string[] = [];

  for (const iri of sortedIris) {
    const name = nameMap.get(iri);

    if (name !== undefined && name !== '') {
      result.push(name);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/** Emit the body of a single-file output: constants, registry, types, post-processing, footer. */
function buildSingleFileBody(
  lines: string[],
  opts: SingleFileBodyOptionsInterface,
  result: OwlImportResult
): void {
  const schemasConst = `${opts.registryConstName}Schemas`;
  const schemaNames = extractSchemaNames(opts.sortedIris, opts.nameMap);

  lines.push("import { JsonTology } from 'json-tology';");
  lines.push(`import type { InferType, SchemaReferencesMapType } from '${opts.inferTypeImportPath}';`);
  lines.push('');
  emitSchemaConstants(lines, {
    'nameMap': opts.nameMap,
    'schemas': opts.schemas,
    'sortedIris': opts.sortedIris
  });
  emitRegistryConstruction(lines, {
    'effectiveBaseIRI': opts.effectiveBaseIRI,
    'registryConstName': opts.registryConstName,
    schemaNames,
    schemasConst
  });
  emitTypeAliases(lines, opts.sortedIris, opts.nameMap, schemasConst);
  emitPostProcessing(lines, result, opts.registryConstName);
  lines.push('// ============================================================');
  lines.push('// END AUTO-GENERATED');
  lines.push('// ============================================================');
  lines.push('');
}

/**
 * Generate a TypeScript source string from an {@link OwlImportResult}.
 *
 * @remarks
 * The returned string is ready to write to a `.ts` file. It contains an
 * auto-generated banner, per-class schema constants ordered by dependency,
 * a registry construction call, per-class type aliases, and post-processing
 * calls for owl:sameAs and property characteristics.
 *
 * @example
 * ```ts
 * const ts = generateTypeScript(result, { registryConstName: 'foaf' });
 * await fs.writeFile('generated/foaf.ts', ts);
 * ```
 *
 * @param result - The import result from `JsonTology.fromTbox()`.
 * @param options - Codegen options (name, baseIRI, etc.).
 * @returns The generated TypeScript source string.
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateRegistryFiles}
 * @group OWL Codegen
 */
export function generateTypeScript(
  result: OwlImportResult,
  options: OwlCodegenOptions
): string {
  const {
    baseIRI = '',
    header = [],
    inferTypeImportPath = 'json-tology/types',
    registryConstName = 'registry',
    sourceLabel = ''
  } = options;

  const schemas = filterSchemas(result.schemas);
  const iris = schemas.map((schema: JsonSchemaDocumentObjectType): string => {
    return schema.$id as string;
  });

  const sortedIris = topoSort(iris, schemas);
  const {
    collisions,
    nameMap
  } = buildNameMap(sortedIris);

  const effectiveBaseIRI = baseIRI === '' ? deriveBaseIRI(iris[0] ?? '') : baseIRI;
  const lines: string[] = [];
  const ts = new Date().toISOString();

  emitBanner(lines, {
    collisions,
    header,
    sourceLabel,
    'ts': ts
  });
  buildSingleFileBody(lines, {
    effectiveBaseIRI,
    inferTypeImportPath,
    nameMap,
    registryConstName,
    schemas,
    'sortedIris': sortedIris
  }, result);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Registry-directory mode helpers
// ---------------------------------------------------------------------------

/** Build a single entity file source for registry-directory mode. */
function buildEntityFileSource(opts: BuildEntityFileOptionsInterface): string {
  const {
    iri,
    name,
    refsName,
    schema,
    sourceLabel,
    ts
  } = opts;
  const entityLines: string[] = [];

  entityLines.push('// ============================================================');
  entityLines.push('// AUTO-GENERATED — DO NOT EDIT');
  entityLines.push(`// Generated: ${ts}`);

  if (sourceLabel !== '') {
    entityLines.push(`// Source:    ${sourceLabel}`);
  }

  entityLines.push(`// IRI:       ${iri}`);
  entityLines.push('// ============================================================');
  entityLines.push('');
  entityLines.push("import type { InferType } from 'json-tology/types';");
  // Type-only import of the schema-set reference map from the index (erased at
  // runtime, so no import cycle): threading it resolves cross-class `$ref`s to the
  // precise sibling type instead of `unknown`.
  entityLines.push(`import type { ${refsName} } from '../index.js';`);
  entityLines.push('');

  const literal = serializeSchemaLiteral(schema, 0);

  entityLines.push(`export const ${name}Schema = ${literal} as const;`);
  entityLines.push('');
  entityLines.push(`export type ${name} = InferType<typeof ${name}Schema, ${refsName}>;`);
  entityLines.push('');

  return entityLines.join('\n');
}

/** Emit the index.ts imports from entity files. */
function emitEntityImports(indexLines: string[], schemaNames: string[]): void {
  for (const name of schemaNames) {
    indexLines.push(`import { ${name}Schema } from './entities/${name}.js';`);
  }

  indexLines.push('');
}

/** Build all per-entity RegistryFileEntry objects in dependency order. */
function buildEntityFiles(ctx: RegistryDirContextInterface): RegistryFileEntry[] {
  const entityFiles: RegistryFileEntry[] = [];

  for (const iri of ctx.sortedIris) {
    const name = ctx.nameMap.get(iri);

    if (name === undefined || name === '') {
      continue;
    }

    const schema = ctx.schemas.find((schemaEntry: JsonSchemaDocumentObjectType): boolean => {
      return schemaEntry.$id === iri;
    });

    if (schema === undefined) {
      continue;
    }

    entityFiles.push({
      'iri': iri,
      name,
      'path': `entities/${name}.ts`,
      'source': buildEntityFileSource({
        iri,
        name,
        'refsName': ctx.refsName,
        schema,
        'sourceLabel': ctx.sourceLabel,
        'ts': ctx.ts
      })
    });
  }

  return entityFiles;
}

/** Build the index.ts source string for registry-directory mode. */
function buildIndexSource(
  ctx: RegistryDirContextInterface,
  opts: BuildIndexSourceOptionsInterface,
  result: OwlImportResult
): string {
  const indexLines: string[] = [];

  emitBanner(indexLines, {
    'collisions': opts.collisions,
    'header': opts.header,
    'sourceLabel': ctx.sourceLabel,
    'ts': ctx.ts
  });

  indexLines.push("import { JsonTology } from 'json-tology';");
  indexLines.push("import type { SchemaReferencesMapType } from 'json-tology/types';");
  indexLines.push('');

  const schemaNames = extractSchemaNames(ctx.sortedIris, ctx.nameMap);

  emitEntityImports(indexLines, schemaNames);
  emitRegistryConstruction(indexLines, {
    'effectiveBaseIRI': opts.effectiveBaseIRI,
    'registryConstName': opts.registryConstName,
    schemaNames,
    'schemasConst': opts.schemasConst
  });
  // Exported reference map over the schema tuple. Each `entities/<Name>.ts`
  // imports this (type-only) to thread it into its `InferType`, so cross-class
  // `$ref`s resolve to precise sibling types across the directory.
  indexLines.push(`export type ${ctx.refsName} = SchemaReferencesMapType<typeof ${opts.schemasConst}>;`);
  indexLines.push('');
  emitPostProcessing(indexLines, result, opts.registryConstName);
  emitEntityReExports(indexLines, schemaNames);

  indexLines.push('// ============================================================');
  indexLines.push('// END AUTO-GENERATED');
  indexLines.push('// ============================================================');
  indexLines.push('');

  return indexLines.join('\n');
}

/** Emit the type and schema constant re-exports in the index.ts. */
function emitEntityReExports(indexLines: string[], schemaNames: string[]): void {
  indexLines.push('// Type re-exports — consumers import named types from this index');

  for (const name of schemaNames) {
    indexLines.push(`export type { ${name} } from './entities/${name}.js';`);
  }

  indexLines.push('');

  indexLines.push('// Schema constant re-exports');

  for (const name of schemaNames) {
    indexLines.push(`export { ${name}Schema } from './entities/${name}.js';`);
  }

  indexLines.push('');
}

// ---------------------------------------------------------------------------
// Registry-directory mode
// ---------------------------------------------------------------------------

/**
 * Generate registry-directory-mode TypeScript sources from an
 * {@link OwlImportResult}.
 *
 * @remarks
 * Returns an in-memory description of one `entities/<Name>.ts` file per OWL
 * class (schema literal + type alias) and one `index.ts` that imports all
 * entities, builds the registry, and re-exports all types and schema
 * constants. Writing the files to disk is the caller's responsibility.
 *
 * @example
 * ```ts
 * const { entityFiles, indexSource } = generateRegistryFiles(result, { registryConstName: 'foaf' });
 * for (const f of entityFiles) {
 *   await fs.writeFile(path.join(outDir, f.path), f.source);
 * }
 * await fs.writeFile(path.join(outDir, 'index.ts'), indexSource);
 * ```
 *
 * @param result  - The import result from `JsonTology.fromTbox()`.
 * @param options - Codegen options (name, baseIRI, etc.).
 * @returns Entity file sources + index source.
 *
 * @category Codegen
 * @since 0.18.0
 * @see {@link generateTypeScript}
 * @group OWL Codegen
 */
export function generateRegistryFiles(
  result: OwlImportResult,
  options: OwlRegistryDirOptions
): RegistryFilesResult {
  const {
    baseIRI = '',
    header = [],
    registryConstName = 'registry',
    sourceLabel = ''
  } = options;

  const schemas = filterSchemas(result.schemas);
  const iris = schemas.map((schema: JsonSchemaDocumentObjectType): string => {
    return schema.$id as string;
  });
  const sortedIris = topoSort(iris, schemas);
  const {
    collisions,
    nameMap
  } = buildNameMap(sortedIris);
  const effectiveBaseIRI = baseIRI === '' ? deriveBaseIRI(iris[0] ?? '') : baseIRI;
  const schemasConst = `${registryConstName}Schemas`;
  const ctx: RegistryDirContextInterface = {
    nameMap,
    'refsName': `${schemasConst}Refs`,
    schemas,
    'sortedIris': sortedIris,
    sourceLabel,
    'ts': new Date().toISOString()
  };

  return {
    'entityFiles': buildEntityFiles(ctx),
    'indexSource': buildIndexSource(ctx, {
      collisions,
      'effectiveBaseIRI': effectiveBaseIRI,
      header,
      registryConstName,
      schemasConst
    }, result)
  };
}
