import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaIri } from '../../src/modules/graph/SchemaIri.js';

void describe('SchemaIri.propertyIri', () => {
  void it('appends property name as fragment', () => {
    assert.equal(
      SchemaIri.propertyIri('https://example.io/User', 'email'),
      'https://example.io/User#email'
    );
  });

  void it('handles property names with special characters', () => {
    assert.equal(
      SchemaIri.propertyIri('https://example.io/Schema', 'my-prop'),
      'https://example.io/Schema#my-prop'
    );
  });
});

void describe('SchemaIri.escapeSegment', () => {
  void it('encodes special characters', () => {
    assert.equal(SchemaIri.escapeSegment('hello world'), 'hello%20world');
  });

  void it('encodes hash character', () => {
    assert.equal(SchemaIri.escapeSegment('a#b'), 'a%23b');
  });

  void it('preserves forward slashes', () => {
    assert.equal(SchemaIri.escapeSegment('a/b/c'), 'a/b/c');
  });

  void it('returns empty string for empty input', () => {
    assert.equal(SchemaIri.escapeSegment(''), '');
  });

  void it('leaves alphanumeric characters unchanged', () => {
    assert.equal(SchemaIri.escapeSegment('abc123'), 'abc123');
  });
});

void describe('SchemaIri.splitSubject', () => {
  void it('returns base and null fragment for subject without hash', () => {
    const result = SchemaIri.splitSubject('http://example.com/User');

    assert.equal(result.base, 'http://example.com/User');
    assert.equal(result.fragment, null);
  });

  void it('splits subject at hash boundary', () => {
    const result = SchemaIri.splitSubject('http://example.com/User#/properties/name');

    assert.equal(result.base, 'http://example.com/User');
    assert.equal(result.fragment, '/properties/name');
  });

  void it('handles empty fragment after hash', () => {
    const result = SchemaIri.splitSubject('http://example.com/User#');

    assert.equal(result.base, 'http://example.com/User');
    assert.equal(result.fragment, '');
  });
});

void describe('SchemaIri.isPropertySubject', () => {
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

void describe('SchemaIri.fragmentContains', () => {
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

void describe('SchemaIri.structuralParent', () => {
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

void describe('SchemaIri.lastSegment', () => {
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
