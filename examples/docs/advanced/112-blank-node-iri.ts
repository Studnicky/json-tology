/**
 * Advanced Example 112 — BLANK_NODE_IRI_FOR: anonymous blank-node subjects
 *
 * By default `toQuads()` mints well-known genid IRIs
 * (`https://…/.well-known/genid/…`) as subjects for every projected object.
 * Passing `{ iriFor: BLANK_NODE_IRI_FOR }` replaces those IRIs with
 * anonymous blank nodes (`_:b0`, `_:b1`, …) so no persistent identity is
 * embedded in the quad set.
 *
 * This is useful when the quads are transient (e.g. SHACL validation input)
 * and no persistent IRI identity is needed or desired.
 *
 * `BLANK_NODE_IRI_FOR` is the exported string constant `'blank-node'`.
 * Passing it as `iriFor` activates the blank-node skolemization strategy
 * inside `toQuads`.
 */

import {
  BLANK_NODE_IRI_FOR, JsonTology
} from '../../../src/index.js';

// ── Schema ────────────────────────────────────────────────────────────────

const AddressSchema = {
  '$id': 'https://bookstore.example/Address',
  'properties': {
    'city': { 'type': 'string' },
    'country': { 'type': 'string' }
  },
  'required': [
    'city',
    'country'
  ],
  'type': 'object'
} as const;

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [AddressSchema] as const
});

const instance = {
  'city': 'Berlin',
  'country': 'DE'
};

// ── Default: genid NamedNode subjects ─────────────────────────────────────
const defaultQuads = jt.toQuads(AddressSchema, instance);
const defaultSubject = defaultQuads.at(0)?.subject;

console.assert(
  defaultSubject?.termType === 'NamedNode',
  'default: subject is a NamedNode (well-known genid IRI)'
);
console.log('Default subject termType:', defaultSubject?.termType);
console.log('Default subject value:   ', defaultSubject?.value);

// ── Blank-node strategy ────────────────────────────────────────────────────
const blankQuads = jt.toQuads(AddressSchema, instance, { 'iriFor': BLANK_NODE_IRI_FOR });

// Every subject in the blank-node quad set is a BlankNode.
const nonBlankSubjects = blankQuads.filter((quad) => {
  return quad.subject.termType !== 'BlankNode';
});

console.assert(
  nonBlankSubjects.length === 0,
  'blank-node: all subjects are BlankNode terms'
);
console.assert(
  blankQuads.length > 0,
  'blank-node: quads were emitted'
);

const blankSubject = blankQuads.at(0)?.subject;

console.log('\nBlank-node subject termType:', blankSubject?.termType);
console.log('Blank-node subject value:   ', blankSubject?.value);

console.log('\nBlank-node quad set:');
for (const quad of blankQuads) {
  console.log(
    ' ',
    quad.subject.value,
    quad.predicate.value,
    quad.object.value
  );
}

// ── BLANK_NODE_IRI_FOR constant value ─────────────────────────────────────
// The constant is the literal string 'blank-node'. Log it so the value is
// visible in the example output — the tautological compile-time assertion
// is omitted per the no-unnecessary-condition rule.
console.log('\nBLANK_NODE_IRI_FOR constant:', BLANK_NODE_IRI_FOR);
