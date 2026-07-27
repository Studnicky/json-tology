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
 * - rdf:type / property-assertion quads → `context.graph.allRelations()`
 * - `owl:AllDifferent` / `owl:hasKey` list traversal → `context.graph.collectList`
 * - `owl:NegativePropertyAssertion` blank-node sibling lookup →
 *   `context.graph.relationsForSubject`
 * - Literal language / datatype tags are read directly from the relation
 *   (`relation.termType === 'Literal'`, `relation.datatype`, `relation.language`).
 */

import type { SchemaGraphRelationInterface } from '../../../interfaces/SchemaGraphRelationInterface.js';
import type { QuadInterface } from '../../../interfaces/QuadInterface.js';
import type { OwlImportContextInterface } from '../../../interfaces/OwlImportContextInterface.js';
import type { OwlImportFragmentInterface } from '../../../interfaces/OwlImportFragmentInterface.js';
import { Terms } from '../../quads/Terms.js';
import type { InvariantType } from '../../../types/Invariant.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { DataType } from '../../data/DataType.js';
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
 * Graph-native: reads `context.graph.allRelations()` for subject/predicate/object
 * triples, `context.graph.collectList(head)` for `owl:distinctMembers` /
 * `owl:hasKey` RDF lists, and `context.graph.relationsForSubject(bnode)` for
 * `owl:NegativePropertyAssertion` sibling predicates.
 *
 * @param _quads - Retained for back-compat with the dispatcher signature; the
 *                 implementation reads exclusively from `context.graph`.
 * @param context - Shared import context (graph, curie, IRI sets, reporting helpers).
 * @returns OwlImportFragmentInterface with individuals, sameAs, differentFrom, invariants, and schemaDeltas populated.
 */
