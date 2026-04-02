import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIndex,
  isListStructure,
  isRestrictionStructure,
  relationTargetId
} from '../../src/modules/rdf/ProjectionIndex.js';
import type { SchemaGraphRelationInterface } from '../../src/interfaces/SchemaGraph.js';
import type { RelationStructure } from '../../src/types/SchemaGraph.js';

function makeRelation(
  sourceId: string,
  predicate: string,
  target: string | { 'id': string;
    'pointer': string;
    'schema': Record<string, unknown> }
): SchemaGraphRelationInterface {
  return {
    'predicate': predicate,
    'source': {
      'id': sourceId,
      'pointer': '',
      'schema': {}
    },
    'target': target
  };
}

void describe('buildIndex', () => {
  void it('returns empty map for empty relations array', () => {
    const index = buildIndex([]);

    assert.equal(index.size, 0);
  });

  void it('groups relations by source ID', () => {
    const relations = [
      makeRelation('http://example.com/User', 'rdfs:label', 'User'),
      makeRelation('http://example.com/User', 'rdfs:comment', 'A user class'),
      makeRelation('http://example.com/Order', 'rdfs:label', 'Order')
    ];

    const index = buildIndex(relations);

    assert.equal(index.size, 2);
    assert.equal(index.get('http://example.com/User')?.all.length, 2);
    assert.equal(index.get('http://example.com/Order')?.all.length, 1);
  });

  void it('separates relations by predicate', () => {
    const relations = [
      makeRelation('http://example.com/User', 'rdfs:label', 'User'),
      makeRelation('http://example.com/User', 'rdfs:comment', 'A user class'),
      makeRelation('http://example.com/User', 'rdfs:label', 'UserAlias')
    ];

    const index = buildIndex(relations);
    const entry = index.get('http://example.com/User');

    assert.equal(entry?.byPredicate.get('rdfs:label')?.length, 2);
    assert.equal(entry.byPredicate.get('rdfs:comment')?.length, 1);
  });

  void it('extracts rdf:type relations into types array', () => {
    const relations = [
      makeRelation('http://example.com/User', 'rdf:type', 'owl:Class'),
      makeRelation('http://example.com/User', 'rdfs:label', 'User'),
      makeRelation('http://example.com/User', 'rdf:type', 'rdfs:Resource')
    ];

    const index = buildIndex(relations);
    const entry = index.get('http://example.com/User');

    assert.deepEqual(entry?.types, [
      'owl:Class',
      'rdfs:Resource'
    ]);
  });
});

void describe('relationTargetId', () => {
  void it('returns string target directly', () => {
    const relation = makeRelation('http://example.com/User', 'rdfs:label', 'User');

    assert.equal(relationTargetId(relation), 'User');
  });

  void it('returns node id for object target', () => {
    const relation = makeRelation(
      'http://example.com/User',
      'rdf:type',
      {
        'id': 'http://example.com/Class',
        'pointer': '',
        'schema': {}
      }
    );

    assert.equal(relationTargetId(relation), 'http://example.com/Class');
  });
});

void describe('isRestrictionStructure', () => {
  void it('returns true for restriction kind', () => {
    const structure: RelationStructure = {
      'constraint': 'sh:maxCount',
      'kind': 'restriction',
      'onProperty': 'http://example.com/User#name',
      'value': 1
    };

    assert.equal(isRestrictionStructure(structure), true);
  });

  void it('returns false for list kind', () => {
    const structure: RelationStructure = {
      'kind': 'list',
      'members': [
        'a',
        'b'
      ]
    };

    assert.equal(isRestrictionStructure(structure), false);
  });

  void it('returns false for undefined', () => {
    assert.equal(isRestrictionStructure(), false);
  });
});

void describe('isListStructure', () => {
  void it('returns true for list kind', () => {
    const structure: RelationStructure = {
      'kind': 'list',
      'members': [
        'http://example.com/a',
        'http://example.com/b'
      ]
    };

    assert.equal(isListStructure(structure), true);
  });

  void it('returns false for restriction kind', () => {
    const structure: RelationStructure = {
      'constraint': 'sh:minCount',
      'kind': 'restriction',
      'onProperty': 'http://example.com/User#age',
      'value': 0
    };

    assert.equal(isListStructure(structure), false);
  });

  void it('returns false for undefined', () => {
    assert.equal(isListStructure(), false);
  });
});
