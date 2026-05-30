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

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type {
  ListItemType,
  SchemaGraphRelationInterface
} from '../../../interfaces/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphImpl.js';
import { Terms } from '../../rdf/Terms.js';
import { decodeLiteral } from '../../rdf/Terms.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { FACET_MAP } from '../../../constants/XSD_FACETS.js';
import { XSD_TO_SCHEMA_TYPE } from '../../../constants/XSD_REVERSE_MAPS.js';

// ---------------------------------------------------------------------------
// OWL / RDF / XSD IRI constants — full and prefixed forms
// ---------------------------------------------------------------------------

const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';

const TYPE_PREDICATES: ReadonlySet<string> = new Set([
  `${RDF_NS}type`,
  'rdf:type'
]);

const RDFS_DATATYPE_IRIS: ReadonlySet<string> = new Set([
  `${RDFS_NS}Datatype`,
  'rdfs:Datatype'
]);

const OWL_ON_DATATYPE_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}onDatatype`,
  'owl:onDatatype'
]);

const OWL_WITH_RESTRICTIONS_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}withRestrictions`,
  'owl:withRestrictions'
]);

const OWL_EQUIVALENT_CLASS_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}equivalentClass`,
  'owl:equivalentClass'
]);

const OWL_ONE_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}oneOf`,
  'owl:oneOf'
]);

const JT_NS = 'https://json-tology.dev/vocab#';

const JT_MULTIPLE_OF_IRIS: ReadonlySet<string> = new Set([
  `${JT_NS}multipleOf`,
  'jt:multipleOf'
]);

const JT_FORMAT_IRIS: ReadonlySet<string> = new Set([
  `${JT_NS}format`,
  'jt:format'
]);

// ---------------------------------------------------------------------------
// XSD facet predicate → JSON Schema keyword mapping and XSD base type mapping
// are imported from src/constants/XSD_FACETS.ts and src/constants/XSD_REVERSE_MAPS.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Graph-native helpers
// ---------------------------------------------------------------------------

/** Resolve the IRI / bnode-id / lexical form of a relation target. */
function targetValue(relation: SchemaGraphRelationInterface): string {
  return typeof relation.target === 'string' ? relation.target : relation.target.id;
}

/** Filter outgoing relations on a subject by predicate set. */
function relationsByPredicate(
  graph: SchemaGraphInterface,
  subject: string,
  predicates: ReadonlySet<string>
): readonly SchemaGraphRelationInterface[] {
  return graph.relationsForSubject(subject).filter((rel) => {
    return predicates.has(rel.predicate);
  });
}

/**
 * Extract a number from a Literal-typed relation target.
 * Returns null when the target is not a Literal or not numeric.
 */
function literalNumber(relation: SchemaGraphRelationInterface): null | number {
  if (relation.termType !== 'Literal') {
    return null;
  }
  const raw = targetValue(relation);
  const num = Number(raw);

  return Number.isFinite(num) ? num : null;
}

/**
 * Extract a string from a Literal-typed relation target.
 * Returns null when the target is not a Literal.
 */
function literalString(relation: SchemaGraphRelationInterface): null | string {
  if (relation.termType !== 'Literal') {
    return null;
  }

  return targetValue(relation);
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
    let valType: 'boolean' | 'integer' | 'number' | 'string';

    if (typeof val === 'boolean') {
      valType = 'boolean';
    } else if (typeof val === 'number') {
      valType = Number.isInteger(val) ? 'integer' : 'number';
    } else {
      valType = 'string';
    }

    if (seenType === undefined) {
      seenType = valType;
    } else if (seenType !== valType) {
      // Promote integer to number when mixed
      if ((seenType === 'integer' && valType === 'number') || (seenType === 'number' && valType === 'integer')) {
        seenType = 'number';
      } else {
        return undefined;
      }
    }
  }

  return seenType;
}

// ---------------------------------------------------------------------------
// Extract facet delta from a single blank-node facet descriptor
// ---------------------------------------------------------------------------

/**
 * Given a blank-node id from the `owl:withRestrictions` list, walk its
 * outgoing relations via `graph.relationsForSubject` and convert each XSD
 * facet predicate to a JSON Schema keyword patch.
 *
 * Multiple predicates on one blank node are all applied.
 */