export class Individuals {
  public static dispatch(_quads: QuadInterface[], context: OwlImportContextInterface): OwlImportFragmentInterface {
    const sameAs: Array<[string, string]> = [];
    const differentFrom: Array<[string, string]> = [];
    const invariants: Array<{
      'invariant': InvariantType;
      'schemaId': string;
    }> = [];
    const schemaDeltas = new Map<string, JsonSchemaDocumentObjectType>();

    const allRelations = context.graph.allRelations();

    // ---- Collect named individual IRIs from rdf:type relations --------------

    const namedIndividualIris = new Set<string>();

    for (const relation of allRelations) {
      if (Individuals.predicateIn(relation, RDF_TYPE_PREDICATES) && Individuals.targetIriIn(relation, NAMED_INDIVIDUAL_IRIS)) {
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
      'types': string[];
    }> = [];

    for (const individualIri of namedIndividualIris) {
      const subjectRelations = context.graph.relationsForSubject(individualIri);
      const types: string[] = [];
      const properties: Record<string, unknown> = {};

      for (const relation of subjectRelations) {
        if (Individuals.predicateIn(relation, RDF_TYPE_PREDICATES)) {
          const objectIri = ImportRelation.namedNodeIri(relation);

          if (objectIri === null || NAMED_INDIVIDUAL_IRIS.has(objectIri)) {
            continue;
          }
          if (context.allClassIris.has(objectIri)) {
            types.push(objectIri);
          }
          continue;
        }

        // Property assertion — must be a registered property IRI
        if (!context.allPropertyIris.has(relation.predicate)) {
          continue;
        }

        let value: unknown;

        if (relation.termType === 'Literal') {
          value = Individuals.literalTarget(relation);
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
      if (!Individuals.predicateIn(relation, SAME_AS_IRIS)) {
        continue;
      }
      const iriA = relation.source.id;
      const iriB = ImportRelation.namedNodeIri(relation);

      if (iriB === null || iriA === iriB || iriA.startsWith('_:') || iriB.startsWith('_:')) {
        continue;
      }
      Individuals.recordUniquePair(seenSameAs, sameAs, iriA, iriB);
    }

    // ---- owl:differentFrom — pairs flow to differentFrom array --------------

    const seenDifferentFrom = new Set<string>();

    for (const relation of allRelations) {
      if (!Individuals.predicateIn(relation, DIFFERENT_FROM_IRIS)) {
        continue;
      }
      const iriA = relation.source.id;
      const iriB = ImportRelation.namedNodeIri(relation);

      if (iriB === null || iriA.startsWith('_:') || iriB.startsWith('_:')) {
        continue;
      }
      Individuals.recordUniquePair(seenDifferentFrom, differentFrom, iriA, iriB);
    }

    // ---- owl:AllDifferent + owl:distinctMembers (RDF list) ------------------

    for (const relation of allRelations) {
      if (!Individuals.predicateIn(relation, RDF_TYPE_PREDICATES) || !Individuals.targetIriIn(relation, ALL_DIFFERENT_IRIS)) {
        continue;
      }

      const allDiffSubject = relation.source.id;
      const distinctRelations = context.graph.relationsForSubject(allDiffSubject);

      for (const dmRelation of distinctRelations) {
        if (!Individuals.predicateIn(dmRelation, DISTINCT_MEMBERS_IRIS)) {
          continue;
        }

        const listHead = ImportRelation.targetValue(dmRelation);
        const memberIris = ImportRelation.collectNamedNodeIris(context.graph, listHead);
        const memberCount = memberIris.length;

        for (let i = 0; i < memberCount; i++) {
          for (let j = i + 1; j < memberCount; j++) {
            const iriA = memberIris[i];
            const iriB = memberIris[j];

            if (iriA === undefined || iriB === undefined) {
              continue;
            }

            Individuals.recordUniquePair(seenDifferentFrom, differentFrom, iriA, iriB);
          }
        }
      }
    }

    // ---- owl:NegativePropertyAssertion (blank-node sibling predicates) ------

    for (const relation of allRelations) {
      if (!Individuals.predicateIn(relation, RDF_TYPE_PREDICATES) || !Individuals.targetIriIn(relation, NEGATIVE_PROPERTY_ASSERTION_IRIS)) {
        continue;
      }

      const negSubject = relation.source.id;
      const siblings = context.graph.relationsForSubject(negSubject);

      let sourceIndividual: null | string = null;
      let assertionProperty: null | string = null;
      let target: unknown;

      for (const sibling of siblings) {
        if (Individuals.predicateIn(sibling, SOURCE_INDIVIDUAL_IRIS)) {
          sourceIndividual = ImportRelation.namedNodeIri(sibling);
        } else if (Individuals.predicateIn(sibling, ASSERTION_PROPERTY_IRIS)) {
          assertionProperty = ImportRelation.namedNodeIri(sibling);
        } else if (Individuals.predicateIn(sibling, TARGET_INDIVIDUAL_IRIS)) {
          target = ImportRelation.namedNodeIri(sibling);
        } else if (Individuals.predicateIn(sibling, TARGET_VALUE_IRIS)) {
          target = sibling.termType === 'Literal' ? Individuals.literalTarget(sibling) : ImportRelation.namedNodeIri(sibling);
        }
      }

      if (sourceIndividual === null || assertionProperty === null) {
        context.reportUnsupported('owl:NegativePropertyAssertion', negSubject);
        continue;
      }

      const classIris = individualToClasses.get(sourceIndividual) ?? [];

      if (classIris.length === 0) {
        context.reportUnsupported('owl:NegativePropertyAssertion', sourceIndividual);
        continue;
      }
      for (const classIri of classIris) {
        invariants.push({
          'invariant': Individuals.negativePropertyAssertionInvariant(sourceIndividual, assertionProperty, target),
          'schemaId': classIri
        });
      }
    }

    // ---- owl:hasKey (RDF list of property IRIs on a class) ------------------

    for (const relation of allRelations) {
      if (!Individuals.predicateIn(relation, HAS_KEY_IRIS)) {
        continue;
      }
      const classIri = relation.source.id;

      if (classIri.startsWith('_:')) {
        continue;
      }

      const listHead = ImportRelation.targetValue(relation);
      const propertyIris = ImportRelation.collectNamedNodeIris(context.graph, listHead);

      if (propertyIris.length === 0) {
        context.reportUnsupported('owl:hasKey', classIri);
        continue;
      }

      invariants.push({
        'invariant': Individuals.hasKeyInvariant(classIri, propertyIris),
        'schemaId': classIri
      });

      const existingKeys = schemaDeltas.get(classIri)?.['jt:hasKey'] ?? [];

      ImportRelation.mergeSchemaDelta(schemaDeltas, classIri, {
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

  /**
   * Build a registry-level invariant for composite key well-formedness on class C
   * over the given property IRIs.
   *
   * Enforces per-object key well-formedness: each present key property must be a scalar
   * (string | number | boolean). Cross-instance uniqueness is a collection-level concern
   * surfaced via the jt:hasKey annotation (schema delta).
   */
  public static hasKeyInvariant(classIri: string, propertyIris: string[]): InvariantType {
    const key = propertyIris.join(',');

    const hasKeyCheck = (value: unknown): null | string => {
      if (!DataType.isRecord(value)) {
        return null;
      }
      for (const propIri of propertyIris) {
        const propertyValue = value[propIri];

        if (propertyValue !== undefined && !Individuals.isScalar(propertyValue)) {
          return `owl:hasKey violation: class <${classIri}> key property <${propIri}> must be a scalar (string | number | boolean) for a well-formed composite key, got ${JSON.stringify(typeof propertyValue)}`;
        }
      }

      return null;
    };

    return {
      'fn': hasKeyCheck,
      'name': `hasKey(${classIri},[${key}])`
    };
  }

  /**
   * Returns true when value is a primitive scalar (string, number, or boolean).
   * Used by hasKeyInvariant to enforce per-object key well-formedness.
   */
  public static isScalar(value: unknown): boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  /**
   * Extract the typed JS value of a Literal relation target. Reconstructs the
   * literal from the relation's preserved `datatype` and `language` fields and
   * decodes via the canonical `Terms.decodeLiteral` helper, returning a number /
   * boolean / Date / string per the XSD datatype.
   */
  public static literalTarget(relation: SchemaGraphRelationInterface): unknown {
    if (relation.termType === 'Literal') {
      const rawValue = typeof relation.target === 'string' ? relation.target : relation.target.id;
      const literalTerm = Terms.literal(rawValue, {
        'datatype': Terms.iri(relation.datatype ?? ''),
        'language': relation.language ?? ''
      });

      return Terms.decodeLiteral(literalTerm);
    }

    return undefined;
  }

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
  public static negativePropertyAssertionInvariant(
    sourceIri: string,
    propertyIri: string,
    assertionValue: unknown
  ): InvariantType {
    const negativePropertyAssertionCheck = (value: unknown): null | string => {
      if (!DataType.isRecord(value)) {
        return null;
      }
      // Identity guard: an NPA binds one named individual, so enforce only when
      // the value declares it is that individual (see the convention above).
      const id = value['$id'] ?? value['@id'];

      if (id !== sourceIri) {
        return null;
      }
      const propertyValue = value[propertyIri];

      if (propertyValue === undefined) {
        return null;
      }
      const violation = `owl:NegativePropertyAssertion violation: <${sourceIri}> must not have <${propertyIri}> = ${JSON.stringify(assertionValue)}`;

      if (Array.isArray(propertyValue)) {
        return (propertyValue as unknown[]).includes(assertionValue) ? violation : null;
      }

      return propertyValue === assertionValue ? violation : null;
    };

    return {
      'fn': negativePropertyAssertionCheck,
      'name': `negativePropertyAssertion(${sourceIri},${propertyIri},${String(assertionValue)})`
    };
  }

  /**
   * Returns true when the relation's predicate matches any IRI in the set.
   */
  public static predicateIn(relation: SchemaGraphRelationInterface, set: ReadonlySet<string>): boolean {
    const result = set.has(relation.predicate);

    return result;
  }

  /**
   * Record `[iriA, iriB]` in `pairs` under a canonical (order-independent) key,
   * skipping if that logical pair has already been recorded. Shared by
   * owl:sameAs, owl:differentFrom, and owl:AllDifferent + distinctMembers,
   * which each emit unordered individual pairs that may appear in both
   * directions or across overlapping sources.
   */
  private static recordUniquePair(
    seen: Set<string>,
    pairs: Array<[string, string]>,
    iriA: string,
    iriB: string
  ): void {
    const pairKey = iriA < iriB ? `${iriA}\0${iriB}` : `${iriB}\0${iriA}`;

    if (seen.has(pairKey)) {
      return;
    }
    seen.add(pairKey);
    pairs.push([
      iriA,
      iriB
    ]);
  }

  /**
   * Returns true when the relation's target is a NamedNode IRI in the set.
   * Accepts both string and node-shape targets.
   */
  public static targetIriIn(relation: SchemaGraphRelationInterface, set: ReadonlySet<string>): boolean {
    if (relation.termType !== 'NamedNode') {
      return false;
    }

    const target = typeof relation.target === 'string' ? relation.target : relation.target.id;

    return set.has(target);
  }
}
