/**
 * Datatypes dispatcher — OWL 2 §9.4 Datatype Definitions / §4.7 Facet Restrictions
 *
 * Responsible for:
 *   owl:DatatypeDefinition         — named datatype derived from another
 *   rdfs:Datatype declarations      — datatype class declarations
 *   xsd:minLength / xsd:maxLength  — string length facets
 *   xsd:minInclusive / xsd:maxInclusive / xsd:minExclusive / xsd:maxExclusive — numeric facets
 *   xsd:pattern                    — regex facets
 *   xsd:totalDigits / xsd:fractionDigits — decimal facets
 *
 * Bucket strategy: structural (facet restrictions produce schemaDeltas patches —
 * `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, etc. — on the
 * schema node that maps to the datatype IRI).
 *
 * Graph-native traversal: walks `ctx.graph.relationsForSubject(datatypeIri)`
 * for the datatype subject, `ctx.graph.collectList(head)` for
 * `owl:withRestrictions` and `owl:oneOf` lists, and
 * `ctx.graph.relationsForSubject(facetBnode)` to read each blank-node
 * facet descriptor's xsd:* predicate. Literal language/datatype tags are
 * preserved on relations and list items.
 */

import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../../types/OwlImport.js';
import type {
  ListItemType,
  SchemaGraphRelationType
} from '../../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphInterface.js';
import type { ExtractFacetOptionsType } from '../../../types/ExtractFacetOptionsType.js';
import type { ApplyRestrictionsOptionsType } from '../../../types/ApplyRestrictionsOptionsType.js';
import { Terms } from '../../quads/Terms.js';
import { decodeLiteral } from '../../quads/Terms.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { FACET_MAP } from '../../../constants/XSD_FACETS.js';
import { XSD_TO_SCHEMA_TYPE } from '../../../constants/XSD_REVERSE_MAPS.js';
import {
  EQUIVALENT_CLASS_PREDICATES,
  JT_FORMAT_IRIS,
  JT_MULTIPLE_OF_IRIS,
  ONE_OF_IRIS,
  OWL_ON_DATATYPE_IRIS,
  OWL_WITH_RESTRICTIONS_IRIS,
  RDF_TYPE_PREDICATES,
  RDFS_DATATYPE_IRIS
} from '../../../constants/ONTOLOGY_PREDICATES.js';
import { DECIMAL_RADIX } from '../../../constants/FORMAT_VALIDATION.js';
import {
  literalString, relationsByPredicate, targetValue
} from './DispatchHelpers.js';

// ---------------------------------------------------------------------------
// XSD facet predicate → JSON Schema keyword mapping and XSD base type mapping
// are imported from src/constants/XSD_FACETS.ts and src/constants/XSD_REVERSE_MAPS.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Graph-native helpers (local)
// ---------------------------------------------------------------------------

/**
 * Extract a number from a Literal-typed relation target.
 * Returns null when the target is not a Literal or not numeric.
 */
function literalNumber(relation: SchemaGraphRelationType): null | number {
  if (relation.termType !== 'Literal') {
    return null;
  }
  const raw = targetValue(relation);
  const num = Number(raw);

  return Number.isFinite(num) ? num : null;
}

/** Decode a Literal ListItemType back to its typed JS value. */
function decodeListItemLiteral(item: ListItemType): unknown {
  const literalTerm = Terms.literal(item.target, {
    'datatype': Terms.iri(item.datatype ?? ''),
    'language': item.language ?? ''
  });

  return decodeLiteral(literalTerm);
}

// ---------------------------------------------------------------------------
// Infer type from enum values
// ---------------------------------------------------------------------------

/** Infer the JSON Schema primitive type for a single value. */
function inferValueType(val: unknown): 'boolean' | 'integer' | 'number' | 'string' {
  if (typeof val === 'boolean') {
    return 'boolean';
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) ? 'integer' : 'number';
  }

  return 'string';
}

/** Promote two numeric types when they are compatible (integer/number blend). */
function promoteNumericTypes(
  first: 'boolean' | 'integer' | 'number' | 'string',
  second: 'boolean' | 'integer' | 'number' | 'string'
): 'number' | undefined {
  if ((first === 'integer' && second === 'number') || (first === 'number' && second === 'integer')) {
    return 'number';
  }

  return undefined;
}

