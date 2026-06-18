/**
 * Properties dispatcher — OWL 2 §8.1 / §9.2 Object/Datatype Property Axioms
 *
 * Responsible for:
 *   owl:ObjectProperty declaration  — register property IRI in allPropertyIris
 *   owl:DatatypeProperty declaration — same for datatype-bearing properties
 *   rdfs:domain <P> <C>             — add property <P> to class <C> schemaDeltas
 *   rdfs:range <P> <T>              — produce { $ref } for class T, or primitive
 *                                     { type/format } for plain XSD types
 *   rdfs:subPropertyOf <P1> <P2>    — record hierarchy via fragment.characteristics
 *   owl:inverseOf <P1> <P2>         — registry-level invariant (no structural delta)
 *   owl:propertyChainAxiom <P> ...  — registry-level constraint (no structural delta)
 *   multi-domain                    — add property to every named class's schemaDelta
 *
 * Merge precedence: later schemaDelta additions win on conflict. This mirrors
 * the orchestrator's mergeFragments deep-merge strategy.
 *
 * Coordination with PropertyRestrictions: that sibling produces property fragments
 * via owl:Restriction. Properties.ts produces fragments via rdfs:domain (the
 * "explicit" mode). Both are deep-merged by the orchestrator; later entries win.
 *
 * Graph-native traversal: all axioms are read from `ctx.graph.allRelations()`.
 * The QuadBackedSchemaGraph compacts NamedNode IRI targets via the prefix map,
 * so domain/range IRIs may surface in either full or compact form — both are
 * accepted by the downstream XSD/datatype/class membership checks.
 */

import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../../types/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import type { XsdJsonSchemaPrimitiveType } from '../../../types/XsdJsonSchemaPrimitiveType.js';
import type { PropIndexEntryType } from '../../../types/PropIndexEntryType.js';
import type { PropertyCollectionMapsType } from '../../../types/PropertyCollectionMapsType.js';
import type { ApplyPropertyArgsType } from '../../../types/ApplyPropertyArgsType.js';
import type { PropertyIndexValueType } from '../../../types/PropertyIndexValueType.js';
import { RDF } from '../../../constants/IRI.js';
import { XSD_TO_JSON_SCHEMA } from '../../../constants/XSD_REVERSE_MAPS.js';
import { SchemaIri } from '../../graph/SchemaIri.js';
import {
  DATATYPE_PROPERTY_TYPES,
  DOMAIN_PREDICATES,
  INVERSE_OF_PREDICATES,
  OBJECT_PROPERTY_TYPES,
  RANGE_PREDICATES,
  SUB_PROPERTY_PREDICATES
} from '../../../constants/ONTOLOGY_PREDICATES.js';

// ---------------------------------------------------------------------------
// Property IRI → local name extraction
// ---------------------------------------------------------------------------

/**
 * Derive the JSON Schema property key for a property IRI.
 *
 * The canonical form emitted by OwlProjection is `classId#localName`.
 * Delegates to `SchemaIri.propertyName` which handles bare fragments,
 * JSON-pointer `/properties/<name>` form, and plain path segments.
 */
function localNameOf(propertyIri: string): string {
  return SchemaIri.propertyName(propertyIri);
}

/** Compact form of the RDF List IRI. */
const RDF_LIST_CURIE = 'rdf:List';

// ---------------------------------------------------------------------------
// Phase 1: collect property declarations from graph relations
// ---------------------------------------------------------------------------

/** Push `value` into `map[key]` deduplicating entries. */
function pushUnique(map: Map<string, string[]>, key: string, value: string): void {
  let list = map.get(key);

  if (list === undefined) {
    list = [];
    map.set(key, list);
  }

  if (!list.includes(value)) {
    list.push(value);
  }
}

/** Record an object-property type declaration in the property index. */
function indexPropertyType(
  propertyIndex: Map<string, PropertyIndexValueType>,
  subjectIri: string,
  propType: 'datatype' | 'object'
): void {
  if (!propertyIndex.has(subjectIri)) {
    propertyIndex.set(subjectIri, {
      'domains': [],
      'inverseOf': [],
      'range': null,
      'subPropertyOf': [],
      'type': propType
    });
  }
}

/** Handle an rdf:type relation — record object or datatype property declarations. */
function applyTypeRelation(
  propertyIndex: Map<string, PropertyIndexValueType>,
  subjectIri: string,
  targetIri: string
): void {
  if (OBJECT_PROPERTY_TYPES.has(targetIri)) {
    indexPropertyType(propertyIndex, subjectIri, 'object');
  } else if (DATATYPE_PROPERTY_TYPES.has(targetIri)) {
    indexPropertyType(propertyIndex, subjectIri, 'datatype');
  }
}

