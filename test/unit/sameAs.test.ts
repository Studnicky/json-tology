import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import { SameAsStore } from '../../src/modules/registry/SameAsStore.js';

const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs';

const PersonSchema = {
  '$id': 'urn:example:PersonForSameAs',
  'properties': {
    'id': { 'type': 'string' },
    'name': { 'type': 'string' }
  },
  'required': ['id'],
  'type': 'object'
} as const;

void describe('SameAsStore — Good/Bad/Ugly', () => {
  void it('records distinct pairs, idempotence, self-pair drop, and clear', () => {
    // Good: records distinct pairs
    const store = new SameAsStore();

    store.add('urn:a', 'urn:b');
    store.add('urn:c', 'urn:d');
    assert.equal(store.all().length, 2);

    // Bad: idempotent for repeats in either direction
    const store2 = new SameAsStore();

    store2.add('urn:a', 'urn:b');
    store2.add('urn:a', 'urn:b');
    store2.add('urn:b', 'urn:a');
    assert.equal(store2.all().length, 1);

    // Ugly: drops self-pairs
    const store3 = new SameAsStore();

    store3.add('urn:a', 'urn:a');
    assert.equal(store3.all().length, 0);

    // clear empties the store
    const store4 = new SameAsStore();

    store4.add('urn:a', 'urn:b');
    store4.clear();
    assert.equal(store4.all().length, 0);
  });
});

void describe('JsonTology.sameAs() — Good/Bad/Ugly', () => {
  void it('records assertions, emits symmetric quads, handles graphIRI, no quads without assertions', () => {
    // Good: records single assertion, emits symmetric quad pair
    const jt = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });

    jt.sameAs('urn:example:alice', 'urn:example:alice2');
    assert.equal(jt.registry.sameAsStore.all().length, 1);

    const quads = jt.toQuads(PersonSchema, {
      'id': 'a1',
      'name': 'Alice'
    }, { 'iriFor': 'urn:example:alice' });
    const sameAsQuads = quads.filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(sameAsQuads.length, 2, 'symmetric pair emitted');
    const forward = sameAsQuads.find((quad) => {
      return quad.subject === 'urn:example:alice' && quad.object.value === 'urn:example:alice2';
    });
    const reverse = sameAsQuads.find((quad) => {
      return quad.subject === 'urn:example:alice2' && quad.object.value === 'urn:example:alice';
    });

    assert.notEqual(forward, undefined, 'forward quad present');
    assert.notEqual(reverse, undefined, 'reverse quad present');

    // Bad: no sameAs quads when no assertions recorded
    const jt2 = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });
    const noSameAsQuads = jt2.toQuads(PersonSchema, { 'id': 'a1' }).filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(noSameAsQuads.length, 0);

    // Ugly: multiple distinct assertions → 4 quads (two pairs, symmetric)
    const jt3 = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });

    jt3.sameAs('urn:a', 'urn:b');
    jt3.sameAs('urn:c', 'urn:d');
    assert.equal(jt3.registry.sameAsStore.all().length, 2);
    const multiQuads = jt3.toQuads(PersonSchema, { 'id': 'a1' }).filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(multiQuads.length, 4, 'two pairs, symmetric → 4 quads');

    // graphIRI stamping on sameAs quads
    const jt4 = JsonTology.create({
      'baseIRI': 'urn:example',
      'schemas': [PersonSchema] as const
    });

    jt4.sameAs('urn:a', 'urn:b');
    const graphQuads = jt4.toQuads(PersonSchema, { 'id': 'x1' }, {
      'graphIRI': 'urn:example:graph1',
      'iriFor': 'urn:example:x'
    }).filter((quad) => {
      return quad.predicate === OWL_SAME_AS;
    });

    assert.equal(graphQuads.length, 2);
    for (const quad of graphQuads) {
      assert.equal(quad.graph, 'urn:example:graph1');
    }
  });
});
