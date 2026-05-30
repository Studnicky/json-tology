/**
 * AboxGraph — a lazy, typed, in-memory graph view over projected ABox quads
 * unioned with the registry's TBox quads.
 *
 * The graph indexes the quad union once on construction, then exposes two
 * entry points (`resource`, `instances`) that return a fluent {@link Cursor}.
 * Navigation steps (`objects`, `subjects`) are lazy and immutable: each returns
 * a NEW cursor over the resulting IRI set. Terminals (`one`, `all`, `iris`, …)
 * lift each IRI to its typed JS instance via `fromQuads`.
 *
 * Associations are read directly from the TBox — no second semantic model:
 * - Object-property edges (`owl:ObjectProperty`) project as NamedNode objects
 *   and are followed directly.
 * - Inverse-functional identities (`owl:InverseFunctionalProperty` + domain +
 *   range) build a `value → owning-entity-IRI` index. A foreign-key literal
 *   (e.g. `Order.customerId`) is resolved to the `Customer` it identifies.
 *
 * TBox indexes expose schema-level navigation:
 * - `domainsOfPredicate` / `rangeOfPredicate` — rdfs:domain / rdfs:range per predicate.
 * - `superClassesOf` — rdfs:subClassOf per class.
 * - `predicatesOfClass` — inverse of domain (predicates whose domain is a class).
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { AboxGraphInterface } from '../../interfaces/AboxGraphInterface.js';
import type { CursorInterface } from '../../interfaces/CursorInterface.js';
import type { SchemaCursorInterface } from '../../interfaces/SchemaCursorInterface.js';
import type {
  AboxIdentityDescriptorType,
  AboxLiftFnType,
  AboxPredicateObjectType,
  AboxPredicateSubjectType
} from '../../types/AboxGraph.js';
import type { PredicateResolverFnType } from '../../types/PredicateResolverFn.js';

import {
  RDF, RDFS
} from '../../constants/IRI.js';
import { Cursor } from './Cursor.js';
import { SchemaCursor } from './SchemaCursor.js';
import { decodeLiteral } from '../rdf/Terms.js';

/**
 * Lifts a set of quads to typed instances of a single schema. Injected by
 * `JsonTology.aboxGraph` so the graph reuses the same `fromQuads` path the
 * facade exposes (predicate resolver, curie, validation via `instantiate`).
 */
export type AboxLiftSubjectFnType = (classId: string, quads: QuadInterface[]) => unknown[];

function isLiteralObject(termType: AboxPredicateObjectType['objectTermType']): boolean {
  return termType === 'Literal';
}

/**
 * Decode a quad object value to a comparable primitive. Literals decode via the
 * XSD datatype; NamedNode/BlankNode objects compare by IRI string.
 */
function quadObjectValue(quad: QuadInterface): unknown {
  if (quad.object.termType === 'Literal') {
    return decodeLiteral(quad.object);
  }

  return quad.object.value;
}

export class AboxGraph implements AboxGraphInterface {
  private readonly allQuads: QuadInterface[];
  private readonly byObject = new Map<string, AboxPredicateSubjectType[]>();
  private readonly bySubject = new Map<string, AboxPredicateObjectType[]>();
  /** predicate IRI → class IRIs that are its rdfs:domain */
  private readonly domainsOfPredicate = new Map<string, Set<string>>();
  /**
   * range-primitive IRI → (identity value → owning entity IRI). One entry per
   * primitive type that backs an inverse-functional identity, so a foreign-key
   * literal resolves to the entity that carries the same identity value.
   */
  private readonly entityByIdentity = new Map<string, Map<string, string>>();
  /** owning class IRI → its inverse-functional identity descriptor */
  private readonly identityOf = new Map<string, AboxIdentityDescriptorType>();
  /** identity predicate IRI → its range-primitive IRI (for FK resolution) */
  private readonly identityPredicateRange = new Map<string, string>();
  /** class IRI → instance subject IRIs */
  private readonly instancesByType = new Map<string, string[]>();

