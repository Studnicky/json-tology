/**
 * Static counterpart methods — JsonTology.validate, JsonTology.toShacl,
 * JsonTology.toTbox, JsonTology.toSchema
 *
 * Each creates an ephemeral registry for one-shot execution with no shared state.
 * These tests verify happy-path return shapes and that caller-passed schema
 * objects are not mutated.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import { OntologyBuilder } from '../../src/modules/ontology/OntologyBuilder.js';
import { ValidationErrors } from '../../src/errors/ValidationErrors.js';

const PersonSchema = {
  '$id': 'https://static-counterparts.test/Person',
  'properties': {
    'age': {
      'minimum': 0,
      'type': 'integer'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'age',
    'name'
  ],
  'type': 'object'
} as const;

void describe('JsonTology.validate (static)', () => {
  void it('returns empty ValidationErrors for valid data', () => {
    const result = JsonTology.validate(PersonSchema, {
      'age': 30,
      'name': 'Alice'
    });

    assert.ok(result instanceof ValidationErrors, 'result is ValidationErrors');
    assert.ok(result.ok, 'no errors for valid data');
    assert.equal(result.length, 0);
  });

  void it('returns non-empty ValidationErrors for invalid data', () => {
    const result = JsonTology.validate(PersonSchema, { 'age': 'not-a-number' });

    assert.ok(result instanceof ValidationErrors, 'result is ValidationErrors');
    assert.equal(result.ok, false, 'errors present for invalid data');
    assert.ok(result.length > 0);
  });

  void it('does not mutate the caller-passed schema object', () => {
    const schemaCopy = structuredClone(PersonSchema);
    const keysBefore = JSON.stringify(schemaCopy);

    JsonTology.validate(schemaCopy, {
      'age': 25,
      'name': 'Bob'
    });

    assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
  });

  void it('return shape matches instance method return shape', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://static-counterparts.test',
      'schemas': [PersonSchema] as const
    });
    const instanceResult = jt.validate(PersonSchema, {
      'age': 30,
      'name': 'Alice'
    });
    const staticResult = JsonTology.validate(PersonSchema, {
      'age': 30,
      'name': 'Alice'
    });

    assert.ok(instanceResult instanceof ValidationErrors);
    assert.ok(staticResult instanceof ValidationErrors);
    assert.equal(instanceResult.ok, staticResult.ok, 'both have same ok status');
    assert.equal(instanceResult.length, staticResult.length, 'both have same error count');
  });
});

void describe('JsonTology.toShacl (static)', () => {
  void it('returns an OntologyBuilder for a single schema', () => {
    const result = JsonTology.toShacl([PersonSchema]);

    assert.ok(result instanceof OntologyBuilder, 'result is OntologyBuilder');
  });

  void it('produced SHACL contains NodeShape for the schema', () => {
    const result = JsonTology.toShacl([PersonSchema]);
    const jsonLd = result.jsonLd();
    const serialized = JSON.stringify(jsonLd);

    assert.ok(
      serialized.includes('NodeShape') || serialized.includes('shacl'),
      'SHACL output references NodeShape or shacl vocabulary'
    );
  });

  void it('does not mutate the caller-passed schema object', () => {
    const schemaCopy = structuredClone(PersonSchema);
    const keysBefore = JSON.stringify(schemaCopy);

    JsonTology.toShacl([schemaCopy]);

    assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
  });

  void it('return shape matches instance method return shape', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://static-counterparts.test',
      'schemas': [PersonSchema] as const
    });
    const instanceResult = jt.toShacl();
    const staticResult = JsonTology.toShacl([PersonSchema]);

    assert.ok(instanceResult instanceof OntologyBuilder);
    assert.ok(staticResult instanceof OntologyBuilder);
  });
});

void describe('JsonTology.toTbox (static)', () => {
  void it('returns an OntologyBuilder for a single schema', () => {
    const result = JsonTology.toTbox([PersonSchema]);

    assert.ok(result instanceof OntologyBuilder, 'result is OntologyBuilder');
  });

  void it('produced TBox contains OWL class or property declaration', () => {
    const result = JsonTology.toTbox([PersonSchema]);
    const jsonLd = result.jsonLd();
    const serialized = JSON.stringify(jsonLd);

    assert.ok(
      serialized.includes('Class') || serialized.includes('owl') || serialized.includes('DatatypeProperty'),
      'TBox output references OWL class or property vocabulary'
    );
  });

  void it('does not mutate the caller-passed schema object', () => {
    const schemaCopy = structuredClone(PersonSchema);
    const keysBefore = JSON.stringify(schemaCopy);

    JsonTology.toTbox([schemaCopy]);

    assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
  });

  void it('return shape matches instance method return shape', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://static-counterparts.test',
      'schemas': [PersonSchema] as const
    });
    const instanceResult = jt.toTbox();
    const staticResult = JsonTology.toTbox([PersonSchema]);

    assert.ok(instanceResult instanceof OntologyBuilder);
    assert.ok(staticResult instanceof OntologyBuilder);
  });
});

void describe('JsonTology.toSchema (static)', () => {
  void it('returns a record for a registered schema', () => {
    const result = JsonTology.toSchema(PersonSchema);

    assert.ok(result !== undefined, 'result is defined');
  });

  void it('reconstructed schema contains type property', () => {
    const result = JsonTology.toSchema(PersonSchema);

    assert.ok(result !== undefined);
    assert.equal(result.type, 'object', 'reconstructed schema has type: object');
  });

  void it('does not mutate the caller-passed schema object', () => {
    const schemaCopy = structuredClone(PersonSchema);
    const keysBefore = JSON.stringify(schemaCopy);

    JsonTology.toSchema(schemaCopy);

    assert.equal(JSON.stringify(schemaCopy), keysBefore, 'schema not mutated');
  });

  void it('return shape matches instance method return shape', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://static-counterparts.test',
      'schemas': [PersonSchema] as const
    });
    const instanceResult = jt.toSchema(PersonSchema);
    const staticResult = JsonTology.toSchema(PersonSchema);

    assert.equal(typeof instanceResult, typeof staticResult, 'both have same type');
  });
});
