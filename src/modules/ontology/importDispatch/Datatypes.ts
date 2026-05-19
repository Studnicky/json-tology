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
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type { QuadObjectType } from '../../../types/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';

// ---------------------------------------------------------------------------
// OWL / RDF / XSD IRI constants — full and prefixed forms
// ---------------------------------------------------------------------------

const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS_NS = 'http://www.w3.org/2000/01/rdf-schema#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';

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
// XSD facet predicate → JSON Schema keyword mapping
// ---------------------------------------------------------------------------

/**
 * Map from XSD facet predicate IRI (full and prefixed) to a handler descriptor.
 * `kind: 'numeric'` means parse value as Number and assign to the given key.
 * `kind: 'string'` means take the string value as-is.
 * `kind: 'length'` is the exact-length facet: sets both minLength and maxLength.
 * `kind: 'fractionDigits'` computes multipleOf as 10^-N.
 * `kind: 'unsupported'` calls reportUnsupported.
 * `kind: 'ignore'` silently drops the facet (xsd:whiteSpace).
 */
type FacetDescriptor
  = | { 'key': keyof JsonSchemaDocumentObjectType;
    'kind': 'numeric' }
  | { 'key': keyof JsonSchemaDocumentObjectType;
    'kind': 'string' }
  | { 'kind': 'fractionDigits' }
  | { 'kind': 'ignore' }
  | { 'kind': 'length' }
  | { 'kind': 'unsupported';
    'predicate': string };

/** Full-IRI and prefixed facet predicates. */
const FACET_MAP: ReadonlyMap<string, FacetDescriptor> = new Map([
  [
    'xsd:fractionDigits',
    { 'kind': 'fractionDigits' }
  ],
  [
    'xsd:length',
    { 'kind': 'length' }
  ],
  [
    'xsd:maxExclusive',
    {
      'key': 'exclusiveMaximum',
      'kind': 'numeric'
    }
  ],
  [
    'xsd:maxInclusive',
    {
      'key': 'maximum',
      'kind': 'numeric'
    }
  ],
  [
    'xsd:maxLength',
    {
      'key': 'maxLength',
      'kind': 'numeric'
    }
  ],
  [
    'xsd:minExclusive',
    {
      'key': 'exclusiveMinimum',
      'kind': 'numeric'
    }
  ],
  [
    'xsd:minInclusive',
    {
      'key': 'minimum',
      'kind': 'numeric'
    }
  ],
  [
    'xsd:minLength',
    {
      'key': 'minLength',
      'kind': 'numeric'
    }
  ],
  [
    'xsd:pattern',
    {
      'key': 'pattern',
      'kind': 'string'
    }
  ],
  [
    'xsd:totalDigits',
    {
      'kind': 'unsupported',
      'predicate': 'xsd:totalDigits'
    }
  ],
  [
    'xsd:whiteSpace',
    { 'kind': 'ignore' }
  ],
  [
    `${XSD_NS}fractionDigits`,
    { 'kind': 'fractionDigits' }
  ],
  // Exact length — sets both minLength and maxLength
  [
    `${XSD_NS}length`,
    { 'kind': 'length' }
  ],
  [
    `${XSD_NS}maxExclusive`,
    {
      'key': 'exclusiveMaximum',
      'kind': 'numeric'
    }
  ],
  [
    `${XSD_NS}maxInclusive`,
    {
      'key': 'maximum',
      'kind': 'numeric'
    }
  ],
  [
    `${XSD_NS}maxLength`,
    {
      'key': 'maxLength',
      'kind': 'numeric'
    }
  ],
  [
    `${XSD_NS}minExclusive`,
    {
      'key': 'exclusiveMinimum',
      'kind': 'numeric'
    }
  ],
  // Numeric bounds
  [
    `${XSD_NS}minInclusive`,
    {
      'key': 'minimum',
      'kind': 'numeric'
    }
  ],
  // String length
  [
    `${XSD_NS}minLength`,
    {
      'key': 'minLength',
      'kind': 'numeric'
    }
  ],
  // Pattern
  [
    `${XSD_NS}pattern`,
    {
      'key': 'pattern',
      'kind': 'string'
    }
  ],
  // Decimal facets
  [
    `${XSD_NS}totalDigits`,
    {
      'kind': 'unsupported',
      'predicate': 'xsd:totalDigits'
    }
  ],
  // whiteSpace — no JSON Schema correlate; silently ignored
  [
    `${XSD_NS}whiteSpace`,
    { 'kind': 'ignore' }
  ]
]);

