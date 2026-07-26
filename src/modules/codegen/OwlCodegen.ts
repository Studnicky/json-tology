/**
 * OwlCodegen — code generator for OWL 2 TBox import results.
 *
 * Static methods:
 *   OwlCodegen.toTypeScript(result, options)    → single TS source string (single-file mode).
 *   OwlCodegen.toRegistryFiles(result, options) → per-entity file sources + index source
 *                                                 (registry-directory mode).
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

import type { OwlImportResultInterface } from '../../interfaces/OwlImportResultInterface.js';
import type { OwlCodegenOptionsInterface } from '../../interfaces/OwlCodegenOptionsInterface.js';
import type { OwlRegistryDirOptionsInterface } from '../../interfaces/OwlRegistryDirOptionsInterface.js';
import type { RegistryFileEntryEntity } from '../../entities/RegistryFileEntryEntity.js';
import type { RegistryFilesResultEntity } from '../../entities/RegistryFilesResultEntity.js';
import { SchemaIri } from '../graph/SchemaIri.js';
import {
  NON_WORD_RUN, WHITESPACE_RUN
} from '../../constants/PATH.js';
import type { JsonSchemaDocumentObjectType } from '../../types/Schema.js';
import type { BuildDepsMapInterface } from '../../interfaces/BuildDepsMapInterface.js';
import type { BuildInDegreeMapInterface } from '../../interfaces/BuildInDegreeMapInterface.js';
import type { BuildEntityFileOptionsEntity } from '../../entities/BuildEntityFileOptionsEntity.js';
import type { BuildIndexSourceOptionsEntity } from '../../entities/BuildIndexSourceOptionsEntity.js';
import type { BuildNameMapResultEntity } from '../../entities/BuildNameMapResultEntity.js';
import type { EmitBannerOptionsEntity } from '../../entities/EmitBannerOptionsEntity.js';
import type { EmitRegistryOptionsEntity } from '../../entities/EmitRegistryOptionsEntity.js';
import type { EmitSchemaConstantsOptionsEntity } from '../../entities/EmitSchemaConstantsOptionsEntity.js';
import type { KahnStepOptionsInterface } from '../../interfaces/KahnStepOptionsInterface.js';
import type { SerializeContextEntity } from '../../entities/SerializeContextEntity.js';
import type { RegistryDirContextEntity } from '../../entities/RegistryDirContextEntity.js';
import type { SingleFileBodyOptionsEntity } from '../../entities/SingleFileBodyOptionsEntity.js';

/**
 * OwlCodegen — code generator for OWL 2 TBox import results.
 */
export class OwlCodegen {
  /** Reduce the in-degree of dependents and enqueue newly-zero entries. */
  private static advanceKahnStep(options: KahnStepOptionsInterface): void {
    const {
      current,
      deps,
      fwdInDegree,
      queue,
      visited
    } = options;

    for (const [
      iri,
      referenceSet
    ] of deps.entries()) {
      if (referenceSet.has(current) && !visited.has(iri)) {
        const newDeg = (fwdInDegree.get(iri) ?? 1) - 1;

        fwdInDegree.set(iri, newDeg);

        if (newDeg === 0) {
          queue.push(iri);
        }
      }
    }
  }

  /**
   * Build the forward dependency map: IRI → set of IRIs it depends on.
   * Internal helper for {@link topoSort}.
   */
  static buildDepsMap(
    iris: readonly string[],
    schemaByIri: Map<string, JsonSchemaDocumentObjectType>,
    irisSet: Set<string>
  ): BuildDepsMapInterface {
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
        OwlCodegen.collectRefs(rest, irisSet, refs);
      }

