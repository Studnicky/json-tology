/**
 * Regression tests for EffectiveProperties not walking anyOf/oneOf members.
 *
 * Before the fix, walkEffectiveProperties only recursed into sem.allOf,
 * sem.thenNode, and sem.elseNode. Properties declared only inside an anyOf
 * or oneOf member were invisible to materialization and ABox projection.
 *
 * After the fix, anyOf and oneOf members are walked using the same visited-set
 * pattern as allOf, so union-member properties appear in the collected map.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { EffectiveProperties } from '../../src/modules/graph/EffectiveProperties.js';

void describe('collectEffectiveProperties — anyOf/oneOf members', { 'concurrency': false }, () => {
  void it('collects properties from anyOf members', () => {
    const schema = {
      '$id': 'https://example.com/AnyOfProps',
      'anyOf': [
        {
          'properties': { 'anyA': { 'type': 'string' } },
          'type': 'object'
        },
        {
          'properties': { 'anyB': { 'type': 'number' } },
          'type': 'object'
        }
      ],
      'properties': { 'base': { 'type': 'string' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const map = EffectiveProperties.collect(graph, graph.rootNode);

    const names = new Set([...map.keys()].sort());

    assert.ok(names.has('base'), 'should include own property');
    assert.ok(names.has('anyA'), 'should include anyOf[0] property');
    assert.ok(names.has('anyB'), 'should include anyOf[1] property');
  });

  void it('collects properties from oneOf members', () => {
    const schema = {
      '$id': 'https://example.com/OneOfProps',
      'oneOf': [
        {
          'properties': { 'cat': { 'type': 'string' } },
          'type': 'object'
        },
        {
          'properties': { 'dog': { 'type': 'string' } },
          'type': 'object'
        }
      ],
      'properties': { 'animal': { 'type': 'string' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const map = EffectiveProperties.collect(graph, graph.rootNode);

    const names = new Set([...map.keys()].sort());

    assert.ok(names.has('animal'), 'should include own property');
    assert.ok(names.has('cat'), 'should include oneOf[0] property');
    assert.ok(names.has('dog'), 'should include oneOf[1] property');
  });

  void it('first-declaration-wins: own properties shadow anyOf members', () => {
    const schema = {
      '$id': 'https://example.com/ShadowAnyOf',
      'anyOf': [{
        'properties': { 'name': { 'type': 'number' } },
        'type': 'object'
      }],
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const map = EffectiveProperties.collect(graph, graph.rootNode);

    assert.equal(map.size, 1, 'only one property named "name" should be in the map');
    const entry = map.get('name');

    assert.ok(entry !== undefined);
    // The own declaration (string) should win.
    const sem = entry.graph.semantics(entry.node);

    assert.ok(sem.schemaTypes.includes('string'), 'own string declaration should win over anyOf number');
  });

  void it('is cycle-safe for anyOf self-reference', () => {
    // Schema with anyOf member that is a $ref to itself — should not recurse infinitely.
    const schema = {
      '$id': 'https://example.com/AnyOfCycle',
      'anyOf': [{ '$ref': 'https://example.com/AnyOfCycle' }],
      'properties': { 'value': { 'type': 'string' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const resolveGraph = (_refId: string): typeof graph => {
      return graph;
    };

    // Should complete without infinite recursion
    const map = EffectiveProperties.collect(graph, graph.rootNode, resolveGraph);

    assert.ok(map.has('value'), 'own property should still be collected despite cycle');
  });
});