/**
 * Infer the JSON Schema type from a homogeneous array of enum values.
 * Returns undefined when the array is empty or heterogeneous.
 */
function inferEnumType(values: unknown[]): 'boolean' | 'integer' | 'number' | 'string' | undefined {
  if (values.length === 0) {
    return undefined;
  }

  let seenType: 'boolean' | 'integer' | 'number' | 'string' | undefined;

  for (const val of values) {
    const valType = inferValueType(val);

    if (seenType === undefined) {
      seenType = valType;
      continue;
    }

    if (seenType === valType) {
      continue;
    }

    const promoted = promoteNumericTypes(seenType, valType);

    if (promoted === undefined) {
      return undefined;
    }
    seenType = promoted;
  }

  return seenType;
}

// ---------------------------------------------------------------------------
// Facet kind handlers — one per descriptor.kind
// ---------------------------------------------------------------------------

/** Apply a `fractionDigits` facet: multipleOf = 10^-n. */
function applyFractionDigits(fr: SchemaGraphRelationType, delta: Record<string, unknown>): void {
  const num = literalNumber(fr);

  if (num !== null && num >= 0) {
    delta.multipleOf = Math.pow(DECIMAL_RADIX, -num);
  }
}

/** Apply a `length` facet: minLength = maxLength = n. */
function applyLengthFacet(fr: SchemaGraphRelationType, delta: Record<string, unknown>): void {
  const num = literalNumber(fr);

  if (num !== null) {
    delta.minLength = num;
    delta.maxLength = num;
  }
}

/** Apply a `numeric` facet: delta[key] = n. */
function applyNumericFacet(
  fr: SchemaGraphRelationType,
  delta: Record<string, unknown>,
  key: string
): void {
  const num = literalNumber(fr);

  if (num !== null) {
    delta[key] = num;
  }
}

/** Apply a `string` facet: delta[key] = str. */
function applyStringFacet(
  fr: SchemaGraphRelationType,
  delta: Record<string, unknown>,
  key: string
): void {
  const str = literalString(fr);

  if (str !== null) {
    delta[key] = str;
  }
}

// ---------------------------------------------------------------------------
// Extract facet delta from a single blank-node facet descriptor
// ---------------------------------------------------------------------------

/**
 * Apply a single facet relation to the delta record.
 */
function applyFacetRelation(options: { 'bnodeId': string
  'delta': Record<string, unknown>;
  'fr': SchemaGraphRelationType;
  'reportUnsupported': (axiomIri: string, subjectIri: null | string) => void; }): void {
  const {
    bnodeId, delta, fr, reportUnsupported
  } = options;
  const facetPred = fr.predicate;
  const descriptor = FACET_MAP.get(facetPred);

  if (descriptor === undefined) {
    reportUnsupported(facetPred, bnodeId);

    return;
  }

  switch (descriptor.kind) {
    case 'fractionDigits':
      applyFractionDigits(fr, delta);
      break;
    case 'ignore':
      break;
    case 'length':
      applyLengthFacet(fr, delta);
      break;
    case 'numeric':
      applyNumericFacet(fr, delta, descriptor.key);
      break;
    case 'string':
      applyStringFacet(fr, delta, descriptor.key);
      break;
    case 'unsupported':
      reportUnsupported(descriptor.predicate, bnodeId);
      break;
  }
}

/**
 * Given a blank-node id from the `owl:withRestrictions` list, walk its
 * outgoing relations via `graph.relationsForSubject` and convert each XSD
 * facet predicate to a JSON Schema keyword patch.
 *
 * Multiple predicates on one blank node are all applied.
 */
function extractFacetFromBnode(options: ExtractFacetOptionsType): Partial<JsonSchemaDocumentObjectType> {
  const {
    bnodeId, graph, reportUnsupported
  } = options;
  const delta: Record<string, unknown> = {};
  const bnodeRelations = graph.relationsForSubject(bnodeId);

  for (const fr of bnodeRelations) {
    applyFacetRelation({
      bnodeId,
      delta,
      fr,
      reportUnsupported
    });
  }

  return delta;
}

