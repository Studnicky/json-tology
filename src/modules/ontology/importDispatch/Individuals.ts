/**
 * Individuals dispatcher — OWL 2 §9.6 Assertions (ABox individuals in TBox input)
 *
 * Responsible for:
 *   owl:NamedIndividual declarations — named individual type assertions
 *   rdf:type assertions on individuals — class membership (populates `types` array)
 *   Property assertion quads          — data/object property values on individuals
 *   owl:sameAs                        — individual identity assertions
 *   owl:differentFrom / owl:AllDifferent — individual distinctness (→ differentFrom array)
 *   owl:NegativePropertyAssertion     — negative property assertion invariants (class-keyed)
 *   owl:hasKey                        — per-object composite key well-formedness
 *
 * Bucket strategy: registry-level (named individuals are collected into the
 * `individuals` array; owl:sameAs pairs flow into `sameAs`;
 * owl:differentFrom pairs flow into `differentFrom`).
 *
 * Graph-native traversal:
 * - rdf:type / property-assertion quads → `ctx.graph.allRelations()`
 * - `owl:AllDifferent` / `owl:hasKey` list traversal → `ctx.graph.collectList`
 * - `owl:NegativePropertyAssertion` blank-node sibling lookup →
 *   `ctx.graph.relationsForSubject`
 * - Literal language / datatype tags are read directly from the relation
 *   (`relation.termType === 'Literal'`, `relation.datatype`, `relation.language`).
 */

import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type {
  OwlImportContextType, OwlImportFragmentType
} from '../../../types/OwlImport.js';
import type { SchemaGraphRelationType } from '../../../types/SchemaGraph.js';
import { Terms } from '../../quads/Terms.js';
import { decodeLiteral } from '../../quads/Terms.js';
import type { InvariantType } from '../../../types/Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { isRecord } from '../../data/DataTypes.js';
import { ImportRelation } from './ImportRelation.js';
import {
  ALL_DIFFERENT_IRIS,
  ASSERTION_PROPERTY_IRIS,
  DIFFERENT_FROM_IRIS,
  DISTINCT_MEMBERS_IRIS,
  HAS_KEY_IRIS,
  NAMED_INDIVIDUAL_IRIS,
  NEGATIVE_PROPERTY_ASSERTION_IRIS,
  RDF_TYPE_PREDICATES,
  SAME_AS_IRIS,
  SOURCE_INDIVIDUAL_IRIS,
  TARGET_INDIVIDUAL_IRIS,
  TARGET_VALUE_IRIS
} from '../../../constants/ONTOLOGY_PREDICATES.js';

// ---------------------------------------------------------------------------
// Helpers — read from graph relations
// ---------------------------------------------------------------------------

/**
 * Returns true when the relation's predicate matches any IRI in the set.
 */
function predicateIn(relation: SchemaGraphRelationType, set: ReadonlySet<string>): boolean {
  return set.has(relation.predicate);
}

/**
 * Returns true when the relation's target is a NamedNode IRI in the set.
 * Accepts both string and node-shape targets.
 */
function targetIriIn(relation: SchemaGraphRelationType, set: ReadonlySet<string>): boolean {
  if (relation.termType !== 'NamedNode') {
    return false;
  }

  const target = typeof relation.target === 'string' ? relation.target : relation.target.id;

  return set.has(target);
}

/**
 * Extract the typed JS value of a Literal relation target. Reconstructs the
 * literal from the relation's preserved `datatype` and `language` fields and
 * decodes via the canonical `decodeLiteral` helper, returning a number /
 * boolean / Date / string per the XSD datatype.
 */
function literalTarget(relation: SchemaGraphRelationType): unknown {
  if (relation.termType === 'Literal') {
    const rawValue = typeof relation.target === 'string' ? relation.target : relation.target.id;
    const literalTerm = Terms.literal(rawValue, {
      'datatype': Terms.iri(relation.datatype ?? ''),
      'language': relation.language ?? ''
    });

    return decodeLiteral(literalTerm);
  }

  return undefined;
}

/**
 * Returns true when value is a primitive scalar (string, number, or boolean).
 * Used by hasKeyInvariant to enforce per-object key well-formedness.
 */
