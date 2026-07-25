/**
 * AboxGraph type aliases — index structures for the typed ABox graph cursor.
 */

import type { InferType } from './Schema.js';

/** Lifts a resource IRI to its typed JS instance (memoised by the owning graph). */
export type AboxLiftFunctionType = (iri: string) => unknown;

/** A (predicate IRI, object IRI-or-literal-value) pair stored in the bySubject index. */
export const AboxPredicateObjectTypeSchema = {
  'properties': {
    'object': { 'type': 'string' },
    'objectTermType': {
      'enum': [
        'BlankNode',
        'Literal',
        'NamedNode'
      ]
    },
    'predicate': { 'type': 'string' }
  },
  'required': [
    'object',
    'objectTermType',
    'predicate'
  ],
  'type': 'object'
} as const;

export type AboxPredicateObjectType = InferType<typeof AboxPredicateObjectTypeSchema>;

/** A (predicate IRI, subject IRI) pair stored in the byObject index. */
export const AboxPredicateSubjectTypeSchema = {
  'properties': {
    'predicate': { 'type': 'string' },
    'subject': { 'type': 'string' }
  },
  'required': [
    'predicate',
    'subject'
  ],
  'type': 'object'
} as const;

export type AboxPredicateSubjectType = InferType<typeof AboxPredicateSubjectTypeSchema>;

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
export const AboxIdentityDescriptorTypeSchema = {
  'properties': {
    'owningClass': { 'type': 'string' },
    'predicate': { 'type': 'string' },
    'range': { 'type': 'string' }
  },
  'required': [
    'owningClass',
    'predicate',
    'range'
  ],
  'type': 'object'
} as const;

export type AboxIdentityDescriptorType = InferType<typeof AboxIdentityDescriptorTypeSchema>;
