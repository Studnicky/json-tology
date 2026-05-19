/**
 * Individuals dispatcher — OWL 2 §9.6 Assertions (ABox individuals in TBox input)
 *
 * Responsible for:
 *   owl:NamedIndividual declarations — named individual type assertions
 *   rdf:type assertions on individuals — class membership (populates `types` array)
 *   Property assertion quads          — data/object property values on individuals
 *   owl:sameAs                        — individual identity assertions
 *   owl:differentFrom / owl:AllDifferent — individual distinctness
 *   owl:NegativePropertyAssertion     — negative property assertion invariants
 *   owl:hasKey                        — composite key uniqueness constraints
 *
 * Bucket strategy: registry-level (named individuals are collected into the
 * `individuals` array; owl:sameAs pairs flow into `sameAs`).
 */

import type { QuadInterface } from '../../../interfaces/Quad.js';
import type {
  OwlImportContext, OwlImportFragment
} from '../../../interfaces/OwlImport.js';
import type { InvariantInterface } from '../../../interfaces/Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';

// ---------------------------------------------------------------------------
// OWL / RDF IRI constants (full and prefixed forms)
// ---------------------------------------------------------------------------

const OWL_NS = 'http://www.w3.org/2002/07/owl#';
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';

const NAMED_INDIVIDUAL_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}NamedIndividual`,
  'owl:NamedIndividual'
]);

const SAME_AS_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}sameAs`,
  'owl:sameAs'
]);

const DIFFERENT_FROM_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}differentFrom`,
  'owl:differentFrom'
]);

const ALL_DIFFERENT_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}AllDifferent`,
  'owl:AllDifferent'
]);

const DISTINCT_MEMBERS_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}distinctMembers`,
  'owl:distinctMembers'
]);

const NEGATIVE_PROPERTY_ASSERTION_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}NegativePropertyAssertion`,
  'owl:NegativePropertyAssertion'
]);

const SOURCE_INDIVIDUAL_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}sourceIndividual`,
  'owl:sourceIndividual'
]);

const ASSERTION_PROPERTY_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}assertionProperty`,
  'owl:assertionProperty'
]);

const TARGET_INDIVIDUAL_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}targetIndividual`,
  'owl:targetIndividual'
]);

const TARGET_VALUE_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}targetValue`,
  'owl:targetValue'
]);

const HAS_KEY_IRIS: ReadonlySet<string> = new Set([
  `${OWL_NS}hasKey`,
  'owl:hasKey'
]);

