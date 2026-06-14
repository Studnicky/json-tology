/**
 * AboxGraph type aliases — index structures for the typed ABox graph cursor.
 */

/** Lifts a resource IRI to its typed JS instance (memoised by the owning graph). */
export type AboxLiftFnType = (iri: string) => unknown;

/** A (predicate IRI, object IRI-or-literal-value) pair stored in the bySubject index. */
export type AboxPredicateObjectType = {
  readonly 'object': string;
  /** termType of the original quad object — Literal or NamedNode */
  readonly 'objectTermType': 'BlankNode' | 'Literal' | 'NamedNode';
  readonly 'predicate': string;
};

/** A (predicate IRI, subject IRI) pair stored in the byObject index. */
export type AboxPredicateSubjectType = {
  readonly 'predicate': string;
  readonly 'subject': string;
};

/**
 * Describes the inverse-functional identity of a class: which class owns the
 * identity, which predicate uniquely identifies its instances, and which range
 * primitive carries that identity value.
 *
 * Derived from the canonical schema graph (the property node whose semantics
 * are `inverseFunctional`), so the owning class is unambiguous even when the
 * flat predicate is shared by foreign-key holders (`Order.customerId`,
 * `Review.customerId`) whose declarations are not inverse-functional.
 */
export type AboxIdentityDescriptorType = {
  /** Class IRI that owns this identity (the inverse-functional property's domain). */
  readonly 'owningClass': string;
  /** Canonical predicate IRI of the identity property (e.g. the full IRI for `customerId`). */
  readonly 'predicate': string;
  /** Range primitive IRI (the identity datatype's schema `$id`, e.g. `urn:bookstore:CustomerId`). */
  readonly 'range': string;
};