function extractFacetFromBnode(
  bnodeId: string,
  graph: SchemaGraphInterface,
  schemaType: 'boolean' | 'integer' | 'number' | 'string' | undefined,
  reportUnsupported: (axiomIri: string, subjectIri: null | string) => void
): Partial<JsonSchemaDocumentObjectType> {
  const delta: Record<string, unknown> = {};
  const bnodeRelations = graph.relationsForSubject(bnodeId);

  for (const fr of bnodeRelations) {
    // The relation predicate may be compacted (xsd:minInclusive) or full IRI;
    // FACET_MAP carries both forms.
    const facetPred = fr.predicate;
    const descriptor = FACET_MAP.get(facetPred);

    if (descriptor === undefined) {
      reportUnsupported(facetPred, bnodeId);
      continue;
    }

    switch (descriptor.kind) {
      case 'fractionDigits': {
        const num = literalNumber(fr);

        if (num !== null && num >= 0) {
          delta.multipleOf = Math.pow(10, -num);
        }
        break;
      }
      case 'ignore':
        break;
      case 'length': {
        const num = literalNumber(fr);

        if (num !== null) {
          delta.minLength = num;
          delta.maxLength = num;
        }
        break;
      }
      case 'numeric': {
        const num = literalNumber(fr);

        if (num !== null) {
          delta[descriptor.key] = num;
        }
        break;
      }
      case 'string': {
        const str = literalString(fr);

        if (str !== null) {
          delta[descriptor.key] = str;
        }
        break;
      }
      case 'unsupported':
        reportUnsupported(descriptor.predicate, bnodeId);
        break;
    }
  }

  void schemaType;

  return delta;
}

// ---------------------------------------------------------------------------
// Process a single rdfs:Datatype subject
// ---------------------------------------------------------------------------

/**
 * Process a single `rdfs:Datatype` subject and return its schema delta.
 */
function processDatatypeIri(
  subjectIri: string,
  graph: SchemaGraphInterface,
  reportUnsupported: (axiomIri: string, subjectIri: null | string) => void
): Partial<JsonSchemaDocumentObjectType> {
  const delta: Record<string, unknown> = {};

  // owl:onDatatype → JSON Schema type
  const onDatatype = relationsByPredicate(graph, subjectIri, OWL_ON_DATATYPE_IRIS);
  let schemaType: 'boolean' | 'integer' | 'number' | 'string' | undefined;

  if (onDatatype.length > 0 && onDatatype[0].termType === 'NamedNode') {
    const onDt = targetValue(onDatatype[0]);
    const mappedType = XSD_TO_SCHEMA_TYPE.get(onDt);

    if (mappedType !== undefined) {
      schemaType = mappedType;
      delta.type = mappedType;
    }
  }

  // owl:withRestrictions → facet list of blank nodes
  const withRestrictions = relationsByPredicate(graph, subjectIri, OWL_WITH_RESTRICTIONS_IRIS);

  for (const wr of withRestrictions) {
    const listHead = targetValue(wr);
    const items = graph.collectList(listHead);

    for (const item of items) {
      if (item.termType === 'BlankNode') {
        const facetDelta = extractFacetFromBnode(item.target, graph, schemaType, reportUnsupported);

        Object.assign(delta, facetDelta);
      }
    }
  }

  // owl:equivalentClass [ owl:oneOf [...] ] → enum datatype
  const equivClass = relationsByPredicate(graph, subjectIri, OWL_EQUIVALENT_CLASS_IRIS);

  for (const ec of equivClass) {
    if (ec.termType !== 'BlankNode') {
      continue;
    }
    const equivBnode = targetValue(ec);
    const oneOfRelations = relationsByPredicate(graph, equivBnode, OWL_ONE_OF_IRIS);

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

  // jt:multipleOf — json-tology extension annotation on the datatype node
  const multipleOf = relationsByPredicate(graph, subjectIri, JT_MULTIPLE_OF_IRIS);

  if (multipleOf.length > 0) {
    const moNum = literalNumber(multipleOf[0]);

    if (moNum !== null) {
      delta.multipleOf = moNum;
    }
  }

  // jt:format — preserve JSON Schema format keyword
  const formatRels = relationsByPredicate(graph, subjectIri, JT_FORMAT_IRIS);

  if (formatRels.length > 0) {
    const fmtStr = literalString(formatRels[0]);

    if (fmtStr !== null) {
      delta.format = fmtStr;
    }
  }

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

function emptyFragment(): OwlImportFragment {
  return {
    'characteristics': [],
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
 * @returns OwlImportFragment with schemaDeltas populated.
 */
export function importDatatypes(_quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  const graph = ctx.graph;
  const datatypeIris = new Set<string>();

  for (const relation of graph.allRelations()) {
    if (
      TYPE_PREDICATES.has(relation.predicate)
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
    const delta = processDatatypeIri(datatypeIri, graph, ctx.reportUnsupported);

    schemaDeltas.set(datatypeIri, delta);
  }

  return {
    'characteristics': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    schemaDeltas
  };
}