const TYPE_PREDICATES: ReadonlySet<string> = new Set([
  `${RDF_NS}type`,
  'rdf:type'
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when a quad's predicate matches any IRI in the given set.
 */
function predicateIn(quad: QuadInterface, set: ReadonlySet<string>): boolean {
  return set.has(quad.predicate.value);
}

/**
 * Returns true when a quad's object is a NamedNode matching any IRI in the set.
 */
function objectIriIn(quad: QuadInterface, set: ReadonlySet<string>): boolean {
  return quad.object.termType === 'NamedNode' && set.has(quad.object.value);
}

/**
 * Collect the IRI string value of a named-node object, or null.
 */
function namedNodeValue(quad: QuadInterface): null | string {
  if (quad.object.termType === 'NamedNode') {
    return quad.object.value;
  }

  return null;
}

/**
 * Collect the raw JS value of a literal object.
 */
function literalValue(quad: QuadInterface): unknown {
  if (quad.object.termType === 'Literal') {
    return quad.object.value;
  }

  return quad.object.termType === 'NamedNode' ? quad.object.value : undefined;
}

/**
 * Collect IRI members from a List-typed object term.
 * Returns an empty array if the object is not a List or contains no NamedNode items.
 */
function listIris(quad: QuadInterface): string[] {
  if (quad.object.termType !== 'List') {
    return [];
  }

  return quad.object.items
    .filter((item): item is typeof item & {
      'termType': 'NamedNode';
      'value': string;
    } => {
      return item.termType === 'NamedNode';
    })
    .map((item) => {
      return item.value;
    });
}

/**
 * Build a map from subject IRI → all quads with that subject.
 */
function indexBySubject(quads: QuadInterface[]): Map<string, QuadInterface[]> {
  const index = new Map<string, QuadInterface[]>();

  for (const quad of quads) {
    const subjectIri = quad.subject.value;
    let list = index.get(subjectIri);

    if (list === undefined) {
      list = [];
      index.set(subjectIri, list);
    }
    list.push(quad);
  }

  return index;
}

// ---------------------------------------------------------------------------
// Collect named individual IRIs
// ---------------------------------------------------------------------------

/**
 * Collect the set of subject IRIs that are declared as owl:NamedIndividual.
 */
function collectNamedIndividualIris(quads: QuadInterface[]): Set<string> {
  const iris = new Set<string>();

  for (const quad of quads) {
    if (
      TYPE_PREDICATES.has(quad.predicate.value)
      && objectIriIn(quad, NAMED_INDIVIDUAL_IRIS)
      && quad.subject.termType === 'NamedNode'
    ) {
      iris.add(quad.subject.value);
    }
  }

  return iris;
}

// ---------------------------------------------------------------------------
// Collect type assertions on individuals
// ---------------------------------------------------------------------------

/**
 * Collect rdf:type assertions on an individual subject, filtering out the
 * NamedIndividual declaration itself and returning only class IRIs.
 */
function collectIndividualTypes(
  subjectQuads: QuadInterface[],
  allClassIris: ReadonlySet<string>
): string[] {
  const types: string[] = [];

  for (const quad of subjectQuads) {
    if (!TYPE_PREDICATES.has(quad.predicate.value)) {
      continue;
    }

    const objectIri = namedNodeValue(quad);

    if (objectIri === null) {
      continue;
    }

    // Skip the NamedIndividual declaration itself
    if (NAMED_INDIVIDUAL_IRIS.has(objectIri)) {
      continue;
    }

    // Only include IRIs that are registered as class IRIs
    if (allClassIris.has(objectIri)) {
      types.push(objectIri);
    }
  }

  return types;
}

// ---------------------------------------------------------------------------
// Collect property assertions on individuals
// ---------------------------------------------------------------------------

/**
 * Collect property assertions for a named individual, matching only predicates
 * that are registered object or datatype properties.
 */
function collectPropertyAssertions(
  subjectQuads: QuadInterface[],
  allPropertyIris: ReadonlySet<string>
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const quad of subjectQuads) {
    const predicateIri = quad.predicate.value;

    // Skip rdf:type — handled separately
    if (TYPE_PREDICATES.has(predicateIri)) {
      continue;
    }

    // Only register triples where the predicate is a known property IRI
    if (!allPropertyIris.has(predicateIri)) {
      continue;
    }

    const value = quad.object.termType === 'Literal'
      ? literalValue(quad)
      : namedNodeValue(quad);

    if (value !== undefined && value !== null) {
      properties[predicateIri] = value;
    }
  }

  return properties;
}

// ---------------------------------------------------------------------------
// Build differentFrom invariant
// ---------------------------------------------------------------------------

/**
 * Build a registry-level invariant that asserts two IRIs are NOT marked
 * sameAs at materialise time.
 *
 * The invariant name encodes the pair so the caller can deduplicate pairs.
 */
function differentFromInvariant(
  iriA: string,
  iriB: string
): InvariantInterface {
  return {
    'fn': () => {
      // Runtime check — at materialise time the registry sameAs store would
      // be consulted. The invariant name carries the pair for downstream consumers.
      return null;
    },
    'name': `differentFrom(${iriA},${iriB})`
  };
}

// ---------------------------------------------------------------------------
// Build NegativePropertyAssertion invariant
// ---------------------------------------------------------------------------

/**
 * Build a registry-level invariant that asserts a specific property assertion
 * does NOT hold for the given individual.
 */
function negativePropertyAssertionInvariant(
  sourceIri: string,
  propertyIri: string,
  targetValue: unknown
): InvariantInterface {
  return {
    'fn': () => {
      // Encodes the negative assertion as a named invariant.
      // Downstream consumers inspect the name to enforce the constraint.
      return null;
    },
    'name': `negativePropertyAssertion(${sourceIri},${propertyIri},${String(targetValue)})`
  };
}

// ---------------------------------------------------------------------------
// Build hasKey invariant
// ---------------------------------------------------------------------------

/**
 * Build a registry-level invariant for composite key uniqueness on class C
 * over the given property IRIs.
 */
function hasKeyInvariant(classIri: string, propertyIris: string[]): InvariantInterface {
  const key = propertyIris.join(',');

  return {
    'fn': () => {
      // Encodes the hasKey constraint. Downstream consumers inspect the name.
      return null;
    },
    'name': `hasKey(${classIri},[${key}])`
  };
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------

/**
 * Process OWL 2 individual (ABox) assertions found within TBox input, returning
 * a partial import fragment.
 *
 * Handles:
 * - owl:NamedIndividual declarations with rdf:type class assertions and property values
 * - owl:sameAs identity pairs → fragment.sameAs
 * - owl:differentFrom → fragment.invariants (differentFrom invariant per pair)
 * - owl:AllDifferent + owl:distinctMembers → pairwise differentFrom invariants
 * - owl:NegativePropertyAssertion → fragment.invariants (negative assertion invariant)
 * - owl:hasKey on a class → fragment.invariants + jt:hasKey annotation in schemaDeltas
 *
 * @param quads - All quads from the input graph.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragment with individuals, sameAs, invariants, and schemaDeltas populated.
 */
export function importIndividuals(quads: QuadInterface[], ctx: OwlImportContext): OwlImportFragment {
  const sameAs: Array<readonly [string, string]> = [];
  const invariants: Array<{
    'invariant': InvariantInterface;
    'schemaId': string;
  }> = [];
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();

  // Build subject index for blank-node look-ups (NegativePropertyAssertion, AllDifferent)
  const bySubject = indexBySubject(quads);

  // Collect named individual IRIs
  const namedIndividualIris = collectNamedIndividualIris(quads);

  // ---- Named individuals with types + property assertions -----------------

  const individuals: Array<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }> = [];

  for (const individualIri of namedIndividualIris) {
    const subjectQuads = bySubject.get(individualIri) ?? [];
    const types = collectIndividualTypes(subjectQuads, ctx.allClassIris);
    const properties = collectPropertyAssertions(subjectQuads, ctx.allPropertyIris);

    individuals.push({
      'iri': individualIri,
      properties,
      'types': types
    });
  }

  // ---- owl:sameAs pairs ---------------------------------------------------
  // appendSameAsQuads emits both forward (a, b) and reverse (b, a) directions.
  // Deduplicate using a canonical order key so each logical pair appears once.

  const seenSameAs = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== 'NamedNode'
      || !predicateIn(quad, SAME_AS_IRIS)
      || quad.object.termType !== 'NamedNode'
    ) {
      continue;
    }

    const iriA = quad.subject.value;
    const iriB = quad.object.value;

    // Skip self-identity
    if (iriA === iriB) {
      continue;
    }

    // Canonical pair key (order-independent)
    const pairKey = iriA < iriB ? `${iriA}\0${iriB}` : `${iriB}\0${iriA}`;

    if (seenSameAs.has(pairKey)) {
      continue;
    }
    seenSameAs.add(pairKey);

    // Always store in the original forward direction (subject, object)
    const pair: readonly [string, string] = [
      iriA,
      iriB
    ];

    sameAs.push(pair);
  }

  // ---- owl:differentFrom --------------------------------------------------

  const seenDifferentFrom = new Set<string>();

  for (const quad of quads) {
    if (
      quad.subject.termType !== 'NamedNode'
      || !predicateIn(quad, DIFFERENT_FROM_IRIS)
      || quad.object.termType !== 'NamedNode'
    ) {
      continue;
    }

    const iriA = quad.subject.value;
    const iriB = quad.object.value;
    // Canonical pair key (order-independent)
    const pairKey = iriA < iriB ? `${iriA}\0${iriB}` : `${iriB}\0${iriA}`;

    if (seenDifferentFrom.has(pairKey)) {
      continue;
    }
    seenDifferentFrom.add(pairKey);

    invariants.push({
      'invariant': differentFromInvariant(iriA, iriB),
      // Use the first IRI as the schema anchor; downstream binds per-individual
      'schemaId': iriA
    });
  }

  // ---- owl:AllDifferent + owl:distinctMembers ------------------------------

  for (const quad of quads) {
    // Find subjects typed as owl:AllDifferent
    if (
      !TYPE_PREDICATES.has(quad.predicate.value)
      || !objectIriIn(quad, ALL_DIFFERENT_IRIS)
    ) {
      continue;
    }

    const allDiffSubject = quad.subject.value;
    const subjectQuads = bySubject.get(allDiffSubject) ?? [];

    // Collect owl:distinctMembers list
    for (const memberQuad of subjectQuads) {
      if (!predicateIn(memberQuad, DISTINCT_MEMBERS_IRIS)) {
        continue;
      }

      const memberIris = listIris(memberQuad);

      // Emit pairwise differentFrom invariants
      for (let i = 0; i < memberIris.length; i++) {
        for (let j = i + 1; j < memberIris.length; j++) {
          const iriA = memberIris[i];
          const iriB = memberIris[j];
          const pairKey = iriA < iriB ? `${iriA}\0${iriB}` : `${iriB}\0${iriA}`;

          if (seenDifferentFrom.has(pairKey)) {
            continue;
          }
          seenDifferentFrom.add(pairKey);

          invariants.push({
            'invariant': differentFromInvariant(iriA, iriB),
            'schemaId': iriA
          });
        }
      }
    }
  }

  // ---- owl:NegativePropertyAssertion --------------------------------------

  for (const quad of quads) {
    // Find subjects typed as owl:NegativePropertyAssertion
    if (
      !TYPE_PREDICATES.has(quad.predicate.value)
      || !objectIriIn(quad, NEGATIVE_PROPERTY_ASSERTION_IRIS)
    ) {
      continue;
    }

    const negSubject = quad.subject.value;
    const negQuads = bySubject.get(negSubject) ?? [];

    let sourceIndividual: null | string = null;
    let assertionProperty: null | string = null;
    let targetValue: unknown = undefined;

    for (const negQuad of negQuads) {
      if (predicateIn(negQuad, SOURCE_INDIVIDUAL_IRIS)) {
        sourceIndividual = namedNodeValue(negQuad);
      } else if (predicateIn(negQuad, ASSERTION_PROPERTY_IRIS)) {
        assertionProperty = namedNodeValue(negQuad);
      } else if (predicateIn(negQuad, TARGET_INDIVIDUAL_IRIS)) {
        targetValue = namedNodeValue(negQuad);
      } else if (predicateIn(negQuad, TARGET_VALUE_IRIS)) {
        targetValue = literalValue(negQuad);
      }
    }

    if (sourceIndividual === null || assertionProperty === null) {
      // Malformed NegativePropertyAssertion — skip
      ctx.reportUnsupported('owl:NegativePropertyAssertion', negSubject);
      continue;
    }

    invariants.push({
      'invariant': negativePropertyAssertionInvariant(sourceIndividual, assertionProperty, targetValue),
      'schemaId': sourceIndividual
    });
  }

  // ---- owl:hasKey ---------------------------------------------------------

  for (const quad of quads) {
    if (
      quad.subject.termType !== 'NamedNode'
      || !predicateIn(quad, HAS_KEY_IRIS)
    ) {
      continue;
    }

    const classIri = quad.subject.value;
    const propertyIris = listIris(quad);

    if (propertyIris.length === 0) {
      // No property IRIs in key — report and skip
      ctx.reportUnsupported('owl:hasKey', classIri);
      continue;
    }

    // Register a runtime invariant for the composite key
    invariants.push({
      'invariant': hasKeyInvariant(classIri, propertyIris),
      'schemaId': classIri
    });

    // Annotate the class schema delta with jt:hasKey so consumers can introspect
    const existing = schemaDeltas.get(classIri) ?? {};
    const existingKeys = existing['jt:hasKey'] ?? [];

    schemaDeltas.set(classIri, {
      ...existing,
      'jt:hasKey': [
        ...existingKeys,
        propertyIris
      ]
    });
  }

  return {
    'characteristics': [],
    individuals,
    'invariants': invariants,
    'sameAs': sameAs,
    'schemaDeltas': schemaDeltas
  };
}
