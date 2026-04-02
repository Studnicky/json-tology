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
import { SchemaIri } from '../../src/modules/graph/SchemaIri.js';
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

void describe('isPropertySubject', () => {
  void it('returns true for subject with hash and /properties/ fragment', () => {
    assert.equal(SchemaIri.isPropertySubject('http://example.com/User#/properties/name'), true);
  });

  void it('returns true for deeply nested property subject', () => {
    assert.equal(SchemaIri.isPropertySubject('http://example.com/User#/properties/address/properties/street'), true);
  });

  void it('returns false for subject without hash', () => {
    assert.equal(SchemaIri.isPropertySubject('http://example.com/User'), false);
  });

  void it('returns false for subject with hash but no /properties/ fragment', () => {
    assert.equal(SchemaIri.isPropertySubject('http://example.com/User#/$defs/Address'), false);
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

void describe('fragmentContains', () => {
  void it('returns true when fragment contains the segment', () => {
    assert.equal(SchemaIri.fragmentContains('http://example.com/User#/properties/name', 'properties'), true);
  });

  void it('returns false when fragment does not contain the segment', () => {
    assert.equal(SchemaIri.fragmentContains('http://example.com/User#/$defs/Address', 'properties'), false);
  });

  void it('returns false when subject has no hash', () => {
    assert.equal(SchemaIri.fragmentContains('http://example.com/User', 'properties'), false);
  });
});

void describe('structuralParent', () => {
  void it('returns subject unchanged when no hash present', () => {
    assert.equal(SchemaIri.structuralParent('http://example.com/User'), 'http://example.com/User');
  });

  void it('returns base when fragment has no /properties/', () => {
    assert.equal(SchemaIri.structuralParent('http://example.com/User#/$defs/Address'), 'http://example.com/User');
  });

  void it('returns base for root-level property', () => {
    assert.equal(SchemaIri.structuralParent('http://example.com/User#/properties/name'), 'http://example.com/User');
  });

  void it('returns parent pointer for nested property', () => {
    assert.equal(
      SchemaIri.structuralParent('http://example.com/User#/properties/address/properties/street'),
      'http://example.com/User#/properties/address'
    );
  });
});

void describe('lastSegment', () => {
  void it('returns full subject when no hash present', () => {
    assert.equal(SchemaIri.lastSegment('http://example.com/User'), 'http://example.com/User');
  });

  void it('returns last path segment from fragment', () => {
    assert.equal(SchemaIri.lastSegment('http://example.com/User#/properties/name'), 'name');
  });

  void it('returns last segment from deeply nested fragment', () => {
    assert.equal(SchemaIri.lastSegment('http://example.com/User#/properties/address/properties/street'), 'street');
  });

  void it('returns empty string for trailing slash', () => {
    assert.equal(SchemaIri.lastSegment('http://example.com/User#/properties/'), '');
  });
});
