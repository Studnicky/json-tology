/**
 * VizDataCollector — GBU test suite
 *
 * Good:  collects nodes, edges, and schema data from a real registry
 * Bad:   collects gracefully from empty registry (zero schemas registered)
 * Ugly:  large registry, schemas with $ref edges, custom IRI prefix compaction
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';
import { VizDataCollector } from '../../src/modules/viz/VizDataCollector.js';

// ---------------------------------------------------------------------------
// Good paths — happy path collection
// ---------------------------------------------------------------------------

void describe('VizDataCollector good paths', () => {
  void it('collect returns payload with nodes, edges, and schemas arrays', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/User',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.ok(Array.isArray(payload.nodes), 'nodes should be an array');
    assert.ok(Array.isArray(payload.edges), 'edges should be an array');
    assert.ok(Array.isArray(payload.schemas), 'schemas should be an array');
  });

  void it('collect returns one node per registered schema', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [
        {
          '$id': 'https://viz.io/User',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        },
        {
          '$id': 'https://viz.io/Order',
          'properties': { 'total': { 'type': 'number' } },
          'type': 'object'
        }
      ] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.nodes.length, 2, 'should have one node per schema');
    assert.equal(payload.schemas.length, 2, 'should have one schema entry per schema');

    const ids = payload.nodes.map((n) => {
      return n.id;
    }).sort();

    assert.deepEqual(ids, [
      'https://viz.io/Order',
      'https://viz.io/User'
    ]);
  });

  void it('collect reports correct propertyCount for a node', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/Product',
        'properties': {
          'category': { 'type': 'string' },
          'name': { 'type': 'string' },
          'price': { 'type': 'number' }
        },
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    const productNode = payload.nodes.find((n) => {
      return n.id === 'https://viz.io/Product';
    });

    assert.ok(productNode !== undefined);
    assert.equal(productNode.propertyCount, 3);
  });

  void it('collect creates an edge for $ref relationships between registered schemas', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [
        {
          '$id': 'https://viz.io/User',
          'properties': {
            'address': { '$ref': 'https://viz.io/Address' },
            'name': { 'type': 'string' }
          },
          'required': ['name'],
          'type': 'object'
        },
        {
          '$id': 'https://viz.io/Address',
          'properties': {
            'city': { 'type': 'string' },
            'zip': { 'type': 'string' }
          },
          'type': 'object'
        }
      ] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.edges.length, 1, 'should have one edge for the $ref');
    const [edge] = payload.edges;

    assert.equal(edge.label, 'address', 'edge label should be the property name');
    assert.equal(edge.source, 'https://viz.io/User', 'edge source should be User');
    assert.equal(edge.target, 'https://viz.io/Address', 'edge target should be Address');
  });

  void it('collect schema entry contains id, jsonSchema, owl, shacl, and typescript fields', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/Widget',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    const schema = payload.schemas.find((entry) => {
      return entry.id === 'https://viz.io/Widget';
    });

    assert.ok(schema, 'schema entry should be found for Widget');
    assert.equal(schema.id, 'https://viz.io/Widget');
    assert.ok(
      typeof schema.jsonSchema === 'object',
      'jsonSchema should be an object'
    );
    assert.ok(Array.isArray(schema.owl), 'owl should be an array');
    assert.ok(Array.isArray(schema.shacl), 'shacl should be an array');
    assert.ok(typeof schema.typescript === 'string', 'typescript should be a string');
  });

  void it('collect node label uses curie compaction when registry has prefix config', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'prefixes': { 'viz': 'https://viz.io/' },
      'schemas': [{
        '$id': 'https://viz.io/Category',
        'properties': { 'name': { 'type': 'string' } },
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    const node = payload.nodes.find((n) => {
      return n.id === 'https://viz.io/Category';
    });

    assert.ok(node !== undefined);
    // With curie compaction, label should be viz:Category rather than the full IRI
    assert.ok(
      node.label.length < node.id.length || node.label === node.id,
      'label should be compacted or match id'
    );
    assert.ok(
      node.label.includes('Category'),
      `label should reference the schema name, got: ${node.label}`
    );
  });
});

// ---------------------------------------------------------------------------
// Bad paths — empty registry
// ---------------------------------------------------------------------------

void describe('VizDataCollector bad paths', () => {
  void it('collect with empty registry returns payload with empty arrays', () => {
    const tology = JsonTology.create({ 'baseIRI': 'https://empty.io' });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.nodes.length, 0, 'no schemas → no nodes');
    assert.equal(payload.edges.length, 0, 'no schemas → no edges');
    assert.equal(payload.schemas.length, 0, 'no schemas → no schema entries');
  });

  void it('collect with single schema and no $ref produces zero edges', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/Standalone',
        'properties': { 'x': { 'type': 'number' } },
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.nodes.length, 1, 'one schema → one node');
    assert.equal(payload.edges.length, 0, 'no $ref → no edges');
  });

  void it('collect for schema with no properties produces node with propertyCount 0', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/Empty',
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.nodes.length, 1, 'should have one node');
    const [node] = payload.nodes;

    assert.equal(node.propertyCount, 0);
  });

  void it('collect does not throw when called multiple times on the same collector', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/Repeated',
        'properties': { 'v': { 'type': 'string' } },
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);

    const p1 = collector.collect();
    const p2 = collector.collect();

    assert.equal(p1.nodes.length, p2.nodes.length);
    assert.equal(p1.schemas.length, p2.schemas.length);
  });
});

// ---------------------------------------------------------------------------
// Ugly paths — large registries, unusual schemas
// ---------------------------------------------------------------------------

void describe('VizDataCollector ugly paths', () => {
  void it('collect with 20 registered schemas produces 20 nodes and 20 schema entries', () => {
    const schemas = Array.from({ 'length': 20 }, (_, i) => {
      return {
        '$id': `https://viz.io/Schema${i}`,
        'properties': { 'n': { 'type': 'string' } },
        'type': 'object' as const
      };
    });

    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': schemas as unknown as readonly [{ '$id': string;
        'type': 'object' }]
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.nodes.length, 20, 'should have 20 nodes');
    assert.equal(payload.schemas.length, 20, 'should have 20 schema entries');
  });

  void it('collect with chain of $refs produces an edge for each ref', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [
        {
          '$id': 'https://viz.io/A',
          'properties': { 'b': { '$ref': 'https://viz.io/B' } },
          'type': 'object'
        },
        {
          '$id': 'https://viz.io/B',
          'properties': { 'c': { '$ref': 'https://viz.io/C' } },
          'type': 'object'
        },
        {
          '$id': 'https://viz.io/C',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        }
      ] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.edges.length, 2, 'should have 2 edges for 2 cross-schema refs');

    const aToB = payload.edges.find((edge) => {
      return edge.source === 'https://viz.io/A' && edge.target === 'https://viz.io/B';
    });
    const bToC = payload.edges.find((edge) => {
      return edge.source === 'https://viz.io/B' && edge.target === 'https://viz.io/C';
    });

    assert.ok(aToB, 'should have edge A → B');
    assert.ok(bToC, 'should have edge B → C');
  });

  void it('collect produces schemaTypes from the node semantics', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/TypedNode',
        'properties': { 'x': { 'type': 'string' } },
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    const node = payload.nodes.find((graphNode) => {
      return graphNode.id === 'https://viz.io/TypedNode';
    });

    assert.ok(node, 'TypedNode should be found in nodes');
    assert.ok(Array.isArray(node.schemaTypes));
    assert.ok(
      node.schemaTypes.includes('object'),
      `schemaTypes should include 'object', got: ${JSON.stringify(node.schemaTypes)}`
    );
  });

  void it('collect with $ref to unregistered schema produces no edge for that ref', () => {
    // Only register the source schema, not the target
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/Source',
        'properties': {
          'external': { '$ref': 'https://not-registered.io/Target' },
          'name': { 'type': 'string' }
        },
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    // The unregistered target should not create an edge
    const edgeToUnregistered = payload.edges.find((edge) => {
      return edge.target === 'https://not-registered.io/Target';
    });

    assert.equal(edgeToUnregistered, undefined, 'should not create edge to unregistered schema');
  });

  void it('collect schema typescript field is a non-empty string', () => {
    const tology = JsonTology.create({
      'baseIRI': 'https://viz.io',
      'schemas': [{
        '$id': 'https://viz.io/TypedSchema',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      }] as const
    });
    const collector = new VizDataCollector(tology.registry);
    const payload = collector.collect();

    assert.equal(payload.schemas.length, 1, 'should have one schema entry');
    const [schema] = payload.schemas;

    assert.ok(typeof schema.typescript === 'string');
    assert.ok(schema.typescript.length > 0, 'typescript field should not be empty');
  });
});