      deps.set(iri, refs);
    }

    return deps;
  }

  /** Build all per-entity RegistryFileEntryEntity.Type objects in dependency order. */
  static buildEntityFiles(context: RegistryDirContextEntity.Type): RegistryFileEntryEntity.Type[] {
    const entityFiles: RegistryFileEntryEntity.Type[] = [];
    const schemasByIri = new Map<string, JsonSchemaDocumentObjectType>();

    for (const schemaEntry of context.schemas) {
      if (schemaEntry.$id !== undefined) {
        schemasByIri.set(schemaEntry.$id, schemaEntry);
      }
    }

    for (const iri of context.sortedIris) {
      const name = context.nameMap[iri];

      if (name === undefined || name === '') {
        continue;
      }

      const schema = schemasByIri.get(iri);

      if (schema === undefined) {
        continue;
      }

      entityFiles.push({
        'iri': iri,
        name,
        'path': `entities/${name}.ts`,
        'source': OwlCodegen.buildEntityFileSource({
          iri,
          name,
          'refsName': context.refsName,
          schema,
          'sourceLabel': context.sourceLabel,
          'ts': context.ts
        })
      });
    }

    return entityFiles;
  }

  /** Build a single entity file source for registry-directory mode. */
  static buildEntityFileSource(options: BuildEntityFileOptionsEntity.Type): string {
    const {
      iri,
      name,
      refsName,
      schema,
      sourceLabel,
      ts
    } = options;
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

    const literal = OwlCodegen.serializeSchemaLiteral(schema, 0);

    entityLines.push(`export const ${name}Schema = ${literal} as const;`);
    entityLines.push('');
    entityLines.push(`export type ${name} = InferType<typeof ${name}Schema, ${refsName}>;`);
    entityLines.push('');

    return entityLines.join('\n');
  }

  /** Build the initial in-degree map (number of deps each IRI has). */
  static buildInDegreeMap(iris: readonly string[], deps: BuildDepsMapInterface): BuildInDegreeMapInterface {
    const fwdInDegree: BuildInDegreeMapInterface = new Map<string, number>();

    for (const iri of iris) {
      fwdInDegree.set(iri, deps.get(iri)?.size ?? 0);
    }

    return fwdInDegree;
  }

  /** Build the index.ts source string for registry-directory mode. */
  static buildIndexSource(
    context: RegistryDirContextEntity.Type,
    options: BuildIndexSourceOptionsEntity.Type,
    result: OwlImportResultInterface
  ): string {
    const indexLines: string[] = [];

    OwlCodegen.emitBanner(indexLines, {
      'collisions': options.collisions,
      'header': options.header,
      'sourceLabel': context.sourceLabel,
      'ts': context.ts
    });

    indexLines.push("import { JsonTology } from 'json-tology';");
    indexLines.push("import type { SchemaReferencesMapType } from 'json-tology/types';");
    indexLines.push('');

    const schemaNames = OwlCodegen.extractSchemaNames(context.sortedIris, context.nameMap);

    OwlCodegen.emitEntityImports(indexLines, schemaNames);
    OwlCodegen.emitRegistryConstruction(indexLines, {
      'effectiveBaseIri': options.effectiveBaseIri,
      'registryConstName': options.registryConstName,
      schemaNames,
      'schemasConst': options.schemasConst
    });
    // Exported reference map over the schema tuple. Each `entities/<Name>.ts`
    // imports this (type-only) to thread it into its `InferType`, so cross-class
    // `$ref`s resolve to precise sibling types across the directory.
    indexLines.push(`export type ${context.refsName} = SchemaReferencesMapType<typeof ${options.schemasConst}>;`);
    indexLines.push('');
    OwlCodegen.emitPostProcessing(indexLines, result, options.registryConstName);
    OwlCodegen.emitEntityReExports(indexLines, schemaNames);

    indexLines.push('// ============================================================');
    indexLines.push('// END AUTO-GENERATED');
    indexLines.push('// ============================================================');
    indexLines.push('');

    return indexLines.join('\n');
  }

  /** Build the initial processing queue: IRIs with no dependencies first. */
  static buildInitialQueue(iris: readonly string[], fwdInDegree: Map<string, number>): string[] {
    const queue: string[] = [];

    for (const iri of iris) {
      if ((fwdInDegree.get(iri) ?? 0) === 0) {
        queue.push(iri);
      }
    }

    return queue;
  }

  /**
   * Build a collision-free name → IRI map. When multiple IRIs collapse to the
   * same PascalCase name, suffix duplicates with `_2`, `_3`, etc.
   * Returns `{ nameMap, collisions }` where `collisions` is the set of base
   * names that collided (used for banner warnings).
   */
  static buildNameMap(iris: readonly string[]): BuildNameMapResultEntity.Type {
    // base name → first IRI that claimed it
    const nameMap = new Map<string, string>();
    const iriToName = new Map<string, string>();
    const collisionSet = new Set<string>();
    const counters = new Map<string, number>();

    for (const iri of iris) {
      const base = OwlCodegen.localName(iri);
      const existing = nameMap.get(base);

      if (existing === undefined) {
        nameMap.set(base, iri);
        iriToName.set(iri, base);
        counters.set(base, 1);
      } else {
        collisionSet.add(base);
        const n = (counters.get(base) ?? 1) + 1;

        counters.set(base, n);
        const suffixed = `${base}_${n}`;

        iriToName.set(iri, suffixed);
      }
    }

    // Build a clean iri→name map from iriToName
    const result: Record<string, string> = Object.fromEntries(iriToName);
    const collisions = [...collisionSet];

    return {
      collisions,
      'nameMap': result
    };
  }

  /** Emit the body of a single-file output: constants, registry, types, post-processing, footer. */
  static buildSingleFileBody(
    lines: string[],
    options: SingleFileBodyOptionsEntity.Type,
    result: OwlImportResultInterface
  ): void {
    const schemasConst = `${options.registryConstName}Schemas`;
    const schemaNames = OwlCodegen.extractSchemaNames(options.sortedIris, options.nameMap);

    lines.push("import { JsonTology } from 'json-tology';");
    lines.push(`import type { InferType, SchemaReferencesMapType } from '${options.inferTypeImportPath}';`);
    lines.push('');
    OwlCodegen.emitSchemaConstants(lines, {
      'nameMap': options.nameMap,
      'schemas': options.schemas,
      'sortedIris': options.sortedIris
    });
    OwlCodegen.emitRegistryConstruction(lines, {
      'effectiveBaseIri': options.effectiveBaseIri,
      'registryConstName': options.registryConstName,
      schemaNames,
      schemasConst
    });
    OwlCodegen.emitTypeAliases(lines, options.sortedIris, options.nameMap, schemasConst);
    OwlCodegen.emitPostProcessing(lines, result, options.registryConstName);
    lines.push('// ============================================================');
    lines.push('// END AUTO-GENERATED');
    lines.push('// ============================================================');
    lines.push('');
  }

  /** Collect all $ref IRIs from an object tree that are present in the known set. */
  private static collectRefs(value: unknown, irisSet: Set<string>, acc: Set<string>): void {
    if (value === null || typeof value !== 'object') {
      return;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        OwlCodegen.collectRefs(item, irisSet, acc);
      }

      return;
    }

    const rec = value as Record<string, unknown>;

    if (typeof rec.$ref === 'string' && irisSet.has(rec.$ref)) {
      acc.add(rec.$ref);
    }

    for (const propertyValue of Object.values(rec)) {
      OwlCodegen.collectRefs(propertyValue, irisSet, acc);
    }
  }

  /**
 * Derive the base IRI portion of an IRI (before '#' or last '/').
 * Used to compute the default baseIri when one is not specified.
 */
  private static deriveBaseIri(firstIri: string): string {
    const { id } = SchemaIri.parseReference(firstIri);

    // parseReference returns id = everything before '#' (or the whole IRI when no '#').
    // When the whole IRI was returned (no '#'), strip the last path segment.
    if (id !== firstIri) {
    // Had a '#' — id is the base.
      return id;
    }

    const lastSlash = firstIri.lastIndexOf('/');

    return lastSlash > 0 ? firstIri.slice(0, lastSlash) : firstIri;
  }

  /** Emit the auto-generated banner lines into an array. */
  private static emitBanner(lines: string[], options: EmitBannerOptionsEntity.Type): void {
    const {
      collisions,
      header,
      sourceLabel,
      ts
    } = options;

    lines.push('// ============================================================');
    lines.push('// AUTO-GENERATED — DO NOT EDIT');
    lines.push(`// Generated: ${ts}`);

    if (sourceLabel !== '') {
      lines.push(`// Source:    ${sourceLabel}`);
    }

    if (collisions.length > 0) {
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

  /** Emit the index.ts imports from entity files. */
  private static emitEntityImports(indexLines: string[], schemaNames: string[]): void {
    for (const name of schemaNames) {
      indexLines.push(`import { ${name}Schema } from './entities/${name}.js';`);
    }

    indexLines.push('');
  }

  /** Emit the type and schema constant re-exports in the index.ts. */
  private static emitEntityReExports(indexLines: string[], schemaNames: string[]): void {
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

  /** Emit owl:sameAs and addCharacteristic post-processing calls. */
  private static emitPostProcessing(
    lines: string[],
    result: OwlImportResultInterface,
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

  /** Emit the registry array and JsonTology.create() call. */
  private static emitRegistryConstruction(lines: string[], options: EmitRegistryOptionsEntity.Type): void {
    const {
      effectiveBaseIri,
      registryConstName,
      schemaNames,
      schemasConst
    } = options;

    if (schemaNames.length === 0) {
      lines.push(`export const ${schemasConst} = [] as const;`);
    } else {
      const schemaRefs = schemaNames
        .map((constName: string): string => {
          const result = `  ${constName}Schema`;

          return result;
        })
        .join(',\n');

      lines.push(`export const ${schemasConst} = [\n${schemaRefs},\n] as const;`);
    }

    lines.push('');

    const createArg = OwlCodegen.serializeSchemaLiteral(
      {
        'baseIri': effectiveBaseIri,
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

  /** Emit per-class schema constants in dependency order. */
  private static emitSchemaConstants(lines: string[], options: EmitSchemaConstantsOptionsEntity.Type): void {
    const {
      nameMap,
      schemas,
      sortedIris
    } = options;
    const schemasByIri = new Map<string, JsonSchemaDocumentObjectType>();

    for (const schemaEntry of schemas) {
      if (schemaEntry.$id !== undefined) {
        schemasByIri.set(schemaEntry.$id, schemaEntry);
      }
    }

    for (const iri of sortedIris) {
      const name = nameMap[iri];

      if (name === undefined || name === '') {
        continue;
      }

      const schema = schemasByIri.get(iri);

      if (schema === undefined) {
        continue;
      }

      const literal = OwlCodegen.serializeSchemaLiteral(schema, 0);

      lines.push(`export const ${name}Schema = ${literal} as const;`);
      lines.push('');
    }
  }

  /** Emit per-class type aliases. */
  private static emitTypeAliases(
    lines: string[],
    sortedIris: string[],
    nameMap: Record<string, string>,
    schemasConst: string
  ): void {
    const names = OwlCodegen.extractSchemaNames(sortedIris, nameMap);

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

  /** Extract the list of named schema identifiers from the name map. */
  static extractSchemaNames(sortedIris: string[], nameMap: Record<string, string>): string[] {
    const result: string[] = [];

    for (const iri of sortedIris) {
      const name = nameMap[iri];

      if (name !== undefined && name !== '') {
        result.push(name);
      }
    }

    return result;
  }

  /** Filter schemas to consumer-facing class IRIs (no pointer-fragment entries). */
  static filterSchemas(schemas: readonly JsonSchemaDocumentObjectType[]): JsonSchemaDocumentObjectType[] {
    const result = schemas.filter((schema: JsonSchemaDocumentObjectType): boolean => {
      // Skip $ids carrying a JSON-pointer fragment (e.g. `urn:x:EBook#/allOf/1/if`).
      // These are internal scaffolds the forward projector emits when serialising
      // complex `allOf` / `if/then/else` structures; they are not consumer-facing
      // classes and would produce invalid TypeScript identifiers if exported.
      return typeof schema.$id === 'string'
        && schema.$id.length > 0
        && !schema.$id.includes('#/');
    });

    return result;
  }

  /** Run Kahn's algorithm on the forward dependency graph and return sorted IRIs. */
  private static kahnSort(iris: readonly string[], deps: BuildDepsMapInterface): string[] {
    const fwdInDegree = OwlCodegen.buildInDegreeMap(iris, deps);
    const queue = OwlCodegen.buildInitialQueue(iris, fwdInDegree);
    const sorted: string[] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined || visited.has(current)) {
        continue;
      }

      visited.add(current);
      sorted.push(current);
      OwlCodegen.advanceKahnStep({
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
 * Extract the local name from an IRI and return it capitalised.
 *
 * Resolution priority:
 *   1. After '#' fragment identifier — `http://example.com/ns#Widget` → `Widget`
 *      (via SchemaIri.splitSubject fragment extraction)
 *   2. After last '/' segment — `http://example.com/Widget` → `Widget`
 *   3. After last ':' (URN-style) — `urn:example:Widget` → `Widget`
 *   4. Fallback: PascalCase the whole IRI stripped of non-word chars.
 */
  private static localName(iri: string): string {
  // SchemaIri.splitSubject returns fragment: null when no '#' is present,
  // distinguishing "no '#'" from "bare '#'" (empty fragment).
    const parts = SchemaIri.splitSubject(iri);

    if (parts.fragment !== null && parts.fragment.length > 0) {
      return parts.fragment.charAt(0).toUpperCase() + parts.fragment.slice(1);
    }

    const slashIndex = iri.lastIndexOf('/');

    if (slashIndex !== -1) {
      const segment = iri.slice(slashIndex + 1);

      if (segment.length > 0) {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      }
    }

    const colonIndex = iri.lastIndexOf(':');

    if (colonIndex !== -1) {
      const segment = iri.slice(colonIndex + 1);

      if (segment.length > 0) {
        return segment.charAt(0).toUpperCase() + segment.slice(1);
      }
    }

    return iri
      .replaceAll(NON_WORD_RUN, ' ')
      .trim()
      .split(WHITESPACE_RUN)
      .map((word: string): string => {
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join('');
  }

  /** Serialize an array to a stable TS `as const` literal string. */
  static serializeArrayLiteral(array: unknown[], context: SerializeContextEntity.Type): string {
    if (array.length === 0) {
      return '[]';
    }

    const items = array
      .map((item: unknown): string => {
        const result = `${context.innerPad}${OwlCodegen.serializeSchemaLiteral(item, context.indent + 2)}`;

        return result;
      })
      .join(',\n');

    return `[\n${items},\n${context.pad}]`;
  }


  /** Serialize an object to a stable TS `as const` literal string. */
  static serializeObjectLiteral(rec: Record<string, unknown>, context: SerializeContextEntity.Type): string {
    const keys = Object.keys(rec).sort();

    if (keys.length === 0) {
      return '{}';
    }

    const entries = keys
      .map((key: string): string => {
        const value = OwlCodegen.serializeSchemaLiteral(rec[key], context.indent + 2);

        return `${context.innerPad}${JSON.stringify(key)}: ${value}`;
      })
      .join(',\n');

    return `{\n${entries},\n${context.pad}}`;
  }

  /**
   * Serialize a JSON Schema object to a stable TS `as const` literal string.
   * Keys are sorted lexicographically per the perfectionist/sort-objects rule.
   * Strings use JSON.stringify to avoid injection.
   */
  static serializeSchemaLiteral(value: unknown, indent: number): string {
    const pad = ' '.repeat(indent);
    const innerPad = ' '.repeat(indent + 2);
    const context: SerializeContextEntity.Type = {
      indent,
      innerPad,
      pad
    };

    if (value === null) {
      return 'null';
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'string') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      return OwlCodegen.serializeArrayLiteral(value, context);
    }

    if (typeof value === 'object') {
      return OwlCodegen.serializeObjectLiteral(value as Record<string, unknown>, context);
    }

    return 'undefined';
  }

  /**
 * Topological sort: returns iris in dependency order (leaves first).
 * An IRI X depends on IRI Y if X's schema contains a `$ref` to Y.
 */
  private static topoSort(
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

    const deps = OwlCodegen.buildDepsMap(iris, schemaByIri, irisSet);

    return OwlCodegen.kahnSort(iris, deps);
  }

  /**
   * Generate registry-directory-mode TypeScript sources from an
   * {@link OwlImportResultInterface}.
   *
   * @remarks
   * Returns an in-memory description of one `entities/<Name>.ts` file per OWL
   * class (schema literal + type alias) and one `index.ts` that imports all
   * entities, builds the registry, and re-exports all types and schema
   * constants. Writing the files to disk is the caller's responsibility.
   *
   * @example
   * ```ts
   * const { entityFiles, indexSource } = OwlCodegen.toRegistryFiles(result, { registryConstName: 'foaf' });
   * for (const f of entityFiles) {
   *   await fs.writeFile(path.join(outDir, f.path), f.source);
   * }
   * await fs.writeFile(path.join(outDir, 'index.ts'), indexSource);
   * ```
   *
   * @param result  - The import result from `JsonTology.fromTbox()`.
   * @param options - Codegen options (name, baseIri, etc.).
   * @returns Entity file sources + index source.
   *
   * @category Codegen
   * @since 0.18.0
   * @see {@link OwlCodegen.toTypeScript}
   * @group OWL Codegen
   */
  public static toRegistryFiles(
    result: OwlImportResultInterface,
    options: OwlRegistryDirOptionsInterface
  ): RegistryFilesResultEntity.Type {
    const {
      baseIri = '',
      header = [],
      registryConstName = 'registry',
      sourceLabel = ''
    } = options;

    const schemas = OwlCodegen.filterSchemas(result.schemas);
    const iris = schemas.map((schema: JsonSchemaDocumentObjectType): string => {
      const id = schema.$id as string;

      return id;
    });
    const sortedIris = OwlCodegen.topoSort(iris, schemas);
    const {
      collisions,
      nameMap
    } = OwlCodegen.buildNameMap(sortedIris);
    const effectiveBaseIri = baseIri === '' ? OwlCodegen.deriveBaseIri(iris[0] ?? '') : baseIri;
    const schemasConst = `${registryConstName}Schemas`;
    const context: RegistryDirContextEntity.Type = {
      nameMap,
      'refsName': `${schemasConst}Refs`,
      schemas,
      'sortedIris': sortedIris,
      sourceLabel,
      'ts': new Date().toISOString()
    };

    return {
      'entityFiles': OwlCodegen.buildEntityFiles(context),
      'indexSource': OwlCodegen.buildIndexSource(context, {
        collisions,
        'effectiveBaseIri': effectiveBaseIri,
        header,
        registryConstName,
        schemasConst
      }, result)
    };
  }

  /**
   * Generate a TypeScript source string from an {@link OwlImportResultInterface}.
   *
   * @remarks
   * The returned string is ready to write to a `.ts` file. It contains an
   * auto-generated banner, per-class schema constants ordered by dependency,
   * a registry construction call, per-class type aliases, and post-processing
   * calls for owl:sameAs and property characteristics.
   *
   * @example
   * ```ts
   * const ts = OwlCodegen.toTypeScript(result, { registryConstName: 'foaf' });
   * await fs.writeFile('generated/foaf.ts', ts);
   * ```
   *
   * @param result - The import result from `JsonTology.fromTbox()`.
   * @param options - Codegen options (name, baseIri, etc.).
   * @returns The generated TypeScript source string.
   *
   * @category Codegen
   * @since 0.18.0
   * @see {@link OwlCodegen.toRegistryFiles}
   * @group OWL Codegen
   */
  public static toTypeScript(
    result: OwlImportResultInterface,
    options: OwlCodegenOptionsInterface
  ): string {
    const {
      baseIri = '',
      header = [],
      inferTypeImportPath = 'json-tology/types',
      registryConstName = 'registry',
      sourceLabel = ''
    } = options;

    const schemas = OwlCodegen.filterSchemas(result.schemas);
    const iris = schemas.map((schema: JsonSchemaDocumentObjectType): string => {
      const id = schema.$id as string;

      return id;
    });

    const sortedIris = OwlCodegen.topoSort(iris, schemas);
    const {
      collisions,
      nameMap
    } = OwlCodegen.buildNameMap(sortedIris);

    const effectiveBaseIri = baseIri === '' ? OwlCodegen.deriveBaseIri(iris[0] ?? '') : baseIri;
    const lines: string[] = [];
    const ts = new Date().toISOString();

    OwlCodegen.emitBanner(lines, {
      collisions,
      header,
      sourceLabel,
      'ts': ts
    });
    OwlCodegen.buildSingleFileBody(lines, {
      effectiveBaseIri,
      inferTypeImportPath,
      nameMap,
      registryConstName,
      schemas,
      'sortedIris': sortedIris
    }, result);

    return lines.join('\n');
  }
}