/**
 * Single-pass traversal of `ctx.graph.allRelations()` that collects property
 * type declarations, domain, range, subPropertyOf, and inverseOf axioms into
 * separate maps for later merging.
 */
function collectPropertyDeclarations(ctx: OwlImportContextType): PropertyCollectionMapsType {
  const propertyIndex = new Map<string, PropertyIndexValueType>();
  const domainsByProperty = new Map<string, string[]>();
  const rangeByProperty = new Map<string, string>();
  const subPropertyOf = new Map<string, string[]>();
  const inverseOf = new Map<string, string[]>();

  for (const relation of ctx.graph.allRelations()) {
    const subjectIri = relation.source.id;
    const predicate = relation.predicate;
    const raw = typeof relation.target === 'string' ? relation.target : relation.target.id;
    const targetIri = ctx.curie.expandIfNeeded(raw);

    if (predicate === RDF.type) {
      applyTypeRelation(propertyIndex, subjectIri, targetIri);
      continue;
    }

    if (targetIri.startsWith('_:') || targetIri === '') {
      continue;
    }

    if (DOMAIN_PREDICATES.has(predicate)) {
      pushUnique(domainsByProperty, subjectIri, targetIri);
      continue;
    }

    if (RANGE_PREDICATES.has(predicate)) {
      rangeByProperty.set(subjectIri, targetIri);
      continue;
    }

    if (SUB_PROPERTY_PREDICATES.has(predicate)) {
      pushUnique(subPropertyOf, subjectIri, targetIri);
      continue;
    }

    if (INVERSE_OF_PREDICATES.has(predicate)) {
      pushUnique(inverseOf, subjectIri, targetIri);
    }
  }

  return {
    domainsByProperty,
    inverseOf,
    propertyIndex,
    rangeByProperty,
    subPropertyOf
  };
}

// ---------------------------------------------------------------------------
// Phase 2: merge collection maps into PropIndexEntryType records
// ---------------------------------------------------------------------------

/**
 * Merge the per-predicate collection maps into a unified `PropIndexEntryType` map,
 * including properties that appear via `rdfs:domain` without an explicit
 * `rdf:type` declaration.
 */
