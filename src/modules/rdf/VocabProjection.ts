/**
 * VocabProjection -- abstract base class for vocabulary-specific quad emission.
 *
 * Owns the shared iteration and metadata extraction for dependentRequired,
 * dependentSchemas, and conditionals. Subclasses override abstract hooks
 * for OWL or SHACL quad patterns.
 *
 * Template methods return QuadObjectType[] -- the caller decides how to
 * attach them (OWL: rdfs:subClassOf, SHACL: push to andItems).
 */

import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { CurieInterface } from '../../interfaces/CurieInterface.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndexInterface.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import type { PredicateResolverInterface } from '../../interfaces/PredicateResolverInterface.js';
import type { SchemaGraphInterface } from '../../interfaces/SchemaGraphInterface.js';
import { JT } from '../../constants/IRI.js';
import { PropertyProjection } from './PropertyProjection.js';

/**
 * Abstract base class for vocabulary-specific RDF quad emission.
 *
 * @remarks
 * Owns the shared iteration and metadata extraction for `dependentRequired`,
 * `dependentSchemas`, and `if/then/else` conditionals. Subclasses override
 * the abstract template methods to emit OWL or SHACL quad patterns.
 *
 * Template methods return `QuadObjectType[]` — the caller decides how to
 * attach them (OWL: `rdfs:subClassOf`; SHACL: push to `andItems`).
 *
 * @example
 * ```ts
 * class MyProjection extends VocabProjection {
 *   combineUnionBranches(...) { ... }
 *   // ... implement remaining abstract methods
 * }
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link QuadFactory}
 * @group VocabProjection
 */
export abstract class VocabProjection {
  /**
   * Combine the "without trigger" branch with required-property restrictions.
   * OWL: union of [withoutTrigger, intersection-of-restrictions] or single.
   * SHACL: sh:or of [withoutWrapper, reqBnode].
   */
  abstract combineUnionBranches(
    withoutTrigger: QuadObjectType,
    reqRestrictions: QuadObjectType[],
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType;

  /**
   * Emit the "else" branch of a conditional (if/else).
   * OWL: owl:intersectionOf(complementOf(if), else) wrapped in a Class bnode.
   * SHACL: sh:or([if, else]) bnode.
   */
  abstract emitConditionalElseBranch(
    ifReference: string,
    elseReference: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType;

  emitConditionals(
    entry: RelationIndexInterface,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType[] {
    const results: QuadObjectType[] = [];

    for (const rel of entry.all) {
      if (rel.structure?.kind !== 'conditional') {
        continue;
      }

      const conditionalStructure = rel.structure;
      const ifReference = conditionalStructure.ifReference;
      const elseReference = conditionalStructure.elseReference;
      const thenReference = conditionalStructure.thenReference;

      if (thenReference?.includes('/dependentSchemas/') === true) {
        continue;
      }

      const branches: QuadObjectType[] = [];

      if (thenReference !== undefined) {
        branches.push(this.emitConditionalThenBranch(ifReference, thenReference, quads, curie, issuer));
      }

      if (elseReference !== undefined) {
        branches.push(this.emitConditionalElseBranch(ifReference, elseReference, quads, curie, issuer));
      }

      if (branches.length > 0) {
        results.push(...this.wrapConditionalBranches(branches, quads, curie, issuer));
      }
    }

    return results;
  }

  /**
   * Emit the "then" branch of a conditional (if/then).
   * OWL: owl:intersectionOf(if, then) wrapped in a Class bnode.
   * SHACL: sh:or([sh:not(if), then]) bnode.
   */
  abstract emitConditionalThenBranch(
    ifReference: string,
    thenReference: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType;

  emitDependentRequired(
    subject: string,
    entry: RelationIndexInterface,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    options?: { 'graph'?: SchemaGraphInterface | undefined;
      'issuer'?: IdentifierIssuerInterface | undefined;
      'predicateResolver'?: PredicateResolverInterface | undefined }
  ): QuadObjectType[] {
    const {
      graph, issuer, predicateResolver
    } = options ?? {};
    const results: QuadObjectType[] = [];
    const depReqRels = entry.byPredicate.get(JT.dependentRequired) ?? [];

    for (const rel of depReqRels) {
      const meta = rel.metadata ?? {};
      const trigger = typeof meta.trigger === 'string' ? meta.trigger : '';
      const required = Array.isArray(meta.required) ? (meta.required as string[]) : [];

      const triggerPropIri = this.resolvePredicateIri(subject, trigger, graph, predicateResolver);
      const withoutTrigger = this.emitNotTriggerBranch(triggerPropIri, quads, curie, issuer);

      const reqRestrictions: QuadObjectType[] = required.map((reqProp: string): QuadObjectType => {
        const reqPropIri = this.resolvePredicateIri(subject, reqProp, graph, predicateResolver);

        return this.emitRequiredPropertyBranch(reqPropIri, quads, curie, issuer);
      });

      results.push(this.combineUnionBranches(withoutTrigger, reqRestrictions, quads, curie, issuer));
    }

    return results;
  }

  /**
   * Emit a dependent-schema implication (triggerProp present => schema applies).
   * OWL: union of complement-of-restriction and schema ref.
   * SHACL: sh:or of not-property-present and node shape with properties.
   */
  abstract emitDependentSchemaBranch(
    subject: string,
    ifReference: string,
    thenReference: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType;

  emitDependentSchemas(
    subject: string,
    entry: RelationIndexInterface,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType[] {
    const results: QuadObjectType[] = [];

    for (const rel of entry.all) {
      if (rel.structure?.kind !== 'conditional') {
        continue;
      }

      const conditionalStructure = rel.structure;
      const ifReference = conditionalStructure.ifReference;
      const thenReference = conditionalStructure.thenReference;

      if (thenReference?.includes('/dependentSchemas/') !== true) {
        continue;
      }

      results.push(this.emitDependentSchemaBranch(subject, ifReference, thenReference, quads, curie, issuer));
    }

    return results;
  }

  /**
   * Emit the "trigger property absent" branch for dependentRequired / dependentSchemas.
   * OWL: owl:complementOf on an owl:Restriction with minCardinality 1.
   * SHACL: sh:not wrapping a PropertyShape with minCount 1.
   */
  abstract emitNotTriggerBranch(
    triggerPropIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType;

  /**
   * Emit a single required-property restriction.
   * OWL: owl:Restriction with minCardinality 1.
   * SHACL: sh:PropertyShape with minCount 1.
   */
  abstract emitRequiredPropertyBranch(
    propIri: string,
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType;

  /**
   * Resolve the flat property IRI for a given property name on `subject`.
   *
   * When `predicateResolver` is available (OWL/SHACL projection with
   * canonical-predicate mode), delegates to the resolver so that flat
   * base-IRI predicates (e.g. `https://bookstore.example/customerId`) are
   * emitted instead of class-scoped `<ClassIri>#<propName>` IRIs.
   * Falls back to the class-scoped form when no resolver is supplied.
   */
  protected resolvePredicateIri(
    subject: string,
    propertyName: string,
    graph: SchemaGraphInterface | undefined,
    predicateResolver: PredicateResolverInterface | undefined
  ): string {
    const result = PropertyProjection.resolvePredicateForClass(graph, subject, propertyName, predicateResolver);

    return result;
  }

  /**
   * Wrap collected then+else branches for a single conditional.
   * OWL: wraps in owl:unionOf (returns 1 item).
   * SHACL: returns branches as-is (multiple items).
   */
  abstract wrapConditionalBranches(
    branches: QuadObjectType[],
    quads: QuadInterface[],
    curie: CurieInterface | undefined,
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType[];
}