// ---------------------------------------------------------------------------
// XSD base type → JSON Schema type mapping
// ---------------------------------------------------------------------------

/**
 * Map from XSD datatype IRI (full and prefixed) to a JSON Schema type string.
 * Only covers the types used as owl:onDatatype targets.
 */
const XSD_TO_SCHEMA_TYPE: ReadonlyMap<string, 'integer' | 'number' | 'string'> = new Map([
  [
    'xsd:anyURI',
    'string'
  ],
  [
    'xsd:base64Binary',
    'string'
  ],
  [
    'xsd:byte',
    'integer'
  ],
  [
    'xsd:date',
    'string'
  ],
  [
    'xsd:dateTime',
    'string'
  ],
  [
    'xsd:decimal',
    'number'
  ],
  [
    'xsd:double',
    'number'
  ],
  [
    'xsd:duration',
    'string'
  ],
  [
    'xsd:float',
    'number'
  ],
  [
    'xsd:hexBinary',
    'string'
  ],
  [
    'xsd:ID',
    'string'
  ],
  [
    'xsd:IDREF',
    'string'
  ],
  [
    'xsd:int',
    'integer'
  ],
  [
    'xsd:integer',
    'integer'
  ],
  [
    'xsd:language',
    'string'
  ],
  [
    'xsd:long',
    'integer'
  ],
  [
    'xsd:Name',
    'string'
  ],
  [
    'xsd:NCName',
    'string'
  ],
  [
    'xsd:negativeInteger',
    'integer'
  ],
  [
    'xsd:NMTOKEN',
    'string'
  ],
  [
    'xsd:nonNegativeInteger',
    'integer'
  ],
  [
    'xsd:nonPositiveInteger',
    'integer'
  ],
  [
    'xsd:normalizedString',
    'string'
  ],
  [
    'xsd:positiveInteger',
    'integer'
  ],
  [
    'xsd:short',
    'integer'
  ],
  [
    'xsd:string',
    'string'
  ],
  [
    'xsd:time',
    'string'
  ],
  [
    'xsd:token',
    'string'
  ],
  [
    'xsd:unsignedByte',
    'integer'
  ],
  [
    'xsd:unsignedInt',
    'integer'
  ],
  [
    'xsd:unsignedLong',
    'integer'
  ],
  [
    'xsd:unsignedShort',
    'integer'
  ],
  [
    `${XSD_NS}anyURI`,
    'string'
  ],
  [
    `${XSD_NS}base64Binary`,
    'string'
  ],
  [
    `${XSD_NS}byte`,
    'integer'
  ],
  [
    `${XSD_NS}date`,
    'string'
  ],
  [
    `${XSD_NS}dateTime`,
    'string'
  ],
  // Numbers
  [
    `${XSD_NS}decimal`,
    'number'
  ],
  [
    `${XSD_NS}double`,
    'number'
  ],
  [
    `${XSD_NS}duration`,
    'string'
  ],
  [
    `${XSD_NS}float`,
    'number'
  ],
  [
    `${XSD_NS}hexBinary`,
    'string'
  ],
  [
    `${XSD_NS}ID`,
    'string'
  ],
  [
    `${XSD_NS}IDREF`,
    'string'
  ],
  [
    `${XSD_NS}int`,
    'integer'
  ],
  // Integers
  [
    `${XSD_NS}integer`,
    'integer'
  ],
  [
    `${XSD_NS}language`,
    'string'
  ],
  [
    `${XSD_NS}long`,
    'integer'
  ],
  [
    `${XSD_NS}Name`,
    'string'
  ],
  [
    `${XSD_NS}NCName`,
    'string'
  ],
  [
    `${XSD_NS}negativeInteger`,
    'integer'
  ],
  [
    `${XSD_NS}NMTOKEN`,
    'string'
  ],
  [
    `${XSD_NS}nonNegativeInteger`,
    'integer'
  ],
  [
    `${XSD_NS}nonPositiveInteger`,
    'integer'
  ],
  [
    `${XSD_NS}normalizedString`,
    'string'
  ],
  [
    `${XSD_NS}positiveInteger`,
    'integer'
  ],
  [
    `${XSD_NS}short`,
    'integer'
  ],
  [
    `${XSD_NS}string`,
    'string'
  ],
  [
    `${XSD_NS}time`,
    'string'
  ],
  [
    `${XSD_NS}token`,
    'string'
  ],
  [
    `${XSD_NS}unsignedByte`,
    'integer'
  ],
  [
    `${XSD_NS}unsignedInt`,
    'integer'
  ],
  [
    `${XSD_NS}unsignedLong`,
    'integer'
  ],
  [
    `${XSD_NS}unsignedShort`,
    'integer'
  ]
]);