function buildPropertyEntries(
  maps: PropertyCollectionMapsType,
  ctx: OwlImportContextType
): Map<string, PropIndexEntryType> {
  const {
    domainsByProperty, inverseOf, propertyIndex, rangeByProperty, subPropertyOf
  } = maps;

  const allPropertyIris = new Set<string>([
    ...propertyIndex.keys(),
    ...ctx.allPropertyIris
  ]);

  for (const domainPropIri of domainsByProperty.keys()) {
    // Property seen via rdfs:domain but not declared with rdf:type — treat
    // as a generic property; classify as object/datatype based on range.
    allPropertyIris.add(domainPropIri);
  }

  const entries = new Map<string, PropIndexEntryType>();

  for (const propIri of allPropertyIris) {
    const existing = propertyIndex.get(propIri);
    const propType: 'datatype' | 'object' = existing?.type ?? 'object';

    entries.set(propIri, {
      'domains': domainsByProperty.get(propIri) ?? [],
      'inverseOf': inverseOf.get(propIri) ?? [],
      'propertyIri': propIri,
      'range': rangeByProperty.get(propIri) ?? null,
      'subPropertyOf': subPropertyOf.get(propIri) ?? [],
      'type': propType
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Phase 3a: resolve property value shape from range IRI
// ---------------------------------------------------------------------------

/** Build a JSON Schema shape from an XSD primitive descriptor. */
function xsdPrimitiveShape(primitive: XsdJsonSchemaPrimitiveType): Record<string, unknown> {
  return primitive.format === undefined
    ? { 'type': primitive.type }
    : {
      'format': primitive.format,
      'type': primitive.type
    };
}

/**
 * Derive the JSON Schema value shape for a property given its range IRI.
 * Returns null when no structural delta should be produced (e.g. rdf:List).
 */
function resolvePropertyShape(
  range: string,
  propertyIri: string,
  ctx: OwlImportContextType
): null | Record<string, unknown> {
  if (range === RDF_LIST_CURIE || range === RDF.List) {
    // rdf:List signals an array (no-maxCount path in OwlProjection); no
    // structural delta from range alone.
    return null;
  }

  const xsdPrimitive = XSD_TO_JSON_SCHEMA.get(range) ?? null;

  if (xsdPrimitive !== null) {
    return xsdPrimitiveShape(xsdPrimitive);
  }

  if (ctx.allClassIris.has(range) || ctx.allPropertyIris.has(range) || ctx.isDatatype(range)) {
    return { '$ref': range };
  }

  // Unknown range: try expanding with curie and check again.
  const expanded = ctx.curie.expand(range);

  if (expanded === range) {
    // Truly unknown — report and skip shape.
    ctx.reportUnsupported(range, propertyIri);

    return null;
  }

  const expandedPrimitive = XSD_TO_JSON_SCHEMA.get(expanded) ?? null;

  return expandedPrimitive === null ? { '$ref': expanded } : xsdPrimitiveShape(expandedPrimitive);
}

// ---------------------------------------------------------------------------
// Phase 3b: apply property shape to every domain class
// ---------------------------------------------------------------------------

/**
 * Update `schemaDeltas` for each class in `domains` with the property shape.
 */
function applyPropertyToDomains(args: ApplyPropertyArgsType): void {
  const {
    domains, propertyIri, propShape, schemaDeltas
  } = args;
  const propLocalName = localNameOf(propertyIri);

  if (propLocalName === '') {
    return;
  }

  for (const classIri of domains) {
    if (classIri.startsWith('_:')) {
      continue;
    }

    const existing = schemaDeltas.get(classIri) ?? {};
    const existingProps = typeof existing.properties === 'object'
      ? existing.properties as Record<string, unknown>
      : {};

    const propValue: Record<string, unknown> = propShape === null ? {} : { ...propShape };
    const updatedProps: Record<string, unknown> = {
      ...existingProps,
      [propLocalName]: propValue
    };
    const updatedDelta: Record<string, unknown> = {
      ...existing,
      'properties': updatedProps,
      'type': 'object'
    };

    schemaDeltas.set(classIri, updatedDelta);
  }
}

// ---------------------------------------------------------------------------
// Phase 3: build schema deltas and characteristics from merged entries
// ---------------------------------------------------------------------------

/**
 * Walk the merged property entries and produce the `schemaDeltas` and
 * `characteristics` arrays that make up the returned fragment.
 */
function buildFragmentFromEntries(
  entries: Map<string, PropIndexEntryType>,
  ctx: OwlImportContextType
): Pick<OwlImportFragmentType, 'characteristics' | 'schemaDeltas'> {
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();
  const characteristics: Array<{ 'characteristic': string;
    'propertyIri': string }> = [];

  for (const entry of entries.values()) {
    const {
      domains, inverseOf, propertyIri, range, subPropertyOf
    } = entry;

    for (const parentIri of subPropertyOf) {
      characteristics.push({
        'characteristic': `subPropertyOf:${parentIri}`,
        'propertyIri': propertyIri
      });
    }

    for (const targetIri of inverseOf) {
      characteristics.push({
        'characteristic': `inverseOf:${targetIri}`,
        'propertyIri': propertyIri
      });
    }

    const propShape = range === null ? null : resolvePropertyShape(range, propertyIri, ctx);

    applyPropertyToDomains({
      domains,
      propertyIri,
      propShape,
      schemaDeltas
    });
  }

  return {
    characteristics,
    schemaDeltas
  };
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 object and data property axioms (declarations, domain, range,
 * subPropertyOf, inverseOf) and return a partial import fragment.
 *
 * @param _quads - All quads from the input graph (unused; graph drives traversal via ctx).
 * @param ctx    - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragmentType with schemaDeltas and characteristics populated.
 *
 * @remarks
 * Performs a three-phase operation: (1) single-pass collection of property
 * declarations from `ctx.graph.allRelations()`; (2) merging of per-predicate
 * maps into unified `PropIndexEntryType` records; (3) derivation of schema deltas
 * and OWL characteristics from the merged entries.
 *
 * Properties that appear via `rdfs:domain` without an explicit `rdf:type`
 * declaration are accepted and classified as object properties by default.
 * Range IRIs are resolved against XSD primitives, known class/property IRIs,
 * and registered datatypes; unknown ranges are reported via `ctx.reportUnsupported`.
 *
 * @example
 * ```ts
 * const fragment = Properties.dispatch(quads, ctx);
 * // fragment.schemaDeltas: Map<classIri, Partial<JsonSchemaDocumentObjectType>>
 * // fragment.characteristics: Array<{ characteristic, propertyIri }>
 * ```
 *
 * @category OWL Import
 * @since 0.18.0
 * @see {@link OwlImportFragmentType}
 * @group Dispatchers
 */
export class Properties {
  public static dispatch(_quads: QuadInterface[], ctx: OwlImportContextType): OwlImportFragmentType {
    const maps = collectPropertyDeclarations(ctx);
    const entries = buildPropertyEntries(maps, ctx);
    const {
      characteristics, schemaDeltas
    } = buildFragmentFromEntries(entries, ctx);

    return {
      characteristics,
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [],
      schemaDeltas
    };
  }
}