function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

// ---------------------------------------------------------------------------
// Build NegativePropertyAssertion invariant
// ---------------------------------------------------------------------------

/**
 * Build a registry-level invariant that asserts a specific property assertion
 * does NOT hold for the given individual.
 *
 * The invariant is keyed to the individual's class IRI, so it runs for every
 * instance of that class. An NPA targets one *specific* individual, so the `fn`
 * guards on identity: it enforces the constraint only when the validated value
 * carries that individual's IRI in `$id` (or `@id`). This is the convention for
 * validating a named individual — the instance IS the individual, identified by
 * `$id` — and is exercised end-to-end in `owlIndividualEnforcement.test.ts`. A
 * value with no identity (typical anonymous data) is intentionally not subject
 * to a per-individual NPA, since NPA does not constrain arbitrary class members.
 */
function negativePropertyAssertionInvariant(
  sourceIri: string,
  propertyIri: string,
  assertionValue: unknown
): InvariantType {
  return {
    'fn': (value: unknown): null | string => {
      if (!isRecord(value)) {
        return null;
      }
      // Identity guard: an NPA binds one named individual, so enforce only when
      // the value declares it is that individual (see the convention above).
      const id = value['$id'] ?? value['@id'];

      if (id !== sourceIri) {
        return null;
      }
      const propVal = value[propertyIri];

      if (propVal === undefined) {
        return null;
      }
      if (Array.isArray(propVal)) {
        if ((propVal as unknown[]).includes(assertionValue)) {
          return `owl:NegativePropertyAssertion violation: <${sourceIri}> must not have <${propertyIri}> = ${JSON.stringify(assertionValue)}`;
        }

        return null;
      }
      if (propVal === assertionValue) {
        return `owl:NegativePropertyAssertion violation: <${sourceIri}> must not have <${propertyIri}> = ${JSON.stringify(assertionValue)}`;
      }

      return null;
    },
    'name': `negativePropertyAssertion(${sourceIri},${propertyIri},${String(assertionValue)})`
  };
}

// ---------------------------------------------------------------------------
// Build hasKey invariant
// ---------------------------------------------------------------------------

/**
 * Build a registry-level invariant for composite key well-formedness on class C
 * over the given property IRIs.
 *
 * Enforces per-object key well-formedness: each present key property must be a scalar
 * (string | number | boolean). Cross-instance uniqueness is a collection-level concern
 * surfaced via the jt:hasKey annotation (schema delta).
 */