// ---------------------------------------------------------------------------
// Subject quad index
// ---------------------------------------------------------------------------

/** Map from subject IRI/bnode ID → all quads with that subject. */
type SubjectIndex = Map<string, QuadInterface[]>;

function buildSubjectIndex(quads: QuadInterface[]): SubjectIndex {
  const index: SubjectIndex = new Map();

  for (const quad of quads) {
    const key = quad.subject.value;
    let list = index.get(key);

    if (list === undefined) {
      list = [];
      index.set(key, list);
    }
    list.push(quad);
  }

  return index;
}

/** Return quads for a subject that match any predicate in the set. */
function quadsForPredicates(
  index: SubjectIndex,
  subject: string,
  predicates: ReadonlySet<string>
): QuadInterface[] {
  return (index.get(subject) ?? []).filter((quad) => {
    return predicates.has(quad.predicate.value);
  });
}

// ---------------------------------------------------------------------------
// RDF list extraction
// ---------------------------------------------------------------------------

/**
 * Extract items from a quad object that encodes an RDF list.
 * Handles both `ListTermType` (project shorthand) and a single item.
 */
function extractListItems(obj: QuadObjectType): QuadObjectType[] {
  if (obj.termType === 'List') {
    return [...obj.items];
  }

  if (obj.termType === 'BlankNode' || obj.termType === 'NamedNode') {
    return [obj];
  }

  return [];
}

// ---------------------------------------------------------------------------
// Literal value extraction
// ---------------------------------------------------------------------------

/**
 * Extract a number from a literal quad object.
 * Returns null for non-literals or non-numeric values.
 */
function literalNumber(obj: QuadObjectType): null | number {
  if (obj.termType !== 'Literal') {
    return null;
  }

  const raw = obj.value;

  if (typeof raw === 'number') {
    return raw;
  }

  const num = Number(raw);

  return Number.isFinite(num) ? num : null;
}

/**
 * Extract a string from a literal quad object.
 * Returns null for non-literals.
 */