  private readonly liftCache = new Map<string, unknown>();
  private readonly liftSubject: AboxLiftSubjectFnType;
  private readonly predicateResolver: PredicateResolverFnType;
  /** class IRI → Set of predicate IRIs whose rdfs:domain includes that class */
  private readonly predicatesOfClass = new Map<string, Set<string>>();
  /** predicate IRI → class IRIs that are its rdfs:range */
  private readonly rangeOfPredicate = new Map<string, Set<string>>();
  /** Lifts a class IRI to its authored JSON Schema object. */
  private readonly schemaOf: (classIri: string) => unknown;
  /** class IRI → Set of direct superclass IRIs (rdfs:subClassOf) */
  private readonly superClassesOf = new Map<string, Set<string>>();
  /** subject IRI → its rdf:type class IRI(s) */
  private readonly typeOf = new Map<string, string[]>();

  /**
   * Build the graph indexes from the union of ABox quads and TBox quads.
   *
   * @param aboxQuads - Instance-data quads (from `toQuads` or any rdf/js source).
   * @param tboxQuads - Registry TBox quads (from `toTbox().quads()`).
   * @param identities - Inverse-functional identity descriptors derived from the
   *   canonical schema graph (owning class + identity predicate + range primitive).
   * @param liftSubject - Lifts a class's quads to typed instances (the facade's `fromQuads`).
   * @param predicateResolver - Resolves an authored property name to its predicate IRI.
   * @param schemaOf - Lifts a class IRI to its authored JSON Schema object.
   */
  public constructor(
    aboxQuads: readonly QuadInterface[],
    tboxQuads: readonly QuadInterface[],
    identities: readonly AboxIdentityDescriptorType[],
    liftSubject: AboxLiftSubjectFnType,
    predicateResolver: PredicateResolverFnType,
    schemaOf: (classIri: string) => unknown
  ) {
    this.liftSubject = liftSubject;
    this.predicateResolver = predicateResolver;
    this.schemaOf = schemaOf;
    this.allQuads = [
      ...aboxQuads,
      ...tboxQuads
    ];

    // `identities` is derived by JsonTology.aboxGraph from the registry schemas
    // (per-property `inverseFunctional`), NOT from the flat TBox — a flat
    // canonical predicate carries a union domain across every class that
    // declares it, so the TBox alone cannot tell which class the identity owns.
    this.indexIdentities(identities);
    this.indexAbox(aboxQuads);
    this.indexEntityIdentities(aboxQuads);
    this.indexTbox(tboxQuads);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Return a SchemaCursor seeded with the class IRI(s) that are the
   * `rdfs:range` of `predicateIri`.
   */
  public class(classIri: string): SchemaCursorInterface {
    return new SchemaCursor([classIri], this, this.schemaOf);
  }

  /**
   * Predicate IRIs whose `rdfs:domain` includes `classIri`. Used by
   * `SchemaCursor.properties()`.
   */
  public classProperties(classIri: string): string[] {
    return [...(this.predicatesOfClass.get(classIri) ?? [])];
  }

  /**
   * Direct (or transitive) superclass IRIs of `classIri` via `rdfs:subClassOf`.
   * Only NamedNode superclasses are returned (blank-node OWL restrictions are
   * excluded). When `transitive` is `false`, only the direct parents are returned.
   */
  public classSuperclasses(classIri: string, transitive: boolean): string[] {
    if (!transitive) {
      return [...(this.superClassesOf.get(classIri) ?? [])];
    }

    // BFS up the superclass chain, cycle-guarded.
    const visited = new Set<string>([classIri]);
    const queue = [classIri];
    const result = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined) {
        continue;
      }

      for (const superClass of this.superClassesOf.get(current) ?? []) {
        result.add(superClass);

        if (!visited.has(superClass)) {
          visited.add(superClass);
          queue.push(superClass);
        }
      }
    }

