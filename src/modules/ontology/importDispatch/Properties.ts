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

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import {
  OWL, RDF, RDFS
} from '../../../constants/IRI.js';
import { SchemaIri } from '../../graph/SchemaIri.js';

// ---------------------------------------------------------------------------
// XSD IRI → JSON Schema { type, format? } reverse map
// ---------------------------------------------------------------------------

interface JsonSchemaPrimitive {
  readonly 'format'?: string;
  readonly 'type': string;
}

const XSD_TO_JSON_SCHEMA: ReadonlyMap<string, JsonSchemaPrimitive> = new Map([
  // Full IRIs
  [
    'http://www.w3.org/2001/XMLSchema#anyURI',
    {
      'format': 'uri',
      'type': 'string'
    }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#boolean',
    { 'type': 'boolean' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#date',
    {
      'format': 'date',
      'type': 'string'
    }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#dateTime',
    {
      'format': 'date-time',
      'type': 'string'
    }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#decimal',
    { 'type': 'number' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#double',
    { 'type': 'number' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#float',
    { 'type': 'number' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#int',
    { 'type': 'integer' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#integer',
    { 'type': 'integer' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#long',
    { 'type': 'integer' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
    { 'type': 'integer' }
  ],
  [
    'http://www.w3.org/2001/XMLSchema#string',
    { 'type': 'string' }
  ],
  // Prefixed (curie) forms
  [
    'xsd:anyURI',
    {
      'format': 'uri',
      'type': 'string'
    }
  ],
  [
    'xsd:boolean',
    { 'type': 'boolean' }
  ],
  [
    'xsd:date',
    {
      'format': 'date',
      'type': 'string'
    }
  ],
  [
    'xsd:dateTime',
    {
      'format': 'date-time',
      'type': 'string'
    }
  ],
  [
    'xsd:decimal',
    { 'type': 'number' }
  ],
  [
    'xsd:double',
    { 'type': 'number' }
  ],
  [
    'xsd:float',
    { 'type': 'number' }
  ],
  [
    'xsd:int',
    { 'type': 'integer' }
  ],
  [
    'xsd:integer',
    { 'type': 'integer' }
  ],
  [
    'xsd:long',
    { 'type': 'integer' }
  ],
  [
    'xsd:nonNegativeInteger',
    { 'type': 'integer' }
  ],
  [
    'xsd:string',
    { 'type': 'string' }
  ]
]);

/**
 * Resolve an XSD datatype IRI (full or prefixed) to its JSON Schema primitive.
 * Returns null when the IRI is not a recognised XSD primitive.
 */
function xsdToJsonSchema(iri: string): JsonSchemaPrimitive | null {
  return XSD_TO_JSON_SCHEMA.get(iri) ?? null;
}

// ---------------------------------------------------------------------------
// Property IRI → local name extraction
// ---------------------------------------------------------------------------

/**
 * Derive the JSON Schema property key for a property IRI.
 *
 * The canonical form emitted by OwlProjection is `classId#localName`.
 * Extract the local name from the fragment (last segment after '/').
 */
function localNameOf(propertyIri: string): string {
  const { fragment } = SchemaIri.splitSubject(propertyIri);

  if (fragment !== null) {
    const segments = fragment.split('/');

    return segments.at(-1) ?? fragment;
  }

  // No '#' — take everything after the last '/' or '#'
  const slashIdx = propertyIri.lastIndexOf('/');

  if (slashIdx !== -1) {
    return propertyIri.slice(slashIdx + 1);
  }

  return propertyIri;
}

// ---------------------------------------------------------------------------
// Predicate constants — accept full IRI and CURIE forms both
// ---------------------------------------------------------------------------

const OBJECT_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  OWL.ObjectProperty,
  'owl:ObjectProperty'
]);

const DATATYPE_PROPERTY_TYPES: ReadonlySet<string> = new Set([
  OWL.DatatypeProperty,
  'owl:DatatypeProperty'
]);

const DOMAIN_PREDICATES: ReadonlySet<string> = new Set([
  RDFS.domain,
  'rdfs:domain'
]);

const RANGE_PREDICATES: ReadonlySet<string> = new Set([
  RDFS.range,
  'rdfs:range'
]);

const SUB_PROPERTY_PREDICATES: ReadonlySet<string> = new Set([
  RDFS.subPropertyOf,
  'rdfs:subPropertyOf'
]);

const INVERSE_OF_PREDICATES: ReadonlySet<string> = new Set([
  OWL.inverseOf,
  'owl:inverseOf'
]);

// ---------------------------------------------------------------------------
// Index types
// ---------------------------------------------------------------------------

interface PropertyEntry {
  readonly 'domains': string[];
  readonly 'inverseOf': string[];
  readonly 'propertyIri': string;
  readonly 'range': null | string;
  readonly 'subPropertyOf': string[];
  readonly 'type': 'datatype' | 'object';
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 object and data property axioms (declarations, domain, range,
 * subPropertyOf, inverseOf) and return a partial import fragment.
 *
 * @param _quads - All quads from the input graph (unused; graph drives traversal).
 * @param ctx    - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragment with schemaDeltas and characteristics populated.
 */
export function importProperties(_quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  // Index property metadata keyed by property IRI.
  const propertyIndex = new Map<string, {
    'domains': string[];
    'inverseOf': string[];
    'range': null | string;
    'subPropertyOf': string[];
    'type': 'datatype' | 'object';
  }>();

  // Collect domain and range by property IRI.
  const domainsByProperty = new Map<string, string[]>();
  const rangeByProperty = new Map<string, string>();
  const subPropertyOf = new Map<string, string[]>();
  const inverseOf = new Map<string, string[]>();

  // QuadBackedSchemaGraph compacts NamedNode IRI targets via the active prefix
  // map. Expand them back so downstream class-IRI / datatype membership checks
  // (which operate on full IRIs) match the rest of the importer pipeline.
  function resolveTargetIri(target: string | { 'id': string }): string {
    const raw = typeof target === 'string' ? target : target.id;

    if (raw === '' || raw.startsWith('_:') || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('urn:')) {
      return raw;
    }

    // Treat as CURIE — expand. If no prefix matches, returns raw unchanged.
    return ctx.curie.expand(raw);
  }

  // Single pass over graph relations — collect type declarations alongside
  // domain/range/subPropertyOf/inverseOf metadata.
  for (const relation of ctx.graph.allRelations()) {
    const subjectIri = relation.source.id;
    const predicate = relation.predicate;
    const target = relation.target;
    const targetIri = resolveTargetIri(target);

    if (predicate === RDF.type) {
      if (OBJECT_PROPERTY_TYPES.has(targetIri)) {
        if (!propertyIndex.has(subjectIri)) {
          propertyIndex.set(subjectIri, {
            'domains': [],
            'inverseOf': [],
            'range': null,
            'subPropertyOf': [],
            'type': 'object'
          });
        }
      } else if (DATATYPE_PROPERTY_TYPES.has(targetIri) && !propertyIndex.has(subjectIri)) {
        propertyIndex.set(subjectIri, {
          'domains': [],
          'inverseOf': [],
          'range': null,
          'subPropertyOf': [],
          'type': 'datatype'
        });
      }
      continue;
    }

    if (DOMAIN_PREDICATES.has(predicate)) {
      if (targetIri.startsWith('_:') || targetIri === '') {
        continue;
      }
      let domains = domainsByProperty.get(subjectIri);

      if (domains === undefined) {
        domains = [];
        domainsByProperty.set(subjectIri, domains);
      }

      if (!domains.includes(targetIri)) {
        domains.push(targetIri);
      }
      continue;
    }

    if (RANGE_PREDICATES.has(predicate)) {
      if (targetIri.startsWith('_:') || targetIri === '') {
        continue;
      }
      rangeByProperty.set(subjectIri, targetIri);
      continue;
    }

    if (SUB_PROPERTY_PREDICATES.has(predicate)) {
      if (targetIri.startsWith('_:') || targetIri === '') {
        continue;
      }
      let parents = subPropertyOf.get(subjectIri);

      if (parents === undefined) {
        parents = [];
        subPropertyOf.set(subjectIri, parents);
      }

      if (!parents.includes(targetIri)) {
        parents.push(targetIri);
      }
      continue;
    }

    if (INVERSE_OF_PREDICATES.has(predicate)) {
      if (targetIri.startsWith('_:') || targetIri === '') {
        continue;
      }
      let targets = inverseOf.get(subjectIri);

      if (targets === undefined) {
        targets = [];
        inverseOf.set(subjectIri, targets);
      }

      if (!targets.includes(targetIri)) {
        targets.push(targetIri);
      }
      continue;
    }
  }

  // Merge domain/range/subPropertyOf/inverseOf into the property index.
  // Also accept properties that only appear via rdfs:domain/range (no
  // explicit type declaration) by looking at allPropertyIris.
  const allPropertyIris = new Set<string>([
    ...propertyIndex.keys(),
    ...ctx.allPropertyIris
  ]);

  for (const domainPropIri of domainsByProperty.keys()) {
    if (!allPropertyIris.has(domainPropIri)) {
      // Property seen via rdfs:domain but not declared with rdf:type — treat
      // as a generic property; classify as object/datatype based on range.
      allPropertyIris.add(domainPropIri);
    }
  }

  // Build merged PropertyEntry records for every known property IRI.
  const entries = new Map<string, PropertyEntry>();

  for (const propIri of allPropertyIris) {
    const existing = propertyIndex.get(propIri);
    const propType: 'datatype' | 'object' = existing?.type ?? 'object';
    const domains = domainsByProperty.get(propIri) ?? [];
    const range = rangeByProperty.get(propIri) ?? null;
    const subProps = subPropertyOf.get(propIri) ?? [];
    const inverseTargets = inverseOf.get(propIri) ?? [];

    entries.set(propIri, {
      domains,
      'inverseOf': inverseTargets,
      'propertyIri': propIri,
      range,
      'subPropertyOf': subProps,
      'type': propType
    });
  }

  // ---------------------------------------------------------------------------
  // Build schema deltas and characteristics
  // ---------------------------------------------------------------------------

  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();
  const characteristics: Array<{ 'characteristic': string;
    'propertyIri': string }> = [];

  for (const entry of entries.values()) {
    const {
      domains, propertyIri, range
    } = entry;

    // subPropertyOf → characteristics (so Characteristics sibling can finalise)
    for (const parentIri of entry.subPropertyOf) {
      characteristics.push({
        'characteristic': `subPropertyOf:${parentIri}`,
        'propertyIri': propertyIri
      });
    }

    // inverseOf → characteristics (registry-level invariant)
    for (const targetIri of entry.inverseOf) {
      characteristics.push({
        'characteristic': `inverseOf:${targetIri}`,
        'propertyIri': propertyIri
      });
    }

    // Build the property value shape.
    let propShape: null | Record<string, unknown> = null;

    if (range !== null) {
      // rdf:List signals an array (no-maxCount path in OwlProjection); no
      // structural delta from range alone.
      const isRdfList = range === 'rdf:List'
        || range === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#List';

      if (!isRdfList) {
        const xsdPrimitive = xsdToJsonSchema(range);

        if (xsdPrimitive !== null) {
          // Plain XSD primitive → produce type/format directly
          propShape = xsdPrimitive.format === undefined
            ? { 'type': xsdPrimitive.type }
            : {
              'format': xsdPrimitive.format,
              'type': xsdPrimitive.type
            };
        } else if (ctx.allClassIris.has(range) || ctx.allPropertyIris.has(range)) {
          // Named class IRI → $ref
          propShape = { '$ref': range };
        } else if (ctx.isDatatype(range)) {
          // Registered datatype IRI (e.g. custom owl:Datatype) → defer to
          // Datatypes sibling; record a $ref so the shape is still present.
          propShape = { '$ref': range };
        } else {
          // Unknown range: try expanding with curie and check again.
          const expanded = ctx.curie.expand(range);
          const expandedPrimitive = xsdToJsonSchema(expanded);

          if (expandedPrimitive !== null) {
            propShape = expandedPrimitive.format === undefined
              ? { 'type': expandedPrimitive.type }
              : {
                'format': expandedPrimitive.format,
                'type': expandedPrimitive.type
              };
          } else if (expanded === range) {
            // Truly unknown — report and skip shape.
            ctx.reportUnsupported(range, propertyIri);
          } else {
            // Expanded to a known full IRI form.
            propShape = { '$ref': expanded };
          }
        }
      }
    }

    // Apply property shape to every domain class.
    for (const classIri of domains) {
      // Skip blank node class IRIs (anonymous classes from complex expressions).
      if (classIri.startsWith('_:')) {
        continue;
      }

      const propLocalName = localNameOf(propertyIri);

      if (propLocalName === '') {
        continue;
      }

      const existing = schemaDeltas.get(classIri) ?? {};
      const existingProps = typeof existing.properties === 'object'
        ? existing.properties as Record<string, unknown>
        : {};

      const propValue: Record<string, unknown> = propShape === null
        ? {}
        : { ...propShape };

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

  return {
    characteristics,
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemaDeltas': schemaDeltas
  };
}
