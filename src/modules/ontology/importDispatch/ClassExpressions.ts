/**
 * ClassExpressions dispatcher — OWL 2 §8 / §9.1 Class Expressions
 *
 * Responsible for:
 *   owl:intersectionOf  — conjunction class expressions  → allOf
 *   owl:unionOf         — disjunction class expressions  → oneOf
 *                         (discriminated variant when all members share a
 *                         distinct hasValue on the same property)
 *   owl:oneOf           — enumerated class expressions   → enum
 *
 * Anonymous (blank-node) class expressions are resolved recursively so they
 * never leak into the output as _: IRIs.
 *
 * Bucket strategy: structural — populates schemaDeltas with allOf/oneOf/enum
 * patches merged into the subject class by the orchestrator.
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  BnodeTermType, IriTermType, QuadObjectType
} from '../../../types/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { Lists } from '../../rdf/Lists.js';
import { decodeLiteral } from '../../rdf/Terms.js';

// ---------------------------------------------------------------------------
// OWL namespace constants — full IRIs for quad-level matching
// ---------------------------------------------------------------------------

const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

/** Predicate values emitted by JsonLdToQuads (full IRI) and QuadFactory (prefixed). */
const INTERSECTION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}intersectionOf`,
  'owl:intersectionOf'
]);
const UNION_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}unionOf`,
  'owl:unionOf'
]);
const ONE_OF_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}oneOf`,
  'owl:oneOf'
]);
const HAS_VALUE_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}hasValue`,
  'owl:hasValue'
]);
const ON_PROPERTY_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}onProperty`,
  'owl:onProperty'
]);
const TYPE_IRIS: ReadonlySet<string> = new Set([
  `${RDF_NS}type`,
  'rdf:type'
]);

// ---------------------------------------------------------------------------
// Quad index helpers
// ---------------------------------------------------------------------------

/** Map from subject IRI/blank-node ID → all quads with that subject. */
type SubjectQuadIndex = Map<string, QuadInterface[]>;

function buildSubjectIndex(quads: QuadInterface[]): SubjectQuadIndex {
  const index: SubjectQuadIndex = new Map();

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

/** Return quads for subject that match any of the given predicate IRIs. */
function quadsForPredicates(
  index: SubjectQuadIndex,
  subject: string,
  predicates: ReadonlySet<string>
): QuadInterface[] {
  const all = index.get(subject) ?? [];

  return all.filter((quad) => {
    return predicates.has(quad.predicate.value);
  });
}

// ---------------------------------------------------------------------------
// List extraction — handles both ListTermType and chained bnode rdf:rest forms
// ---------------------------------------------------------------------------

/**
 * Extract the items from a quad object that points to an RDF list head.
 *
 * Lists are encoded as standard rdf:first/rdf:rest/rdf:nil triple chains.
 * Walks the chain by looking up the head's subject quads in `index` and
 * following rdf:first/rdf:rest. If the head is not a list (e.g. an inline
 * class blank node without rdf:first), returns it as a single-item array
 * for legacy passthrough.
 */
function extractListItems(
  obj: QuadInterface['object'],
  index: SubjectQuadIndex
): QuadObjectType[] {
  const narrowed = Lists.asQuadObject(obj);

  if (narrowed === undefined) {
    return [];
  }
  if (narrowed.termType === 'Literal') {
    return [narrowed];
  }

  // Look up the head's outgoing quads. If it has rdf:first, walk the list.
  const headQuads = index.get(narrowed.value) ?? [];
  const hasFirst = headQuads.some((entry) => {
    return entry.predicate.value === `${RDF_NS}first` || entry.predicate.value === 'rdf:first';
  });

  if (!hasFirst) {
    return [narrowed];
  }

  // Build a synthetic quad list from the index so Lists.collect can walk
  // both full-IRI and CURIE-prefixed rdf:first/rdf:rest predicates emitted
  // by JsonLdToQuads and QuadFactory respectively.
  const allListQuads = walkableQuads(narrowed, index);

  return Lists.collect(narrowed, allListQuads);
}

/**
 * Gather every quad reachable from `head` by following rdf:rest edges,
 * including the rdf:first quads at each step. Used to feed `Lists.collect`
 * which expects a flat readonly quad collection.
 */
function walkableQuads(
  head: BnodeTermType | IriTermType,
  index: SubjectQuadIndex
): QuadInterface[] {
  const collected: QuadInterface[] = [];
  const seen = new Set<string>();
  let cursor: string | undefined = head.value;

  while (cursor !== undefined && !seen.has(cursor)) {
    seen.add(cursor);
    const quads = index.get(cursor) ?? [];
    let next: string | undefined;

    for (const quad of quads) {
      const predValue = quad.predicate.value;
      const isFirst = predValue === `${RDF_NS}first` || predValue === 'rdf:first';
      const isRest = predValue === `${RDF_NS}rest` || predValue === 'rdf:rest';

      if (isFirst) {
        collected.push(quad);
      } else if (isRest) {
        collected.push(quad);

        if ((quad.object.termType === 'BlankNode' || quad.object.termType === 'NamedNode') && quad.object.value !== `${RDF_NS}nil` && quad.object.value !== 'rdf:nil') {
          next = quad.object.value;
        }
      }
    }
    cursor = next;
  }

  return collected;
}

// ---------------------------------------------------------------------------
// Blank-node class expression resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a single quad object (NamedNode or BlankNode) into a JSON Schema
 * fragment.
 *
 * - NamedNode → `{ $ref: <iri> }`
 * - BlankNode typed as owl:Class with owl:intersectionOf → nested allOf
 * - BlankNode typed as owl:Class with owl:unionOf → nested oneOf
 * - BlankNode typed as owl:Restriction with owl:hasValue → not emitted
 *   (property restrictions are handled by the PropertyRestrictions dispatcher;
 *   we return undefined to signal "skip this member in the class expression")
 * - BlankNode that cannot be resolved → undefined (skipped)
 */
function resolveClassExpressionMember(
  obj: QuadObjectType,
  index: SubjectQuadIndex,
  allClassIris: ReadonlySet<string>,
  depth: number
): JsonSchemaDocumentObjectType | undefined {
  // Guard against infinite recursion in pathological graphs.
  if (depth > 20) {
    return undefined;
  }

  if (obj.termType === 'NamedNode') {
    // Emit $ref for named nodes — whether registered classes or external IRIs.
    return { '$ref': obj.value };
  }

  if (obj.termType === 'BlankNode') {
    return resolveBlankNodeExpression(obj.value, index, allClassIris, depth + 1);
  }

  // Literal or List at the member level — not a class expression.
  return undefined;
}

/**
 * Resolve a blank-node class expression to a JSON Schema fragment.
 *
 * Handles:
 * - owl:intersectionOf list → { allOf: [...] }
 * - owl:unionOf list       → { oneOf: [...] }
 * - owl:Restriction        → undefined (handled by PropertyRestrictions)
 */
function resolveBlankNodeExpression(
  bnodeId: string,
  index: SubjectQuadIndex,
  allClassIris: ReadonlySet<string>,
  depth: number
): JsonSchemaDocumentObjectType | undefined {
  const intersectionQuads = quadsForPredicates(index, bnodeId, INTERSECTION_OF_IRIS);

  if (intersectionQuads.length > 0) {
    const listObj = intersectionQuads[0].object;
    const members = resolveListMembers(listObj, index, allClassIris, depth);

    if (members.length === 0) {
      return undefined;
    }

    return { 'allOf': members };
  }

  const unionQuads = quadsForPredicates(index, bnodeId, UNION_OF_IRIS);

  if (unionQuads.length > 0) {
    const listObj = unionQuads[0].object;
    const members = resolveListMembers(listObj, index, allClassIris, depth);

    if (members.length === 0) {
      return undefined;
    }

    return { 'oneOf': members };
  }

  // owl:Restriction blank node — skip (PropertyRestrictions handles this).
  // Detect by checking for owl:onProperty or rdf:type owl:Restriction.
  const typeQuads = quadsForPredicates(index, bnodeId, TYPE_IRIS);
  const isRestriction = typeQuads.some((typeQuad) => {
    return typeQuad.object.termType === 'NamedNode'
      && (typeQuad.object.value === `${OWL_NS}Restriction` || typeQuad.object.value === 'owl:Restriction');
  });

  if (isRestriction) {
    return undefined;
  }

  const onPropertyQuads = quadsForPredicates(index, bnodeId, ON_PROPERTY_IRIS);

  if (onPropertyQuads.length > 0) {
    return undefined;
  }

  // Unknown blank node shape — skip.
  return undefined;
}

/**
 * Resolve all members of a list-encoded object into JSON Schema fragments.
 * Filters out undefined results (blank nodes we cannot resolve).
 */
function resolveListMembers(
  listObj: QuadInterface['object'],
  index: SubjectQuadIndex,
  allClassIris: ReadonlySet<string>,
  depth: number
): JsonSchemaDocumentObjectType[] {
  const narrowed = Lists.asQuadObject(listObj);

  if (narrowed === undefined) {
    return [];
  }

  const items = extractListItems(narrowed, index);
  const result: JsonSchemaDocumentObjectType[] = [];

  for (const item of items) {
    const fragment = resolveClassExpressionMember(item, index, allClassIris, depth);

    if (fragment !== undefined) {
      result.push(fragment);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Discriminator detection for unionOf
// ---------------------------------------------------------------------------

/**
 * Detect whether all union members share a common `owl:hasValue` on the same
 * `owl:onProperty`, with pairwise-distinct values.
 *
 * Returns the property name (as a local IRI fragment) if a discriminator is
 * found, or undefined if not.
 *
 * This only fires for blank-node union members that contain a Restriction with
 * owl:hasValue. In practice, when OwlProjection emits a discriminated union
 * it uses `oneOf` with plain named-class members whose `owl:hasValue` encodes
 * the discriminator literal.
 */
function detectDiscriminatorProperty(
  memberObjects: QuadObjectType[],
  index: SubjectQuadIndex
): string | undefined {
  if (memberObjects.length < 2) {
    return undefined;
  }

  const memberDiscriminators: Array<{ 'property': string;
    'value': string }> = [];

  for (const obj of memberObjects) {
    if (obj.termType !== 'BlankNode') {
      return undefined;
    }
    const disc = extractHasValueDiscriminator(obj.value, index);

    if (disc === undefined) {
      return undefined;
    }
    memberDiscriminators.push(disc);
  }

  // All must share the same property.
  const firstProp = memberDiscriminators[0]?.property;
  const allSameProperty = memberDiscriminators.every((disc) => {
    return disc.property === firstProp;
  });

  if (!allSameProperty) {
    return undefined;
  }

  // Values must be pairwise distinct.
  const values = memberDiscriminators.map((disc) => {
    return disc.value;
  });
  const valueSet = new Set(values);

  if (valueSet.size !== values.length) {
    return undefined;
  }

  return firstProp;
}

/**
 * Extract the `owl:hasValue` discriminator from a blank node that should be
 * an owl:Restriction on a single property.
 */
function extractHasValueDiscriminator(
  bnodeId: string,
  index: SubjectQuadIndex
): undefined | { 'property': string;
  'value': string } {
  const hasValueQuads = quadsForPredicates(index, bnodeId, HAS_VALUE_IRIS);

  if (hasValueQuads.length === 0) {
    return undefined;
  }
  const onPropertyQuads = quadsForPredicates(index, bnodeId, ON_PROPERTY_IRIS);

  if (onPropertyQuads.length === 0) {
    return undefined;
  }

  const propertyObj = onPropertyQuads[0].object;

  if (propertyObj.termType !== 'NamedNode') {
    return undefined;
  }

  // Extract the local name from the property IRI.
  const propertyIri = propertyObj.value;
  const localName = propertyIri.includes('#')
    ? propertyIri.split('#').pop() ?? propertyIri
    : propertyIri.split('/').pop() ?? propertyIri;

  const valueObj = hasValueQuads[0].object;

  if (valueObj.termType !== 'NamedNode' && valueObj.termType !== 'BlankNode' && valueObj.termType !== 'Literal') {
    return undefined;
  }

  const value = String(valueObj.value);

  return {
    'property': localName,
    value
  };
}

// ---------------------------------------------------------------------------
// owl:oneOf → enum extraction
// ---------------------------------------------------------------------------

/**
 * Extract enum values from an owl:oneOf list where members are named
 * individuals or literals.
 *
 * Members that carry a Literal value → raw JS value.
 * Members that are NamedNode IRIs → IRI string.
 * Members that are blank nodes with owl:hasValue → the hasValue literal.
 */
function extractEnumValues(
  listObj: QuadInterface['object'],
  index: SubjectQuadIndex
): unknown[] {
  const items = extractListItems(listObj, index);
  const values: unknown[] = [];

  for (const item of items) {
    switch (item.termType) {
      case 'BlankNode': {
        // Blank-node individual with owl:hasValue.
        const hvQuads = quadsForPredicates(index, item.value, HAS_VALUE_IRIS);

        if (hvQuads.length > 0) {
          const hvObj = hvQuads[0].object;

          if (hvObj.termType === 'Literal') {
            values.push(decodeLiteral(hvObj));
          } else if (hvObj.termType === 'NamedNode' || hvObj.termType === 'BlankNode') {
            values.push(hvObj.value);
          }
        }
        break;
      }
      case 'Literal':
        // Literal — decode to typed JS value via the rdf/js datatype tag.
        values.push(decodeLiteral(item));
        break;
      case 'NamedNode':
        // Named individual — emit its IRI.
        values.push(item.value);
        break;
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
 * Process OWL 2 class expression axioms (intersectionOf, unionOf, oneOf) and
 * return a partial import fragment with schemaDeltas populated.
 *
 * @param quads - All quads from the input graph.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting).
 * @returns OwlImportFragment with schemaDeltas for class expression subjects.
 */
export function importClassExpressions(
  quads: QuadInterface[],
  ctx: OwlImportContext
): OwlImportFragment {
  const index = buildSubjectIndex(quads);
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();

  for (const subjectId of index.keys()) {
    // Only process named class IRIs (skip blank nodes; they are resolved inline).
    if (subjectId.startsWith('_:')) {
      continue;
    }

    // Only process subjects that are owl:Class nodes.
    if (!ctx.allClassIris.has(subjectId)) {
      continue;
    }

    const subjectQuads = index.get(subjectId) ?? [];

    // ------------------------------------------------------------------
    // owl:intersectionOf → allOf
    // ------------------------------------------------------------------
    const intersectionQuads = subjectQuads.filter((quad) => {
      return INTERSECTION_OF_IRIS.has(quad.predicate.value);
    });

    for (const iq of intersectionQuads) {
      const members = resolveListMembers(iq.object, index, ctx.allClassIris, 0);

      if (members.length > 0) {
        const existing = schemaDeltas.get(subjectId) ?? {};

        schemaDeltas.set(subjectId, {
          ...existing,
          'allOf': members
        });
      }
    }

    // ------------------------------------------------------------------
    // owl:unionOf → oneOf (with discriminator detection)
    // ------------------------------------------------------------------
    const unionQuads = subjectQuads.filter((quad) => {
      return UNION_OF_IRIS.has(quad.predicate.value);
    });

    for (const uq of unionQuads) {
      const listItems = extractListItems(uq.object, index);

      // Discriminator detection runs unconditionally — even when all list
      // members are Restriction bnodes (and produce no resolved $ref members).
      const discriminatorProp = detectDiscriminatorProperty(listItems, index);

      if (discriminatorProp !== undefined) {
        // Record the discriminator property name via reportUnsupported so the
        // orchestrator (and tests) can observe it. Since
        // Partial<JsonSchemaDocumentObjectType> does not carry `discriminator`,
        // this is the hook for callers to apply the annotation externally.
        ctx.reportUnsupported(
          `discriminator:${discriminatorProp}`,
          subjectId
        );
      }

      const members = resolveListMembers(uq.object, index, ctx.allClassIris, 0);

      if (members.length > 0) {
        const existing = schemaDeltas.get(subjectId) ?? {};

        schemaDeltas.set(subjectId, {
          ...existing,
          'oneOf': members
        });
      }
    }

    // ------------------------------------------------------------------
    // owl:oneOf → enum
    // ------------------------------------------------------------------
    const oneOfQuads = subjectQuads.filter((quad) => {
      return ONE_OF_IRIS.has(quad.predicate.value);
    });

    // Only treat as an enum when there is no unionOf on the same subject
    // (unionOf already handled above; a subject with both is not valid OWL).
    if (oneOfQuads.length > 0 && unionQuads.length === 0) {
      for (const oq of oneOfQuads) {
        const enumValues = extractEnumValues(oq.object, index);

        if (enumValues.length > 0) {
          const existing = schemaDeltas.get(subjectId) ?? {};

          schemaDeltas.set(subjectId, {
            ...existing,
            'enum': enumValues
          });
        }
      }
    }
  }

  if (schemaDeltas.size === 0 && quads.length === 0) {
    return emptyFragment();
  }

  return {
    'characteristics': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    schemaDeltas
  };
}