    return [...result];
  }

  /**
   * Collect the quad closure rooted at `rootIri`: the root's own quads plus the
   * quads of every NamedNode/BlankNode it references, transitively. This gives
   * `fromQuads` the nested-object quads it needs to reconstruct the instance.
   */
  private collectClosureQuads(rootIri: string): QuadInterface[] {
    const visited = new Set<string>();
    const collected: QuadInterface[] = [];
    const queue = [rootIri];

    while (queue.length > 0) {
      const current = queue.shift();

      if (current === undefined || visited.has(current)) {
        continue;
      }
      visited.add(current);

      for (const quad of this.allQuads) {
        if (quad.subject.value !== current) {
          continue;
        }
        collected.push(quad);

        if (
          (quad.object.termType === 'NamedNode' || quad.object.termType === 'BlankNode')
          && !visited.has(quad.object.value)
        ) {
          queue.push(quad.object.value);
        }
      }
    }

    return collected;
  }

  /**
   * The identity literal value carried by `entityIri`, if it owns one. Used by
   * inverse FK navigation to find the literal that references this entity.
   */
  private identityValueOf(entityIri: string): string | undefined {
    for (const type of this.typesOf(entityIri)) {
      const descriptor = this.identityOf.get(type);

      if (descriptor === undefined) {
        continue;
      }

      for (const quad of this.allQuads) {
        if (
          quad.subject.value === entityIri
          && quad.predicate.value === descriptor.predicate
          && quad.object.termType === 'Literal'
        ) {
          return quad.object.value;
        }
      }
    }

    return undefined;
  }

  /**
   * Index the ABox quads: bySubject, byObject, typeOf, instancesByType.
   */
  private indexAbox(aboxQuads: readonly QuadInterface[]): void {
    for (const quad of aboxQuads) {
      if (quad.subject.termType !== 'NamedNode' && quad.subject.termType !== 'BlankNode') {
        continue;
      }
      const subjectValue = quad.subject.value;
      const predicateValue = quad.predicate.value;

      if (predicateValue === RDF.type && quad.object.termType === 'NamedNode') {
        const types = this.typeOf.get(subjectValue) ?? [];

        types.push(quad.object.value);
        this.typeOf.set(subjectValue, types);

        const instances = this.instancesByType.get(quad.object.value) ?? [];

        instances.push(subjectValue);
        this.instancesByType.set(quad.object.value, instances);
        continue;
      }

      const objectTermType = quad.object.termType;

      if (objectTermType !== 'NamedNode' && objectTermType !== 'BlankNode' && objectTermType !== 'Literal') {
        continue;
      }

      const subjectEntries = this.bySubject.get(subjectValue) ?? [];

      subjectEntries.push({
        'object': quad.object.value,
        objectTermType,
        'predicate': predicateValue
      });
      this.bySubject.set(subjectValue, subjectEntries);

      if (objectTermType === 'NamedNode' || objectTermType === 'BlankNode') {
        const objectEntries = this.byObject.get(quad.object.value) ?? [];

        objectEntries.push({
          'predicate': predicateValue,
          'subject': subjectValue
        });
        this.byObject.set(quad.object.value, objectEntries);
      }
    }
  }

  /**
   * Build `entityByIdentity`: for every instance that carries an
   * inverse-functional identity literal, map (range primitive → identity value)
   * to that instance's IRI. This resolves a foreign-key literal back to the
   * entity it identifies.
   */
  private indexEntityIdentities(aboxQuads: readonly QuadInterface[]): void {
    for (const [
      subjectIri,
      types
    ] of this.typeOf) {
      for (const type of types) {
        const descriptor = this.identityOf.get(type);

        if (descriptor === undefined) {
          continue;
        }

        for (const quad of aboxQuads) {
          if (
            quad.subject.value === subjectIri
            && quad.predicate.value === descriptor.predicate
            && quad.object.termType === 'Literal'
          ) {
            const valueMap = this.entityByIdentity.get(descriptor.range) ?? new Map<string, string>();

            valueMap.set(quad.object.value, subjectIri);
            this.entityByIdentity.set(descriptor.range, valueMap);
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public navigation surface — consumed by Cursor and SchemaCursor
  // ---------------------------------------------------------------------------

  /**
   * Record the supplied identity descriptors: owning class → descriptor, and
   * identity predicate → range primitive (the key used to resolve a foreign-key
   * literal whose predicate's range is an identity primitive).
   *
   * The owning class is authoritative — derived from the schema graph property
   * whose semantics are `inverseFunctional` — so foreign-key holders that share
   * the same flat predicate (but are not themselves inverse-functional) never
   * masquerade as identity owners.
   */
  private indexIdentities(identities: readonly AboxIdentityDescriptorType[]): void {
    for (const descriptor of identities) {
      this.identityOf.set(descriptor.owningClass, descriptor);
      this.identityPredicateRange.set(descriptor.predicate, descriptor.range);
    }
  }

  /**
   * Index the TBox quads for schema-level navigation:
   * - rdfs:domain  → domainsOfPredicate, predicatesOfClass
   * - rdfs:range   → rangeOfPredicate
   * - rdfs:subClassOf → superClassesOf (NamedNode objects only; skips restrictions)
   */
  private indexTbox(tboxQuads: readonly QuadInterface[]): void {
    for (const quad of tboxQuads) {
      const predIri = quad.predicate.value;
      const subjectIri = quad.subject.value;
      const objectIri = quad.object.termType === 'NamedNode' ? quad.object.value : undefined;

      if (objectIri === undefined) {
        continue;
      }

      switch (predIri) {
        case RDFS.domain: {
        // subject = predicate IRI, object = class IRI
          const domains = this.domainsOfPredicate.get(subjectIri) ?? new Set<string>();

          domains.add(objectIri);
          this.domainsOfPredicate.set(subjectIri, domains);

          const preds = this.predicatesOfClass.get(objectIri) ?? new Set<string>();

          preds.add(subjectIri);
          this.predicatesOfClass.set(objectIri, preds);

          break;
        }
        case RDFS.range: {
        // subject = predicate IRI, object = class/datatype IRI
          const ranges = this.rangeOfPredicate.get(subjectIri) ?? new Set<string>();

          ranges.add(objectIri);
          this.rangeOfPredicate.set(subjectIri, ranges);

          break;
        }
        case RDFS.subClassOf: {
        // subject = subclass IRI, object = superclass IRI
        // Only record NamedNode superclasses (skip blank-node restrictions)
          const supers = this.superClassesOf.get(subjectIri) ?? new Set<string>();

          supers.add(objectIri);
          this.superClassesOf.set(subjectIri, supers);

          break;
        }
      // No default
      }
    }
  }

  public instances(classIri: string): CursorInterface {
    const seeds = this.instancesByType.get(classIri) ?? [];

    return new Cursor([...seeds], this, this.makeLift());
  }

  /**
   * Produce a memoised lift function: subject IRI → its typed JS instance.
   * Reads the IRI's rdf:type, gathers that subject's quads (plus the quads of
   * every NamedNode/BlankNode it transitively references so nested objects
   * reconstruct), and lifts via `fromQuads`-equivalent registry lifting.
   */
  private makeLift(): AboxLiftFnType {
    return (iri: string): unknown => {
      const cached = this.liftCache.get(iri);

      if (cached !== undefined) {
        return cached;
      }

      const types = this.typesOf(iri);

      if (types.length === 0) {
        // No known type — return the IRI itself so callers still get a value.
        this.liftCache.set(iri, iri);

        return iri;
      }

      const classId = types[0];
      const subjectQuads = this.collectClosureQuads(iri);
      const lifted = this.liftSubject(classId, subjectQuads);
      const instance = lifted.length > 0 ? lifted[0] : iri;

      this.liftCache.set(iri, instance);

      return instance;
    };
  }

  /**
   * All outgoing NamedNode/BlankNode neighbours of `iri` in the ABox (all
   * predicates). Used by `Cursor.subgraph` to expand to the N-hop neighbourhood.
   */
  public neighboursOf(iri: string): string[] {
    const entries = this.bySubject.get(iri);

    if (entries === undefined) {
      return [];
    }

    const result: string[] = [];

    for (const entry of entries) {
      if (entry.objectTermType === 'NamedNode' || entry.objectTermType === 'BlankNode') {
        result.push(entry.object);
      }
    }

    return result;
  }

  /**
   * Forward navigation: objects of `subjectIri` via `predicateIri`, with
   * inverse-functional foreign-key literals resolved to the owning entity IRI.
   */
  public objectsVia(subjectIri: string, predicateIri: string): string[] {
    const entries = this.bySubject.get(subjectIri);

    if (entries === undefined) {
      return [];
    }
    const results: string[] = [];
    const rangePrimitive = this.identityPredicateRange.get(predicateIri);

    for (const entry of entries) {
      if (entry.predicate !== predicateIri) {
        continue;
      }

      if (isLiteralObject(entry.objectTermType) && rangePrimitive !== undefined) {
        const owner = this.entityByIdentity.get(rangePrimitive)?.get(entry.object);

        results.push(owner ?? entry.object);
        continue;
      }

      results.push(entry.object);
    }

    return results;
  }

  /**
   * Return an object with `domain()` and `range()` accessors that each return a
   * `SchemaCursor` over the class IRIs in the respective TBox role for the resolved
   * predicate. The predicate token (authored name or full IRI) is resolved via
   * `resolvePredicate`.
   */
  public predicate(name: string): { domain(): SchemaCursorInterface;
    range(): SchemaCursorInterface } {
    const predicateIri = this.resolvePredicate(name);

    return {
      'domain': (): SchemaCursorInterface => {
        return new SchemaCursor([...(this.domainsOfPredicate.get(predicateIri) ?? [])], this, this.schemaOf);
      },
      'range': (): SchemaCursorInterface => {
        return new SchemaCursor([...(this.rangeOfPredicate.get(predicateIri) ?? [])], this, this.schemaOf);
      }
    };
  }

  /**
   * Predicate domain class IRIs for `predicateIri`. Used by schema-path navigation.
   */
  public predicateDomain(predicateIri: string): string[] {
    return [...(this.domainsOfPredicate.get(predicateIri) ?? [])];
  }

  /**
   * Predicate range class/datatype IRIs for `predicateIri`. Used by schema-path navigation.
   */
  public predicateRange(predicateIri: string): string[] {
    return [...(this.rangeOfPredicate.get(predicateIri) ?? [])];
  }

  /**
   * Resolve a predicate token (authored property name OR full IRI) to its
   * canonical predicate IRI. A token that is already a full IRI (has a scheme)
   * passes through; a bare name resolves through the predicate resolver.
   */
  public resolvePredicate(token: string): string {
    if (token.includes('://') || token.startsWith('urn:') || token.startsWith('_:')) {
      return token;
    }

    // The resolver keys off classId + property name; for the flat canonical
    // predicate strategy the classId is irrelevant to the produced IRI, so a
    // placeholder classId is sufficient to obtain the property's predicate IRI.
    return this.predicateResolver({
      'classId': '',
      'propertyName': token,
      'propertySchema': {}
    });
  }

  public resource(iri: string): CursorInterface {
    return new Cursor([iri], this, this.makeLift());
  }

  /**
   * Inverse navigation: subjects pointing at `objectIri` via `predicateIri`
   * (object-property edges) plus subjects whose identity foreign-key literal
   * resolves to `objectIri`.
   */
  public subjectsVia(objectIri: string, predicateIri: string): string[] {
    const results: string[] = [];

    const direct = this.byObject.get(objectIri);

    if (direct !== undefined) {
      for (const entry of direct) {
        if (entry.predicate === predicateIri) {
          results.push(entry.subject);
        }
      }
    }

    // Inverse foreign-key: find the identity value(s) that `objectIri` carries,
    // then every subject whose literal value for `predicateIri` matches.
    const rangePrimitive = this.identityPredicateRange.get(predicateIri);

    if (rangePrimitive !== undefined) {
      const identityValue = this.identityValueOf(objectIri);

      if (identityValue !== undefined) {
        for (const quad of this.allQuads) {
          if (quad.predicate.value !== predicateIri) {
            continue;
          }
          if (quad.object.termType !== 'Literal') {
            continue;
          }
          // Skip the entity's own identity literal — it identifies, it does not
          // reference. Only foreign-key holders count as inverse subjects.
          if (
            quad.object.value === identityValue
            && quad.subject.termType === 'NamedNode'
            && quad.subject.value !== objectIri
          ) {
            results.push(quad.subject.value);
          }
        }
      }
    }

    return results;
  }

  /**
   * The rdf:type class IRI(s) recorded for `iri`, or an empty array.
   */
  public typesOf(iri: string): string[] {
    return this.typeOf.get(iri) ?? [];
  }

  /**
   * The object value(s) of `subjectIri` for `predicateIri`, decoded (literals
   * via their datatype, NamedNode/BlankNode as the IRI string). Used by
   * `.having` for value comparison.
   */
  public valuesVia(subjectIri: string, predicateIri: string): unknown[] {
    const values: unknown[] = [];

    for (const quad of this.allQuads) {
      if (quad.subject.value !== subjectIri || quad.predicate.value !== predicateIri) {
        continue;
      }
      values.push(quadObjectValue(quad));
    }

    return values;
  }
}