// ---------------------------------------------------------------------------
// Process a single rdfs:Datatype subject
// ---------------------------------------------------------------------------

/**
 * Apply `owl:onDatatype` → JSON Schema `type` from XSD base type.
 */
function applyOnDatatype(
  subjectIri: string,
  graph: SchemaGraphInterface,
  delta: Record<string, unknown>
): 'boolean' | 'integer' | 'number' | 'string' | undefined {
  const onDatatype = relationsByPredicate(graph, subjectIri, OWL_ON_DATATYPE_IRIS);

  if (onDatatype.length === 0 || onDatatype[0].termType !== 'NamedNode') {
    return undefined;
  }

  const onDt = targetValue(onDatatype[0]);
  const mappedType = XSD_TO_SCHEMA_TYPE.get(onDt);

  if (mappedType !== undefined) {
    delta.type = mappedType;
  }

  return mappedType;
}

/**
 * Apply `owl:withRestrictions` facet list to the delta.
 */
function applyWithRestrictions(options: ApplyRestrictionsOptionsType): void {
  const {
    delta, graph, reportUnsupported, schemaType, subjectIri
  } = options;
  const withRestrictions = relationsByPredicate(graph, subjectIri, OWL_WITH_RESTRICTIONS_IRIS);

  for (const wr of withRestrictions) {
    const listHead = targetValue(wr);
    const items = graph.collectList(listHead);

    for (const item of items) {
      if (item.termType === 'BlankNode') {
        const facetDelta = extractFacetFromBnode({
          'bnodeId': item.target,
          graph,
          reportUnsupported,
          schemaType
        });

        Object.assign(delta, facetDelta);
      }
    }
  }
}

/** Apply enum values from one equivalentClass bnode's oneOf list. */
function applyOneOfEnum(
  equivBnode: string,
  graph: SchemaGraphInterface,
  delta: Record<string, unknown>
): void {
  const oneOfRelations = relationsByPredicate(graph, equivBnode, ONE_OF_IRIS);

  for (const oo of oneOfRelations) {
    const enumValues = extractEnumValues(targetValue(oo), graph);

    if (enumValues.length > 0) {
      delta.enum = enumValues;

      if (!('type' in delta)) {
        const inferred = inferEnumType(enumValues);

        if (inferred !== undefined) {
          delta.type = inferred;
        }
      }
    }
  }
}

/**
 * Apply `owl:equivalentClass [ owl:oneOf [...] ]` → enum datatype.
 */
function applyEquivClassEnum(
  subjectIri: string,
  graph: SchemaGraphInterface,
  delta: Record<string, unknown>
): void {
  const equivClass = relationsByPredicate(graph, subjectIri, EQUIVALENT_CLASS_PREDICATES);

  for (const ec of equivClass) {
    if (ec.termType !== 'BlankNode') {
      continue;
    }
    applyOneOfEnum(targetValue(ec), graph, delta);
  }
}

/**
 * Apply jt:multipleOf and jt:format extension annotations.
 */
function applyExtensionAnnotations(
  subjectIri: string,
  graph: SchemaGraphInterface,
  delta: Record<string, unknown>
): void {
  const multipleOf = relationsByPredicate(graph, subjectIri, JT_MULTIPLE_OF_IRIS);

  if (multipleOf.length > 0) {
    const moNum = literalNumber(multipleOf[0]);

    if (moNum !== null) {
      delta.multipleOf = moNum;
    }
  }

  const formatRels = relationsByPredicate(graph, subjectIri, JT_FORMAT_IRIS);

  if (formatRels.length > 0) {
    const fmtStr = literalString(formatRels[0]);

    if (fmtStr !== null) {
      delta.format = fmtStr;
    }
  }
}

/**
 * Process a single `rdfs:Datatype` subject and return its schema delta.
 */
