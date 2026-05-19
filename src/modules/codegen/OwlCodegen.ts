/**
 * OwlCodegen — code generator for OWL 2 TBox import results.
 *
 * Pure function: generateTypeScript(result, options) → TS source string.
 *
 * Emission order:
 *   1. Auto-generated banner comment (timestamp, source IRI, "do not edit").
 *   2. Imports: JsonTology + InferType.
 *   3. Per-class `export const <Name>Schema = { ... } as const;`
 *      — dependency-ordered (primitives before composites).
 *   4. `export const <registryConst>Schemas = [...] as const;`
 *   5. `export const <registryConst> = JsonTology.create({ ... });`
 *   6. Per-class `export type <Name> = InferType<typeof <Name>Schema>;`
 *   7. sameAs / addCharacteristic calls.
 *   8. Closing footer comment.
 */

import type { OwlImportResult } from '../../interfaces/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../types/Schema.js';

// ---------------------------------------------------------------------------
// Public options contract
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extract the local name (after '#' or last '/') from an IRI and
 * convert it to PascalCase.
 */
function localName(iri: string): string {
  const afterHash = iri.split('#').at(-1) ?? iri;
  const afterSlash = afterHash.split('/').at(-1) ?? afterHash;

  // Strip non-word characters then PascalCase
  const words = afterSlash
    .replaceAll(/\W+/gu, ' ')
    .trim()
    .split(/\s+/u);

  return words
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
    return typeof schema.$id === 'string' && schema.$id.length > 0;
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