function hasKeyInvariant(classIri: string, propertyIris: string[]): InvariantType {
  const key = propertyIris.join(',');

  return {
    'fn': (value: unknown): null | string => {
      if (!isRecord(value)) {
        return null;
      }
      for (const propIri of propertyIris) {
        const propVal = value[propIri];

        if (propVal !== undefined && !isScalar(propVal)) {
          return `owl:hasKey violation: class <${classIri}> key property <${propIri}> must be a scalar (string | number | boolean) for a well-formed composite key, got ${JSON.stringify(typeof propVal)}`;
        }
      }

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
 * - owl:differentFrom → fragment.differentFrom (pairs, not invariants)
 * - owl:AllDifferent + owl:distinctMembers → fragment.differentFrom (pairwise pairs)
 * - owl:NegativePropertyAssertion → fragment.invariants keyed to class IRI
 * - owl:hasKey on a class → fragment.invariants + jt:hasKey annotation in schemaDeltas
 *
 * Graph-native: reads `ctx.graph.allRelations()` for subject/predicate/object
 * triples, `ctx.graph.collectList(head)` for `owl:distinctMembers` /
 * `owl:hasKey` RDF lists, and `ctx.graph.relationsForSubject(bnode)` for
 * `owl:NegativePropertyAssertion` sibling predicates.
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `ctx.graph`.
 * @param ctx   - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragmentType with individuals, sameAs, differentFrom, invariants, and schemaDeltas populated.
 */
export function importIndividuals(_quads: QuadInterface[], ctx: OwlImportContextType): OwlImportFragmentType {
  const sameAs: Array<readonly [string, string]> = [];
  const differentFrom: Array<readonly [string, string]> = [];
  const invariants: Array<{
    'invariant': InvariantType;
    'schemaId': string;
  }> = [];
  const schemaDeltas = new Map<string, Partial<JsonSchemaDocumentObjectType>>();

  const allRelations = ctx.graph.allRelations();

  // ---- Collect named individual IRIs from rdf:type relations --------------

  const namedIndividualIris = new Set<string>();

  for (const relation of allRelations) {
    if (predicateIn(relation, RDF_TYPE_PREDICATES) && targetIriIn(relation, NAMED_INDIVIDUAL_IRIS)) {
      const subject = relation.source.id;

      if (!subject.startsWith('_:')) {
        namedIndividualIris.add(subject);
      }
    }
  }

  // ---- Named individuals: types + property assertions ---------------------

  const individuals: Array<{
    'iri': string;
    'properties': Record<string, unknown>;
    'types': readonly string[];
  }> = [];

  for (const individualIri of namedIndividualIris) {
    const subjectRelations = ctx.graph.relationsForSubject(individualIri);
    const types: string[] = [];
    const properties: Record<string, unknown> = {};

    for (const relation of subjectRelations) {
      if (predicateIn(relation, RDF_TYPE_PREDICATES)) {
        const objectIri = ImportRelation.namedNodeIri(relation);

        if (objectIri === null || NAMED_INDIVIDUAL_IRIS.has(objectIri)) {
          continue;
        }
        if (ctx.allClassIris.has(objectIri)) {
          types.push(objectIri);
        }
        continue;
      }

      // Property assertion — must be a registered property IRI
      if (!ctx.allPropertyIris.has(relation.predicate)) {
        continue;
      }

      let value: unknown;

      if (relation.termType === 'Literal') {
        value = literalTarget(relation);
      } else if (relation.termType === 'NamedNode') {
        value = ImportRelation.namedNodeIri(relation);
      } else {
        continue;
      }

      if (value !== undefined && value !== null) {
        properties[relation.predicate] = value;
      }
    }

    individuals.push({
      'iri': individualIri,
      properties,
      'types': types
    });
  }

  // ---- Build individualToClasses map for NPA invariant keying -------------

  const individualToClasses = new Map<string, string[]>();

  for (const individual of individuals) {
    individualToClasses.set(individual.iri, [...individual.types]);
  }

  // ---- owl:sameAs pairs ---------------------------------------------------
  // The forward projection emits both (a, b) and (b, a) directions;
  // deduplicate using a canonical order key so each logical pair appears once.

  const seenSameAs = new Set<string>();

  for (const relation of allRelations) {
    if (!predicateIn(relation, SAME_AS_IRIS)) {
      continue;
    }
    const iriA = relation.source.id;
    const iriB = ImportRelation.namedNodeIri(relation);

    if (iriB === null || iriA === iriB || iriA.startsWith('_:') || iriB.startsWith('_:')) {
      continue;
    }
    const pairKey = iriA < iriB ? `${iriA}\0${iriB}` : `${iriB}\0${iriA}`;

    if (seenSameAs.has(pairKey)) {
      continue;
    }
    seenSameAs.add(pairKey);
    sameAs.push([
      iriA,
      iriB
    ] as const);
  }

  // ---- owl:differentFrom — pairs flow to differentFrom array --------------

  const seenDifferentFrom = new Set<string>();

  for (const relation of allRelations) {
    if (!predicateIn(relation, DIFFERENT_FROM_IRIS)) {
      continue;
    }
    const iriA = relation.source.id;
    const iriB = ImportRelation.namedNodeIri(relation);

    if (iriB === null || iriA.startsWith('_:') || iriB.startsWith('_:')) {
      continue;
    }
    const pairKey = iriA < iriB ? `${iriA}\0${iriB}` : `${iriB}\0${iriA}`;

    if (seenDifferentFrom.has(pairKey)) {
      continue;
    }
    seenDifferentFrom.add(pairKey);
    differentFrom.push([
      iriA,
      iriB
    ] as const);
  }

  // ---- owl:AllDifferent + owl:distinctMembers (RDF list) ------------------

  for (const relation of allRelations) {
    if (!predicateIn(relation, RDF_TYPE_PREDICATES) || !targetIriIn(relation, ALL_DIFFERENT_IRIS)) {
      continue;
    }

    const allDiffSubject = relation.source.id;
    const distinctRelations = ctx.graph.relationsForSubject(allDiffSubject);

    for (const dmRelation of distinctRelations) {
      if (!predicateIn(dmRelation, DISTINCT_MEMBERS_IRIS)) {
        continue;
      }

      const listHead = ImportRelation.targetValue(dmRelation);
      const memberIris: string[] = [];

      for (const item of ctx.graph.collectList(listHead)) {
        if (item.termType === 'NamedNode') {
          memberIris.push(item.target);
        }
      }

      for (let i = 0; i < memberIris.length; i++) {
        for (let j = i + 1; j < memberIris.length; j++) {
          const iriA = memberIris[i];
          const iriB = memberIris[j];

          if (iriA === undefined || iriB === undefined) {
            continue;
          }

          const pairKey = iriA < iriB ? `${iriA}\0${iriB}` : `${iriB}\0${iriA}`;

          if (seenDifferentFrom.has(pairKey)) {
            continue;
          }
          seenDifferentFrom.add(pairKey);
          differentFrom.push([
            iriA,
            iriB
          ] as const);
        }
      }
    }
  }

  // ---- owl:NegativePropertyAssertion (blank-node sibling predicates) ------

  for (const relation of allRelations) {
    if (!predicateIn(relation, RDF_TYPE_PREDICATES) || !targetIriIn(relation, NEGATIVE_PROPERTY_ASSERTION_IRIS)) {
      continue;
    }

    const negSubject = relation.source.id;
    const siblings = ctx.graph.relationsForSubject(negSubject);

    let sourceIndividual: null | string = null;
    let assertionProperty: null | string = null;
    let target: unknown;

    for (const sibling of siblings) {
      if (predicateIn(sibling, SOURCE_INDIVIDUAL_IRIS)) {
        sourceIndividual = ImportRelation.namedNodeIri(sibling);
      } else if (predicateIn(sibling, ASSERTION_PROPERTY_IRIS)) {
        assertionProperty = ImportRelation.namedNodeIri(sibling);
      } else if (predicateIn(sibling, TARGET_INDIVIDUAL_IRIS)) {
        target = ImportRelation.namedNodeIri(sibling);
      } else if (predicateIn(sibling, TARGET_VALUE_IRIS)) {
        target = sibling.termType === 'Literal' ? literalTarget(sibling) : ImportRelation.namedNodeIri(sibling);
      }
    }

    if (sourceIndividual === null || assertionProperty === null) {
      ctx.reportUnsupported('owl:NegativePropertyAssertion', negSubject);
      continue;
    }

    const classIris = individualToClasses.get(sourceIndividual) ?? [];

    if (classIris.length === 0) {
      ctx.reportUnsupported('owl:NegativePropertyAssertion', sourceIndividual);
      continue;
    }
    for (const classIri of classIris) {
      invariants.push({
        'invariant': negativePropertyAssertionInvariant(sourceIndividual, assertionProperty, target),
        'schemaId': classIri
      });
    }
  }

  // ---- owl:hasKey (RDF list of property IRIs on a class) ------------------

  for (const relation of allRelations) {
    if (!predicateIn(relation, HAS_KEY_IRIS)) {
      continue;
    }
    const classIri = relation.source.id;

    if (classIri.startsWith('_:')) {
      continue;
    }

    const listHead = ImportRelation.targetValue(relation);
    const propertyIris: string[] = [];

    for (const item of ctx.graph.collectList(listHead)) {
      if (item.termType === 'NamedNode') {
        propertyIris.push(item.target);
      }
    }

    if (propertyIris.length === 0) {
      ctx.reportUnsupported('owl:hasKey', classIri);
      continue;
    }

    invariants.push({
      'invariant': hasKeyInvariant(classIri, propertyIris),
      'schemaId': classIri
    });

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
    'differentFrom': differentFrom,
    individuals,
    'invariants': invariants,
    'sameAs': sameAs,
    'schemaDeltas': schemaDeltas
  };
}
