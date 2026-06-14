import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  collectEffectiveProperties,
  collectEffectivePropertiesMemo
} from '../../src/modules/graph/EffectiveProperties.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import type { SchemaGraphNodeType } from '../../src/types/SchemaGraph.js';
import type { EffectivePropertyMapType } from '../../src/types/EffectivePropertyMapType.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a SchemaGraph and return both the graph and its root node. */
function buildGraph(schema: Record<string, unknown>): ReturnType<InstanceType<typeof SchemaGraph>['semantics']> extends never ? never : { 'graph': InstanceType<typeof SchemaGraph>;
  'root': InstanceType<typeof SchemaGraph>['rootNode'] } {
  const graph = new SchemaGraph(schema);

  return {
    graph,
    'root': graph.rootNode
  };
}

/** Return the set of property names from the effective map. */
function propertyNames(map: ReturnType<typeof collectEffectiveProperties>): string[] {
  return [...map.keys()].sort();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('collectEffectiveProperties', { 'concurrency': false }, () => {
  void it('returns own properties of a flat schema', () => {
    const {
      graph, root
    } = buildGraph({
      '$id': 'https://example.com/Book',
      'properties': {
        'isbn': { 'type': 'string' },
        'title': { 'type': 'string' }
      },
      'type': 'object'
    });
    const map = collectEffectiveProperties(graph, root);

    assert.deepEqual(propertyNames(map), [
      'isbn',
      'title'
    ]);
    for (const [
      , entry
    ] of map) {
      assert.strictEqual(entry.graph, graph);
    }
  });

  void it('collects properties from allOf members', () => {
    const {
      graph, root
    } = buildGraph({
      '$id': 'https://example.com/Child',
      'allOf': [{
        'properties': { 'inherited': { 'type': 'string' } },
        'type': 'object'
      }],
      'properties': { 'own': { 'type': 'number' } },
      'type': 'object'
    });
    const map = collectEffectiveProperties(graph, root);

    assert.deepEqual(propertyNames(map), [
      'inherited',
      'own'
    ]);
  });

  void it('first-declaration-wins — own properties shadow allOf members', () => {
    const {
      graph, root
    } = buildGraph({
      '$id': 'https://example.com/Override',
      'allOf': [{
        'properties': { 'name': { 'type': 'number' } },
        'type': 'object'
      }],
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });
    const map = collectEffectiveProperties(graph, root);

    assert.deepEqual(propertyNames(map), ['name']);
    // The own declaration (string type) wins — check the node's schema
    const entry = map.get('name');

    assert.ok(entry !== undefined);
    // The own properties block comes first; the node in the own properties
    // should be the one whose schema type is 'string'.
    const sem = entry.graph.semantics(entry.node);

    assert.ok(sem.schemaTypes.includes('string'), 'own string declaration should win');
  });

  void it('collects properties from thenNode and elseNode', () => {
    // Build the conditional schema from a JSON string to avoid unicorn/no-thenable —
    // the rule fires on any object literal (or assignment to a computed key) whose
    // resolved name is 'then'. JSON.parse is not a literal, so it is safe.

    const conditionalSchema = JSON.parse('{"$id":"https://example.com/Conditional","if":{"properties":{"flag":{"type":"boolean"}}},'
      + '"then":{"type":"object","properties":{"thenOnly":{"type":"string"}}},'
      + '"else":{"type":"object","properties":{"elseOnly":{"type":"string"}}},'
      + '"properties":{"base":{"type":"string"}},"type":"object"}') as Record<string, unknown>;
    const {
      graph, root
    } = buildGraph(conditionalSchema);
    const map = collectEffectiveProperties(graph, root);

    const names = propertyNames(map);

    assert.ok(names.includes('base'), 'should include own property');
    assert.ok(names.includes('thenOnly'), 'should include then branch property');
    assert.ok(names.includes('elseOnly'), 'should include else branch property');
  });

  void it('handles schema with no allOf, thenNode, or elseNode (just own properties)', () => {
    const {
      graph, root
    } = buildGraph({
      '$id': 'https://example.com/Simple',
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    });
    const map = collectEffectiveProperties(graph, root);

    assert.equal(map.size, 1);
    assert.ok(map.has('x'));
  });

  void it('is cycle-safe for self-referential schemas', () => {
    // A schema with $ref to itself in allOf would cause infinite recursion without cycle guard.
    // Build a simple graph and call with a resolver that returns the same graph — simulates
    // a cross-graph $ref cycle (parent $ref child, child $ref parent).
    const graph = new SchemaGraph({
      '$id': 'https://example.com/Node',
      'allOf': [{ '$ref': 'https://example.com/Node' }],
      'properties': { 'value': { 'type': 'string' } },
      'type': 'object'
    });
    const root = graph.rootNode;

    // resolveGraph returns the same graph for the ref — would cycle without the visited guard.
    const resolveGraph = (_refId: string): typeof graph => {
      return graph;
    };
    const map = collectEffectiveProperties(graph, root, resolveGraph);

    // Should complete and return 'value'
    assert.ok(map.has('value'), 'should still collect own properties despite cycle');
  });

  void it('cross-graph $ref via resolveGraph: descends into referenced graph', () => {
    // "Parent" graph: owns 'parentField'
    const parentGraph = new SchemaGraph({
      '$id': 'https://example.com/Parent',
      'properties': { 'parentField': { 'type': 'string' } },
      'type': 'object'
    });

    // "Child" graph: allOf member is a $ref to Parent
    const childGraph = new SchemaGraph({
      '$id': 'https://example.com/Child',
      'allOf': [{ '$ref': 'https://example.com/Parent' }],
      'properties': { 'childField': { 'type': 'number' } },
      'type': 'object'
    });
    const childRoot = childGraph.rootNode;

    const graphStore = new Map([[
      'https://example.com/Parent',
      parentGraph
    ]]);
    const resolveGraph = (refId: string): typeof parentGraph | undefined => {
      return graphStore.get(refId);
    };

    const map = collectEffectiveProperties(childGraph, childRoot, resolveGraph);

    assert.ok(map.has('childField'), 'own property should be present');
    assert.ok(map.has('parentField'), 'inherited cross-graph property should be present');
    const parentEntry = map.get('parentField');

    assert.ok(parentEntry !== undefined);
    assert.strictEqual(parentEntry.graph, parentGraph, 'entry graph should point to parent graph');
  });

  void it('cross-graph $ref without resolveGraph: skips cross-graph properties', () => {
    // Same setup as above but no resolveGraph provided — cross-graph refs are skipped.
    const childGraph = new SchemaGraph({
      '$id': 'https://example.com/Child2',
      'allOf': [{ '$ref': 'https://example.com/Parent2' }],
      'properties': { 'childField': { 'type': 'number' } },
      'type': 'object'
    });
    const childRoot = childGraph.rootNode;
    const map = collectEffectiveProperties(childGraph, childRoot);

    assert.ok(map.has('childField'), 'own property should still be present');
    assert.equal(map.size, 1, 'cross-graph ref without resolver yields only own properties');
  });

  void it('returns empty map for a schema with no properties', () => {
    const {
      graph, root
    } = buildGraph({
      '$id': 'https://example.com/Empty',
      'type': 'string'
    });
    const map = collectEffectiveProperties(graph, root);

    assert.equal(map.size, 0);
  });

  void it('collectEffectivePropertiesMemo caches results by node', () => {
    const {
      graph, root
    } = buildGraph({
      '$id': 'https://example.com/Memo',
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    });
    const cache = new WeakMap<SchemaGraphNodeType, EffectivePropertyMapType>();
    const result1 = collectEffectivePropertiesMemo(cache, graph, root);
    const result2 = collectEffectivePropertiesMemo(cache, graph, root);

    assert.strictEqual(result1, result2, 'second call should return cached object');
    assert.ok(result1.has('a'));
  });
});