function literalString(obj: QuadObjectType): null | string {
  if (obj.termType !== 'Literal') {
    return null;
  }

  return String(obj.value);
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
 * Given a blank-node ID from the `owl:withRestrictions` list, look up all
 * quads on that bnode in the subject index and convert each XSD facet
 * predicate to a JSON Schema keyword patch.
 *
 * Multiple predicates on one blank node are all applied (e.g. a bnode could
 * theoretically carry more than one facet, though in practice each carries one).
 */
function extractFacetFromBnode(
  bnodeId: string,
  index: SubjectIndex,
  schemaType: 'integer' | 'number' | 'string' | undefined,
  reportUnsupported: (axiomIri: string, subjectIri: null | string) => void
): Partial<JsonSchemaDocumentObjectType> {
  const delta: Record<string, unknown> = {};
  const bnodeQuads = index.get(bnodeId) ?? [];

  for (const fq of bnodeQuads) {
    const facetPred = fq.predicate.value;
    const descriptor = FACET_MAP.get(facetPred);

    if (descriptor === undefined) {
      // Unknown facet predicate — report and skip
      reportUnsupported(facetPred, bnodeId);
      continue;
    }

    switch (descriptor.kind) {
      case 'fractionDigits': {
        const num = literalNumber(fq.object);

        if (num !== null && num >= 0) {
          // 10^-N expressed as multipleOf
          delta.multipleOf = Math.pow(10, -num);
        }

        break;
      }

      case 'ignore':
        // xsd:whiteSpace — no JSON Schema correlate; silent drop
        break;


      case 'length': {
        const num = literalNumber(fq.object);

        if (num !== null) {
          delta.minLength = num;
          delta.maxLength = num;
        }

        break;
      }

      case 'numeric': {
        const num = literalNumber(fq.object);

        if (num !== null) {
          delta[descriptor.key] = num;
        }

        break;
      }

      case 'string': {
        const str = literalString(fq.object);

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

  // For integer-typed datatypes: when minInclusive/maxInclusive are present but
  // fractional, clamp to integers (OWL semantics are additive/narrowing).
  // This keeps the schema type consistent with the declared owl:onDatatype.
  void schemaType;

  return delta;
}

// ---------------------------------------------------------------------------
// Collect rdfs:Datatype subject IRIs
// ---------------------------------------------------------------------------

/**
 * Return the set of subject IRIs declared as `rdfs:Datatype`.
 */
function collectDatatypeIris(quads: QuadInterface[]): Set<string> {
  const iris = new Set<string>();

  for (const quad of quads) {
    if (
      TYPE_PREDICATES.has(quad.predicate.value)
      && quad.object.termType === 'NamedNode'
      && RDFS_DATATYPE_IRIS.has(quad.object.value)
      && quad.subject.termType === 'NamedNode'
    ) {
      iris.add(quad.subject.value);
    }
  }

  return iris;
}

// ---------------------------------------------------------------------------
// Build delta for one datatype IRI
// ---------------------------------------------------------------------------

/**
 * Process a single `rdfs:Datatype` subject and return its schema delta.
 */
function processDatatypeIri(
  subjectIri: string,
  index: SubjectIndex,
  reportUnsupported: (axiomIri: string, subjectIri: null | string) => void
): Partial<JsonSchemaDocumentObjectType> {
  const delta: Record<string, unknown> = {};

  // ------------------------------------------------------------------
  // owl:onDatatype → JSON Schema type
  // ------------------------------------------------------------------
  const onDatatypeQuads = quadsForPredicates(index, subjectIri, OWL_ON_DATATYPE_IRIS);
  let schemaType: 'integer' | 'number' | 'string' | undefined;

  if (onDatatypeQuads.length > 0) {
    const onDtObj = onDatatypeQuads[0].object;

    if (onDtObj.termType === 'NamedNode') {
      const mappedType = XSD_TO_SCHEMA_TYPE.get(onDtObj.value);

      if (mappedType !== undefined) {
        schemaType = mappedType;
        delta.type = mappedType;
      }
    }
  }

  // ------------------------------------------------------------------
  // owl:withRestrictions → facet list
  // ------------------------------------------------------------------
  const withRestrictionsQuads = quadsForPredicates(index, subjectIri, OWL_WITH_RESTRICTIONS_IRIS);

  for (const wrQuad of withRestrictionsQuads) {
    const listItems = extractListItems(wrQuad.object);

    for (const item of listItems) {
      if (item.termType === 'BlankNode') {
        const facetDelta = extractFacetFromBnode(item.value, index, schemaType, reportUnsupported);

        Object.assign(delta, facetDelta);
      }
    }
  }

  // ------------------------------------------------------------------
  // owl:equivalentClass owl:oneOf [...] → enum datatype
  // ------------------------------------------------------------------
  const equivClassQuads = quadsForPredicates(index, subjectIri, OWL_EQUIVALENT_CLASS_IRIS);

  for (const ecQuad of equivClassQuads) {
    const ecObj = ecQuad.object;

    // The equivalentClass value may be a blank node carrying owl:oneOf
    let targetId: string | undefined;

    if (ecObj.termType === 'BlankNode') {
      targetId = ecObj.value;
    }

    if (targetId === undefined) {
      continue;
    }

    const oneOfQuads = quadsForPredicates(index, targetId, OWL_ONE_OF_IRIS);

    for (const ooQuad of oneOfQuads) {
      const enumValues = extractEnumValues(ooQuad.object);

      if (enumValues.length > 0) {
        delta.enum = enumValues;

        // Infer type from the enum values when not already set via owl:onDatatype
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
  const multipleOfQuads = quadsForPredicates(index, subjectIri, JT_MULTIPLE_OF_IRIS);

  if (multipleOfQuads.length > 0) {
    const moNum = literalNumber(multipleOfQuads[0].object);

    if (moNum !== null) {
      delta.multipleOf = moNum;
    }
  }

  // jt:format — preserve JSON Schema format keyword
  const formatQuads = quadsForPredicates(index, subjectIri, JT_FORMAT_IRIS);

  if (formatQuads.length > 0) {
    const fmtStr = literalString(formatQuads[0].object);

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
 * Extract enum values from an RDF list object (owl:oneOf of literals).
 *
 * Each list item may be:
 *   - A Literal with a raw or structured value
 *   - A NamedNode (IRI-keyed enum value)
 *
 * Returns an array of raw JS values.
 */
function extractEnumValues(listObj: QuadObjectType): unknown[] {
  const items = extractListItems(listObj);
  const values: unknown[] = [];

  for (const item of items) {
    if (item.termType === 'Literal') {
      const raw = item.value;

      // Structured literal: { '@type': xsd:..., '@value': ... }
      if (
        typeof raw === 'object'
        && raw !== null
        && '@value' in (raw as Record<string, unknown>)
      ) {
        values.push((raw as Record<string, unknown>)['@value']);
      } else {
        values.push(raw);
      }
    } else if (item.termType === 'NamedNode') {
      values.push(item.value);
    }
    // BlankNode enum members are not standard OWL 2 — skip
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
 * - `owl:withRestrictions` list → XSD facets mapped to JSON Schema keywords:
 *     xsd:minInclusive → minimum, xsd:maxInclusive → maximum
 *     xsd:minExclusive → exclusiveMinimum, xsd:maxExclusive → exclusiveMaximum
 *     xsd:minLength → minLength, xsd:maxLength → maxLength
 *     xsd:length → minLength + maxLength (exact match)
 *     xsd:pattern → pattern
 *     xsd:fractionDigits → multipleOf (10^-N)
 *     xsd:totalDigits → reportUnsupported
 *     xsd:whiteSpace → ignored
 * - `owl:equivalentClass` + `owl:oneOf` of literals → enum datatype
 *
 * @param quads - All quads from the input graph.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragment with schemaDeltas populated.
 */
export function importDatatypes(quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  const index = buildSubjectIndex(quads);
  const datatypeIris = collectDatatypeIris(quads);

  if (datatypeIris.size === 0) {
    return emptyFragment();
  }

  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();

  for (const datatypeIri of datatypeIris) {
    const delta = processDatatypeIri(datatypeIri, index, ctx.reportUnsupported);

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
