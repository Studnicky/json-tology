/**
 * Tests for Wave C graph-native tightenings:
 *  (a) rdfs:domain is an explicit edge recorded during lower() — verified via
 *      domainOf() and through relation extraction for non-standard pointer shapes.
 *  (b) Embedded-$id $ref resolution consumes the graph-owned index (embeddedNode()).
 */
import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { RDFS } from '../../src/constants/IRI.js';

// ---------------------------------------------------------------------------
// Task 1: explicit rdfs:domain edge
// ---------------------------------------------------------------------------

void describe('SchemaGraph — explicit domain edges', { 'concurrency': true }, () => {
  void it('domainOf returns the parent object node for a flat property', () => {
    const schema = {
      '$id': 'https://example.com/Person',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const nameNode = graph.resolvePointer('/properties/name');
    const domainNode = graph.domainOf(nameNode);

    assert.notStrictEqual(domainNode, undefined, 'domainOf should return a node for a property');
    assert.equal(domainNode?.id, 'https://example.com/Person', 'domain should be the root class');
  });

  void it('domainOf returns the allOf member node for a property nested inside allOf', () => {
    const schema = {
      '$id': 'https://example.com/Book',
      'allOf': [{
        'properties': { 'title': { 'type': 'string' } },
        'type': 'object'
      }],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const titleNode = graph.resolvePointer('/allOf/0/properties/title');
    const rawDomain = graph.domainOf(titleNode);

    // domainOf returns the direct parent (the allOf[0] node)
    assert.notStrictEqual(rawDomain, undefined, 'domainOf should return the allOf member node');
    assert.equal(rawDomain?.pointer, '/allOf/0', 'direct domain pointer is the allOf member');
  });

  void it('extractRelations climbs allOf to emit rdfs:domain targeting the root class', () => {
    const schema = {
      '$id': 'https://example.com/Book',
      'allOf': [{
        'properties': { 'title': { 'type': 'string' } },
        'type': 'object'
      }],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const titleNode = graph.resolvePointer('/allOf/0/properties/title');
    const domainRels = graph.relations(titleNode).filter((rel) => {
      return rel.predicate === RDFS.domain;
    });

    assert.equal(domainRels.length, 1, 'exactly one rdfs:domain relation');
    const domainRel0 = domainRels.at(0);

    if (domainRel0 === undefined) {
      throw new Error('expected domainRel at 0');
    }
    const target = domainRel0.target;

    // The target should be the root node (Book), not the allOf member
    assert.ok(
      typeof target === 'object' && (target as { 'id': string }).id === 'https://example.com/Book',
      `rdfs:domain target should be Book, got: ${JSON.stringify(typeof target === 'object' ? (target as { 'id': string }).id : target)}`
    );
  });

  void it('authored rdfs:domain takes precedence over the graph-inferred domain', () => {
    const schema = {
      '$id': 'https://example.com/Author',
      'properties': {
        'name': {
          'rdfs:domain': 'https://example.com/OverriddenDomain',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const nameNode = graph.resolvePointer('/properties/name');
    const domainRels = graph.relations(nameNode).filter((rel) => {
      return rel.predicate === RDFS.domain;
    });

    assert.equal(domainRels.length, 1, 'exactly one rdfs:domain relation (from authored)');
    const authoredDomainRel0 = domainRels.at(0);

    if (authoredDomainRel0 === undefined) {
      throw new Error('expected domainRel at 0');
    }
    assert.equal(authoredDomainRel0.target, 'https://example.com/OverriddenDomain', 'authored domain wins');
  });

  void it('domainOf returns undefined for a non-property node (root)', () => {
    const schema = {
      '$id': 'https://example.com/Thing',
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.domainOf(graph.rootNode), undefined);
  });

  void it('domainOf is consistent through fromNormIR round-trip', () => {
    const schema = {
      '$id': 'https://example.com/Round',
      'properties': { 'value': { 'type': 'string' } },
      'type': 'object'
    } as const;
    const original = new SchemaGraph(schema);
    const normIR = original.getNormIR();
    const restored = SchemaGraph.fromNormIR(normIR);

    const valueNode = restored.resolvePointer('/properties/value');
    const domainNode = restored.domainOf(valueNode);

    assert.notStrictEqual(domainNode, undefined, 'domainOf works after fromNormIR round-trip');
    assert.equal(domainNode?.id, 'https://example.com/Round');
  });
});

// ---------------------------------------------------------------------------
// Task 2: graph-owned embedded-$id index
// ---------------------------------------------------------------------------

void describe('SchemaGraph — embedded-$id index', { 'concurrency': true }, () => {
  void it('embeddedNode returns the node for a $defs entry with its own $id', () => {
    const schema = {
      '$defs': {
        'Address': {
          '$id': 'https://example.com/Address',
          'properties': { 'street': { 'type': 'string' } },
          'type': 'object'
        }
      },
      '$id': 'https://example.com/Person',
      'properties': { 'home': { '$ref': 'https://example.com/Address' } },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    const addressNode = graph.embeddedNode('https://example.com/Address');

    assert.notStrictEqual(addressNode, undefined, 'embeddedNode should find Address');

    if (addressNode === undefined) {
      throw new Error('unreachable');
    }
    assert.equal(addressNode.id, 'https://example.com/Address');
    assert.equal(addressNode.pointer, '/$defs/Address');
  });

  void it('embeddedNode returns undefined for an id not in the schema', () => {
    const schema = {
      '$id': 'https://example.com/Simple',
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.embeddedNode('https://example.com/Nonexistent'), undefined);
  });

  void it('embeddedNode returns undefined for the root $id (not indexed)', () => {
    const schema = {
      '$id': 'https://example.com/Root',
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    // The root schema's $id is NOT in the embedded index (pointer === '')
    assert.equal(graph.embeddedNode('https://example.com/Root'), undefined);
  });

  void it('embeddedNode is consistent through fromNormIR round-trip', () => {
    const schema = {
      '$defs': {
        'Tag': {
          '$id': 'https://example.com/Tag',
          'type': 'string'
        }
      },
      '$id': 'https://example.com/Article',
      'properties': { 'tag': { '$ref': 'https://example.com/Tag' } },
      'type': 'object'
    } as const;
    const original = new SchemaGraph(schema);
    const normIR = original.getNormIR();
    const restored = SchemaGraph.fromNormIR(normIR);

    const tagNode = restored.embeddedNode('https://example.com/Tag');

    assert.notStrictEqual(tagNode, undefined, 'embeddedNode works after fromNormIR round-trip');

    if (tagNode === undefined) {
      throw new Error('unreachable');
    }
    assert.equal(tagNode.id, 'https://example.com/Tag');
  });

  void it('GraphEngine resolves embedded-$id $ref through the graph-owned index', () => {
    const schema = {
      '$defs': {
        'Status': {
          '$id': 'https://example.com/Status',
          'enum': [
            'active',
            'inactive'
          ],
          'type': 'string'
        }
      },
      '$id': 'https://example.com/Item',
      'properties': { 'status': { '$ref': 'https://example.com/Status' } },
      'required': ['status'],
      'type': 'object'
    } as const;
    const registry = new SchemaRegistry({ 'enableStrictGraph': false });

    registry.set(schema);

    const validator = registry.validator(schema.$id);

    // Valid: status matches the embedded Status enum
    const valid = validator.validate({ 'status': 'active' }, { 'collectErrors': false });

    assert.equal(valid.valid, true, 'valid instance should pass');

    // Invalid: status does not match the enum
    const invalid = validator.validate({ 'status': 'unknown' }, { 'collectErrors': true });

    assert.equal(invalid.valid, false, 'invalid instance should fail');
    assert.ok(invalid.errors.length > 0, 'should have validation errors');
  });
});

// ---------------------------------------------------------------------------
// Step 1: embeddedNode coverage — all legal $id positions
// ---------------------------------------------------------------------------
// Every sub-schema position that can legally carry a $id must be node-ified by
// lower() and therefore indexed by rebuildEmbeddedIdMap. We verify each position
// independently so a future regression in lower() is caught with precision.

void describe('SchemaGraph.embeddedNode — $id coverage at all schema positions', { 'concurrency': true }, () => {
  void it('indexes $id in properties/*', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'properties': {
        'name': {
          '$id': 'https://x.test/NameProp',
          'type': 'string'
        }
      },
      'type': 'object'
    });
    const node = graph.embeddedNode('https://x.test/NameProp');

    assert.notStrictEqual(node, undefined, '$id in properties/* must be indexed');
    assert.equal(node?.pointer, '/properties/name');
  });

  void it('indexes $id in patternProperties/*', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'patternProperties': {
        '^x-': {
          '$id': 'https://x.test/ExtensionProp',
          'type': 'string'
        }
      }
    });
    const node = graph.embeddedNode('https://x.test/ExtensionProp');

    assert.notStrictEqual(node, undefined, '$id in patternProperties/* must be indexed');
    assert.equal(node?.pointer, '/patternProperties/^x-');
  });

  void it('indexes $id in additionalProperties', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'additionalProperties': {
        '$id': 'https://x.test/Extra',
        'type': 'integer'
      }
    });
    const node = graph.embeddedNode('https://x.test/Extra');

    assert.notStrictEqual(node, undefined, '$id in additionalProperties must be indexed');
    assert.equal(node?.pointer, '/additionalProperties');
  });

  void it('indexes $id in items', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'items': {
        '$id': 'https://x.test/Item',
        'type': 'string'
      },
      'type': 'array'
    });
    const node = graph.embeddedNode('https://x.test/Item');

    assert.notStrictEqual(node, undefined, '$id in items must be indexed');
    assert.equal(node?.pointer, '/items');
  });

  void it('indexes $id in prefixItems/*', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'prefixItems': [
        {
          '$id': 'https://x.test/First',
          'type': 'string'
        },
        {
          '$id': 'https://x.test/Second',
          'type': 'integer'
        }
      ]
    });

    assert.notStrictEqual(graph.embeddedNode('https://x.test/First'), undefined, '$id in prefixItems/0 must be indexed');
    assert.notStrictEqual(graph.embeddedNode('https://x.test/Second'), undefined, '$id in prefixItems/1 must be indexed');
    assert.equal(graph.embeddedNode('https://x.test/First')?.pointer, '/prefixItems/0');
    assert.equal(graph.embeddedNode('https://x.test/Second')?.pointer, '/prefixItems/1');
  });

  void it('indexes $id in $defs/*', () => {
    const graph = new SchemaGraph({
      '$defs': {
        'Color': {
          '$id': 'https://x.test/Color',
          'enum': [
            'red',
            'green',
            'blue'
          ]
        }
      },
      '$id': 'https://x.test/Root'
    });
    const node = graph.embeddedNode('https://x.test/Color');

    assert.notStrictEqual(node, undefined, '$id in $defs/* must be indexed');
    assert.equal(node?.pointer, '/$defs/Color');
  });

  void it('indexes $id in definitions/* (legacy)', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'definitions': {
        'Shape': {
          '$id': 'https://x.test/Shape',
          'type': 'string'
        }
      }
    });
    const node = graph.embeddedNode('https://x.test/Shape');

    assert.notStrictEqual(node, undefined, '$id in definitions/* (legacy) must be indexed');
    assert.equal(node?.pointer, '/definitions/Shape');
  });

  void it('indexes $id in allOf/*', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'allOf': [{
        '$id': 'https://x.test/AllOf0',
        'type': 'object'
      }]
    });
    const node = graph.embeddedNode('https://x.test/AllOf0');

    assert.notStrictEqual(node, undefined, '$id in allOf/* must be indexed');
    assert.equal(node?.pointer, '/allOf/0');
  });

  void it('indexes $id in anyOf/*', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'anyOf': [
        {
          '$id': 'https://x.test/AnyOf0',
          'type': 'string'
        },
        {
          '$id': 'https://x.test/AnyOf1',
          'type': 'number'
        }
      ]
    });

    assert.notStrictEqual(graph.embeddedNode('https://x.test/AnyOf0'), undefined, '$id in anyOf/0 must be indexed');
    assert.notStrictEqual(graph.embeddedNode('https://x.test/AnyOf1'), undefined, '$id in anyOf/1 must be indexed');
  });

  void it('indexes $id in oneOf/*', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'oneOf': [{
        '$id': 'https://x.test/OneOf0',
        'type': 'string'
      }]
    });
    const node = graph.embeddedNode('https://x.test/OneOf0');

    assert.notStrictEqual(node, undefined, '$id in oneOf/* must be indexed');
    assert.equal(node?.pointer, '/oneOf/0');
  });

  void it('indexes $id in if', () => {
    const schema = {
      '$id': 'https://x.test/Root',
      'if': {
        '$id': 'https://x.test/Condition',
        'type': 'string'
      },
      'then': { 'minLength': 1 }
    };
    const graph = new SchemaGraph(schema);
    const node = graph.embeddedNode('https://x.test/Condition');

    assert.notStrictEqual(node, undefined, '$id in if must be indexed');
    assert.equal(node?.pointer, '/if');
  });

  void it('indexes $id in then', () => {
    const schema = {
      '$id': 'https://x.test/Root',
      'if': { 'type': 'string' },
      'then': {
        '$id': 'https://x.test/ThenBranch',
        'minLength': 1
      }
    };
    const graph = new SchemaGraph(schema);
    const node = graph.embeddedNode('https://x.test/ThenBranch');

    assert.notStrictEqual(node, undefined, '$id in then must be indexed');
    assert.equal(node?.pointer, '/then');
  });

  void it('indexes $id in else', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'else': {
        '$id': 'https://x.test/ElseBranch',
        'type': 'number'
      },
      'if': { 'type': 'string' }
    });
    const node = graph.embeddedNode('https://x.test/ElseBranch');

    assert.notStrictEqual(node, undefined, '$id in else must be indexed');
    assert.equal(node?.pointer, '/else');
  });

  void it('indexes $id in not', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'not': {
        '$id': 'https://x.test/Negated',
        'type': 'string'
      }
    });
    const node = graph.embeddedNode('https://x.test/Negated');

    assert.notStrictEqual(node, undefined, '$id in not must be indexed');
    assert.equal(node?.pointer, '/not');
  });

  void it('indexes $id in dependentSchemas/*', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'dependentSchemas': {
        'name': {
          '$id': 'https://x.test/NameDep',
          'required': ['surname']
        }
      },
      'type': 'object'
    });
    const node = graph.embeddedNode('https://x.test/NameDep');

    assert.notStrictEqual(node, undefined, '$id in dependentSchemas/* must be indexed');
    assert.equal(node?.pointer, '/dependentSchemas/name');
  });

  void it('indexes $id in propertyNames', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'propertyNames': {
        '$id': 'https://x.test/KeySchema',
        'maxLength': 32
      }
    });
    const node = graph.embeddedNode('https://x.test/KeySchema');

    assert.notStrictEqual(node, undefined, '$id in propertyNames must be indexed');
    assert.equal(node?.pointer, '/propertyNames');
  });

  void it('indexes $id in contains', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'contains': {
        '$id': 'https://x.test/Contained',
        'type': 'integer'
      },
      'type': 'array'
    });
    const node = graph.embeddedNode('https://x.test/Contained');

    assert.notStrictEqual(node, undefined, '$id in contains must be indexed');
    assert.equal(node?.pointer, '/contains');
  });

  void it('indexes $id in unevaluatedProperties', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'unevaluatedProperties': {
        '$id': 'https://x.test/UnevalProp',
        'type': 'string'
      }
    });
    const node = graph.embeddedNode('https://x.test/UnevalProp');

    assert.notStrictEqual(node, undefined, '$id in unevaluatedProperties must be indexed');
    assert.equal(node?.pointer, '/unevaluatedProperties');
  });

  void it('indexes $id in unevaluatedItems', () => {
    const graph = new SchemaGraph({
      '$id': 'https://x.test/Root',
      'unevaluatedItems': {
        '$id': 'https://x.test/UnevalItem',
        'type': 'integer'
      }
    });
    const node = graph.embeddedNode('https://x.test/UnevalItem');

    assert.notStrictEqual(node, undefined, '$id in unevaluatedItems must be indexed');
    assert.equal(node?.pointer, '/unevaluatedItems');
  });

  void it('graph index is a strict superset — covers all schema positions and the sole resolution path', () => {
    // The graph index (embeddedNode) covers every sub-schema position where a
    // $id can legally appear. It is used as the SOLE resolution path by
    // GraphEngine.resolveRefGraph — there is no raw-walk fallback.
    // This test asserts that a $id placed in $defs (canonical position) is
    // found, and that the root $id is excluded (pointer === '' guard).
    const graph = new SchemaGraph({
      '$defs': {
        'Canonical': {
          '$id': 'https://x.test/Canonical',
          'type': 'string'
        }
      },
      '$id': 'https://x.test/Root',
      'type': 'object'
    });

    // Real schema position — must be indexed
    assert.notStrictEqual(
      graph.embeddedNode('https://x.test/Canonical'),
      undefined,
      '$id in $defs/* must be indexed by the sole resolution path'
    );

    // Root $id — excluded by pointer !== '' guard in lower()
    assert.equal(
      graph.embeddedNode('https://x.test/Root'),
      undefined,
      'root $id must NOT be in the embedded index'
    );

    // A $id that simply does not exist must not be found
    assert.equal(
      graph.embeddedNode('https://x.test/NotPresent'),
      undefined,
      'absent $id must return undefined'
    );
  });
});