function resolveDatatypeIri(
  subjectIri: string,
  graph: SchemaGraphInterface,
  reportUnsupported: (axiomIri: string, subjectIri: null | string) => void
): Partial<JsonSchemaDocumentObjectType> {
  const delta: Record<string, unknown> = {};

  const schemaType = applyOnDatatype(subjectIri, graph, delta);

  applyWithRestrictions({
    delta,
    graph,
    reportUnsupported,
    schemaType,
    subjectIri
  });
  applyEquivClassEnum(subjectIri, graph, delta);
  applyExtensionAnnotations(subjectIri, graph, delta);

  return delta;
}

// ---------------------------------------------------------------------------
// Extract enum values from an owl:oneOf list
// ---------------------------------------------------------------------------

/**
 * Extract enum values from an RDF list head (owl:oneOf of literals or IRIs).
 *
 * - Literal item → typed JS value via decodeLiteral.
 * - NamedNode item → IRI string.
 * - BlankNode enum members are not standard OWL 2 — skipped.
 */
function extractEnumValues(listHead: string, graph: SchemaGraphInterface): unknown[] {
  const items = graph.collectList(listHead);
  const values: unknown[] = [];

  for (const item of items) {
    if (item.termType === 'Literal') {
      values.push(decodeListItemLiteral(item));
    } else if (item.termType === 'NamedNode') {
      values.push(item.target);
    }
  }

  return values;
}

// ---------------------------------------------------------------------------
// Empty fragment helper
// ---------------------------------------------------------------------------

function emptyFragment(): OwlImportFragmentType {
  return {
    'characteristics': [],
    'differentFrom': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemaDeltas': new Map()
  };
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 datatype definition axioms and XSD facet restrictions, returning
 * a partial import fragment.
 *
 * Handles:
 * - `rdfs:Datatype` declarations → named datatype schema (keyed by datatype IRI)
 * - `owl:onDatatype` → JSON Schema `type` from XSD base type
 * - `owl:withRestrictions` list → XSD facets mapped to JSON Schema keywords
 * - `owl:equivalentClass` + `owl:oneOf` of literals → enum datatype
 *
 * Graph-native: walks `ctx.graph.allRelations()` to discover `rdfs:Datatype`
 * subjects via `rdf:type`, then `ctx.graph.relationsForSubject(datatypeIri)`
 * for facet predicates and `ctx.graph.collectList(head)` for the
 * `owl:withRestrictions` / `owl:oneOf` RDF lists.
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `ctx.graph`.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragmentType with schemaDeltas populated.
 *
 * @remarks
 * Implements OWL 2 §9.4 Datatype Definitions and §4.7 Facet Restrictions.
 * Each datatype IRI found via `rdf:type rdfs:Datatype` is processed
 * independently. XSD facets are mapped to JSON Schema keywords via the
 * `FACET_MAP` constant; unsupported predicates are passed to
 * `ctx.reportUnsupported`. The `jt:multipleOf` and `jt:format` extension
 * predicates are also honoured.
 *
 * @example
 * ```ts
 * const fragment = importDatatypes(quads, ctx);
 * // fragment.schemaDeltas maps datatype IRI → { type, minLength, pattern, … }
 * ```
 *
 * @category OWL Import
 * @since 0.1.0
 * @see OwlImportContextType
 * @group importDispatch
 */
export function importDatatypes(_quads: QuadInterface[], ctx: OwlImportContextType): OwlImportFragmentType {
  const graph = ctx.graph;
  const datatypeIris = new Set<string>();

  for (const relation of graph.allRelations()) {
    if (
      RDF_TYPE_PREDICATES.has(relation.predicate)
      && relation.termType === 'NamedNode'
      && RDFS_DATATYPE_IRIS.has(targetValue(relation))
      && !relation.source.id.startsWith('_:')
    ) {
      datatypeIris.add(relation.source.id);
    }
  }

  if (datatypeIris.size === 0) {
    return emptyFragment();
  }

  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();

  for (const datatypeIri of datatypeIris) {
    const delta = resolveDatatypeIri(datatypeIri, graph, ctx.reportUnsupported);

    schemaDeltas.set(datatypeIri, delta);
  }

  return {
    'characteristics': [],
    'differentFrom': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    schemaDeltas
  };
}
