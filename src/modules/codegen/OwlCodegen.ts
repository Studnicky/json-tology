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
    .map((word) => {
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
function buildNameMap(iris: readonly string[]): {
  'collisions': Set<string>;
  'nameMap': Map<string, string>;
} {
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

  // Collect $ref dependencies for each IRI within the known set
  function collectRefs(obj: unknown, acc: Set<string>): void {
    if (obj === null || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        collectRefs(item, acc);
      }

      return;
    }

    const rec = obj as Record<string, unknown>;

    if (typeof rec.$ref === 'string' && irisSet.has(rec.$ref)) {
      acc.add(rec.$ref);
    }

    for (const val of Object.values(rec)) {
      collectRefs(val, acc);
    }
  }

  const deps = new Map<string, Set<string>>();

  for (const iri of iris) {
    const schema = schemaByIri.get(iri);
    const refs = new Set<string>();

    if (schema !== undefined) {
      // Clone without $id itself
      const {
        '$id': _id,
        ...rest
      } = schema;

      void _id;
      collectRefs(rest, refs);
    }

    deps.set(iri, refs);
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>();

  for (const iri of iris) {
    inDegree.set(iri, 0);
  }

  for (const refSet of deps.values()) {
    for (const dep of refSet) {
      inDegree.set(dep, (inDegree.get(dep) ?? 0) + 1);
    }
  }

  // Nodes with no dependents start first (they are depended upon by others)
  // Actually we want leaves (with no deps) first.
  // Rebuild: forward deps = what does X depend on; we want X after its deps.
  // In-degree = number of things X depends on.
  const fwdInDegree = new Map<string, number>();

  for (const iri of iris) {
    fwdInDegree.set(iri, deps.get(iri)?.size ?? 0);
  }

  const queue: string[] = [];

  for (const iri of iris) {
    if ((fwdInDegree.get(iri) ?? 0) === 0) {
      queue.push(iri);
    }
  }

  const sorted: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();

    if (current === undefined || visited.has(current)) {
      continue;
    }

    visited.add(current);
    sorted.push(current);

    // Find all iris that depend on `current` and reduce their in-degree
    for (const depsPair of deps.entries()) {
      const iri = depsPair[0];
      const refSet = depsPair[1];

      if (refSet.has(current) && !visited.has(iri)) {
        const newDeg = (fwdInDegree.get(iri) ?? 1) - 1;

        fwdInDegree.set(iri, newDeg);

        if (newDeg === 0) {
          queue.push(iri);
        }
      }
    }
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
 * Derive the namespace portion of an IRI (before '#' or last '/').
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

/**
 * Serialize a JSON Schema object to a stable TS `as const` literal string.
 * Keys are sorted lexicographically per the perfectionist/sort-objects rule.
 * Strings use JSON.stringify to avoid injection.
 */
function serializeSchemaLiteral(obj: unknown, indent: number): string {
  const pad = ' '.repeat(indent);
  const innerPad = ' '.repeat(indent + 2);

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
    if (obj.length === 0) {
      return '[]';
    }

    const items = obj
      .map((item: unknown) => {
        return `${innerPad}${serializeSchemaLiteral(item, indent + 2)}`;
      })
      .join(',\n');

    return `[\n${items},\n${pad}]`;
  }

  if (typeof obj === 'object') {
    const rec = obj as Record<string, unknown>;
    const keys = Object.keys(rec).sort();

    if (keys.length === 0) {
      return '{}';
    }

    const entries = keys
      .map((key) => {
        const val = serializeSchemaLiteral(rec[key], indent + 2);

        return `${innerPad}${JSON.stringify(key)}: ${val}`;
      })
      .join(',\n');

    return `{\n${entries},\n${pad}}`;
  }

  return 'undefined';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a TypeScript source string from an {@link OwlImportResult}.
 *
 * The returned string is ready to write to a `.ts` file. It contains:
 *   - Auto-generated banner + imports
 *   - Per-class `export const <Name>Schema = { ... } as const;`
 *   - Registry array + `JsonTology.create(...)` call
 *   - Per-class `export type <Name> = InferType<typeof <Name>Schema>;`
 *   - sameAs / addCharacteristic post-processing
 *   - Footer comment
 *
 * @param result - The import result from `JsonTology.fromTbox()`.
 * @param options - Codegen options (name, baseIRI, etc.).
 * @returns The generated TypeScript source string.
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

  const schemas = result.schemas.filter((schema) => {
    // Skip $ids carrying a JSON-pointer fragment (e.g. `urn:x:EBook#/allOf/1/if`).
    // These are internal scaffolds the forward projector emits when serialising
    // complex `allOf` / `if/then/else` structures; they are not consumer-facing
    // classes and would produce invalid TypeScript identifiers if exported.
    return typeof schema.$id === 'string'
      && schema.$id.length > 0
      && !schema.$id.includes('#/');
  });

  const iris = schemas.map((schema) => {
    return schema.$id as string;
  });

  // Topologically sort iris (deps-first)
  const sortedIris = topoSort(iris, schemas);

  // Build name map (collision detection)
  const {
    collisions,
    nameMap
  } = buildNameMap(sortedIris);

  // Derive baseIRI from first schema if not specified
  const effectiveBaseIRI = baseIRI === '' ? deriveBaseIRI(iris[0] ?? '') : baseIRI;

  const lines: string[] = [];
  const ts = new Date().toISOString();

  // ---------------------------------------------------------------------------
  // 1. Banner
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 2. Imports
  // ---------------------------------------------------------------------------
  lines.push("import { JsonTology } from 'json-tology';");
  lines.push(`import type { InferType } from '${inferTypeImportPath}';`);
  lines.push('');

  // ---------------------------------------------------------------------------
  // 3. Per-class schema constants
  // ---------------------------------------------------------------------------
  for (const iri of sortedIris) {
    const name = nameMap.get(iri);

    if (name === undefined || name === '') {
      continue;
    }

    const schema = schemas.find((schemaEntry) => {
      return schemaEntry.$id === iri;
    });

    if (schema === undefined) {
      continue;
    }

    const literal = serializeSchemaLiteral(schema, 0);

    lines.push(`export const ${name}Schema = ${literal} as const;`);
    lines.push('');
  }

  // ---------------------------------------------------------------------------
  // 4. Registry array
  // ---------------------------------------------------------------------------
  const schemasConst = `${registryConstName}Schemas`;
  const schemaNames = sortedIris
    .map((iri) => {
      return nameMap.get(iri);
    })
    .filter((name): name is string => {
      return name !== undefined && name !== '';
    });

  if (schemaNames.length === 0) {
    lines.push(`export const ${schemasConst} = [] as const;`);
  } else {
    const schemaRefs = schemaNames
      .map((constName) => {
        return `  ${constName}Schema`;
      })
      .join(',\n');

    lines.push(`export const ${schemasConst} = [\n${schemaRefs},\n] as const;`);
  }

  lines.push('');

  // ---------------------------------------------------------------------------
  // 5. Registry construction
  // ---------------------------------------------------------------------------
  const createArg = serializeSchemaLiteral(
    {
      'baseIRI': effectiveBaseIRI,
      'schemas': '__SCHEMAS_PLACEHOLDER__'
    },
    0
  );

  // Replace the placeholder with the actual const name (unquoted identifier)
  const createArgFixed = createArg.replace(
    '"__SCHEMAS_PLACEHOLDER__"',
    schemasConst
  );

  lines.push(`export const ${registryConstName} = JsonTology.create(${createArgFixed} as const);`);
  lines.push('');

  // ---------------------------------------------------------------------------
  // 6. Per-class type aliases
  // ---------------------------------------------------------------------------
  for (const iri of sortedIris) {
    const name = nameMap.get(iri);

    if (name === undefined || name === '') {
      continue;
    }

    lines.push(`export type ${name} = InferType<typeof ${name}Schema>;`);
  }

  lines.push('');

  // ---------------------------------------------------------------------------
  // 7. sameAs + addCharacteristic post-processing
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 8. Footer
  // ---------------------------------------------------------------------------
  lines.push('// ============================================================');
  lines.push('// END AUTO-GENERATED');
  lines.push('// ============================================================');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Registry-directory mode
// ---------------------------------------------------------------------------

/**
 * Generate registry-directory-mode TypeScript sources from an
 * {@link OwlImportResult}.
 *
 * Returns an in-memory description of:
 *   - One `entities/<Name>.ts` file per OWL class (schema literal + type alias).
 *   - One `index.ts` that imports all entities, builds the registry, and
 *     re-exports all types and schema constants.
 *
 * Writing the files to disk is the caller's responsibility.
 *
 * @param result  - The import result from `JsonTology.fromTbox()`.
 * @param options - Codegen options (name, baseIRI, etc.).
 * @returns Entity file sources + index source.
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

  const schemas = result.schemas.filter((schema) => {
    return typeof schema.$id === 'string'
      && schema.$id.length > 0
      && !schema.$id.includes('#/');
  });

  const iris = schemas.map((schema) => {
    return schema.$id as string;
  });

  const sortedIris = topoSort(iris, schemas);

  const {
    collisions,
    nameMap
  } = buildNameMap(sortedIris);

  const effectiveBaseIRI = baseIRI === '' ? deriveBaseIRI(iris[0] ?? '') : baseIRI;
  const ts = new Date().toISOString();
  const bannerSourceLine = sourceLabel === '' ? '' : `// Source:    ${sourceLabel}\n`;
  const collisionWarning = collisions.size > 0
    ? `//\n// WARNING: IRI name collisions detected. Suffixed names used:\n${[...collisions].sort().map((n) => {
      return `//   ${n} (_2, _3, ...)\n`;
    })
      .join('')}`
    : '';

  // -------------------------------------------------------------------------
  // Per-entity files: entities/<Name>.ts
  // -------------------------------------------------------------------------
  const entityFiles: RegistryFileEntry[] = [];

  for (const iri of sortedIris) {
    const name = nameMap.get(iri);

    if (name === undefined || name === '') {
      continue;
    }

    const schema = schemas.find((schemaEntry) => {
      return schemaEntry.$id === iri;
    });

    if (schema === undefined) {
      continue;
    }

    const literal = serializeSchemaLiteral(schema, 0);
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
    entityLines.push('');
    entityLines.push(`export const ${name}Schema = ${literal} as const;`);
    entityLines.push('');
    entityLines.push(`export type ${name} = InferType<typeof ${name}Schema>;`);
    entityLines.push('');

    entityFiles.push({
      'iri': iri,
      name,
      'path': `entities/${name}.ts`,
      'source': entityLines.join('\n')
    });
  }

  // -------------------------------------------------------------------------
  // index.ts
  // -------------------------------------------------------------------------
  const indexLines: string[] = [];
  const schemasConst = `${registryConstName}Schemas`;

  indexLines.push('// ============================================================');
  indexLines.push('// AUTO-GENERATED — DO NOT EDIT');
  indexLines.push(`// Generated: ${ts}`);

  if (sourceLabel !== '') {
    indexLines.push(`// Source:    ${sourceLabel}`);
  }

  if (collisions.size > 0) {
    indexLines.push('//');
    indexLines.push('// WARNING: IRI name collisions detected. Suffixed names used:');

    for (const collidedName of [...collisions].sort()) {
      indexLines.push(`//   ${collidedName} (_2, _3, ...)`);
    }
  }

  for (const line of header) {
    indexLines.push(`// ${line}`);
  }

  indexLines.push('// ============================================================');
  indexLines.push('');

  // Suppress unused-variable linter warnings from the unused bannerSourceLine
  // and collisionWarning local vars by referencing them in a void expression.
  void bannerSourceLine;
  void collisionWarning;

  // Import JsonTology
  indexLines.push("import { JsonTology } from 'json-tology';");
  indexLines.push('');

  // Imports from entity files — in dependency order
  const schemaNames = sortedIris
    .map((iri) => {
      return nameMap.get(iri);
    })
    .filter((name): name is string => {
      return name !== undefined && name !== '';
    });

  for (const name of schemaNames) {
    indexLines.push(`import { ${name}Schema } from './entities/${name}.js';`);
  }

  indexLines.push('');

  // Registry array
  if (schemaNames.length === 0) {
    indexLines.push(`export const ${schemasConst} = [] as const;`);
  } else {
    const schemaRefs = schemaNames
      .map((constName) => {
        return `  ${constName}Schema`;
      })
      .join(',\n');

    indexLines.push(`export const ${schemasConst} = [\n${schemaRefs},\n] as const;`);
  }

  indexLines.push('');

  // Registry construction
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

  indexLines.push(`export const ${registryConstName} = JsonTology.create(${createArgFixed} as const);`);
  indexLines.push('');

  // sameAs + addCharacteristic post-processing
  if (result.sameAs.length > 0) {
    indexLines.push('// owl:sameAs identity assertions');

    for (const sameAsPair of result.sameAs) {
      const iriA = sameAsPair[0];
      const iriB = sameAsPair[1];

      indexLines.push(`${registryConstName}.sameAs(${JSON.stringify(iriA)}, ${JSON.stringify(iriB)});`);
    }

    indexLines.push('');
  }

  if (result.characteristics.length > 0) {
    indexLines.push('// OWL property characteristics');

    for (const charEntry of result.characteristics) {
      const {
        characteristic,
        propertyIri
      } = charEntry;

      indexLines.push(`${registryConstName}.registry.addCharacteristic(${JSON.stringify(propertyIri)}, ${JSON.stringify(characteristic)});`);
    }

    indexLines.push('');
  }

  // Type re-exports
  indexLines.push('// Type re-exports — consumers import named types from this index');

  for (const name of schemaNames) {
    indexLines.push(`export type { ${name} } from './entities/${name}.js';`);
  }

  indexLines.push('');

  // Schema constant re-exports
  indexLines.push('// Schema constant re-exports');

  for (const name of schemaNames) {
    indexLines.push(`export { ${name}Schema } from './entities/${name}.js';`);
  }

  indexLines.push('');
  indexLines.push('// ============================================================');
  indexLines.push('// END AUTO-GENERATED');
  indexLines.push('// ============================================================');
  indexLines.push('');

  return {
    entityFiles,
    'indexSource': indexLines.join('\n')
  };
}
