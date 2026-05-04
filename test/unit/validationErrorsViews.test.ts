/**
 * ValidationErrors — aggregate() and report() views
 *
 * Covers the two ergonomic methods added in feat/errors-ergonomics.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { ValidationErrors } from '../../src/errors/ValidationErrors.js';

// ---------------------------------------------------------------------------
// aggregate()
// ---------------------------------------------------------------------------

void describe('ValidationErrors.aggregate()', () => {
  void it('returns zero count and empty arrays when there are no errors', () => {
    const errs = new ValidationErrors([]);
    const rollup = errs.aggregate();

    assert.equal(rollup.count, 0, 'count is 0');
    assert.deepEqual(rollup.paths, [], 'paths is empty');
    assert.deepEqual(rollup.keywords, [], 'keywords is empty');
  });

  void it('count matches .length', () => {
    const errs = new ValidationErrors([
      {
        'keyword': 'type',
        'message': 'must be string',
        'params': {},
        'path': '/name'
      },
      {
        'keyword': 'minimum',
        'message': 'must be >= 0',
        'params': { 'limit': 0 },
        'path': '/age'
      }
    ]);

    assert.equal(errs.aggregate().count, errs.length, 'aggregate().count === .length');
  });

  void it('deduplicates paths and keywords', () => {
    const errs = new ValidationErrors([
      {
        'keyword': 'type',
        'message': 'must be string',
        'params': {},
        'path': '/name'
      },
      {
        'keyword': 'minLength',
        'message': 'too short',
        'params': { 'limit': 1 },
        'path': '/name'
      },
      {
        'keyword': 'type',
        'message': 'must be number',
        'params': {},
        'path': '/age'
      }
    ]);

    const rollup = errs.aggregate();

    assert.equal(rollup.count, 3, 'count is 3 (no dedup on count)');
    assert.deepEqual(rollup.paths, [
      'age',
      'name'
    ], 'paths deduped and sorted (access form)');
    assert.deepEqual(rollup.keywords, [
      'minLength',
      'type'
    ], 'keywords deduped and sorted');
  });

  void it('returns paths and keywords sorted alphabetically', () => {
    const errs = new ValidationErrors([
      {
        'keyword': 'type',
        'message': 'err',
        'params': {},
        'path': '/z'
      },
      {
        'keyword': 'minLength',
        'message': 'err',
        'params': {},
        'path': '/a'
      },
      {
        'keyword': 'format',
        'message': 'err',
        'params': {},
        'path': '/m'
      }
    ]);

    const rollup = errs.aggregate();

    assert.deepEqual(rollup.paths, [
      'a',
      'm',
      'z'
    ], 'paths are sorted (access form)');
    assert.deepEqual(rollup.keywords, [
      'format',
      'minLength',
      'type'
    ], 'keywords are sorted');
  });

  void it('includes root errors (empty path) in paths', () => {
    const errs = new ValidationErrors([{
      'keyword': 'required',
      'message': "must have required property 'name'",
      'params': { 'missingProperty': 'name' },
      'path': ''
    }]);

    const rollup = errs.aggregate();

    assert.deepEqual(rollup.paths, [''], 'root error path is empty string');
    assert.equal(rollup.count, 1, 'count is 1');
  });

  void it('is safe to spread into a structured log line', () => {
    const errs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'must be string',
      'params': { 'type': 'string' },
      'path': '/name'
    }]);

    const rollup = errs.aggregate();
    const logLine = {
      ...rollup,
      'schema': 'https://example.com/User'
    };

    assert.equal(logLine.count, 1, 'spread count');
    assert.deepEqual(logLine.paths, ['name'], 'spread paths (access form)');
    assert.deepEqual(logLine.keywords, ['type'], 'spread keywords');
    assert.equal(logLine.schema, 'https://example.com/User', 'additional field preserved');
  });
});

// ---------------------------------------------------------------------------
// report()
// ---------------------------------------------------------------------------

void describe('ValidationErrors.report()', () => {
  void it('returns RFC 7807 shape with default type/title/status', () => {
    const errs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'must be string',
      'params': {},
      'path': '/name'
    }]);

    const problem = errs.report();

    assert.equal(problem.type, 'https://json-tology.dev/problems/validation', 'type');
    assert.equal(problem.title, 'Validation failed', 'title');
    assert.equal(problem.status, 422, 'status');
  });

  void it('detail is singular when there is exactly 1 error', () => {
    const errs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'must be string',
      'params': {},
      'path': '/name'
    }]);

    assert.equal(errs.report().detail, '1 validation error', 'singular detail');
  });

  void it('detail is plural when there are multiple errors', () => {
    const errs = new ValidationErrors([
      {
        'keyword': 'type',
        'message': 'must be string',
        'params': {},
        'path': '/name'
      },
      {
        'keyword': 'minimum',
        'message': 'must be >= 0',
        'params': { 'limit': 0 },
        'path': '/age'
      }
    ]);

    assert.equal(errs.report().detail, '2 validation errors', 'plural detail');
  });

  void it('each errors entry carries path, keyword, message, params', () => {
    const errs = new ValidationErrors([{
      'keyword': 'format',
      'message': 'must match format "uuid"',
      'params': { 'format': 'uuid' },
      'path': '/id'
    }]);

    const problem = errs.report();

    assert.equal(problem.errors.length, 1, 'one error entry');
    assert.deepEqual(
      problem.errors,
      [{
        'keyword': 'format',
        'message': 'must match format "uuid"',
        'params': { 'format': 'uuid' },
        'path': '/id'
      }],
      'errors entry carries all fields'
    );
  });

  void it('overrides merge over defaults', () => {
    const errs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'must be string',
      'params': {},
      'path': '/name'
    }]);

    const problem = errs.report({
      'instance': '/api/users',
      'status': 400,
      'title': 'Bad request'
    });

    assert.equal(problem.status, 400, 'overridden status');
    assert.equal(problem.title, 'Bad request', 'overridden title');
    assert.equal(problem.instance, '/api/users', 'instance attached');
    assert.equal(problem.type, 'https://json-tology.dev/problems/validation', 'type unchanged');
  });

  void it('instance is undefined when not provided', () => {
    const errs = new ValidationErrors([{
      'keyword': 'type',
      'message': 'err',
      'params': {},
      'path': ''
    }]);

    assert.equal(errs.report().instance, undefined, 'instance is undefined by default');
  });

  void it('payload survives structuredClone round-trip identically', () => {
    const errs = new ValidationErrors([
      {
        'keyword': 'format',
        'message': 'must match format "uuid"',
        'params': { 'format': 'uuid' },
        'path': '/id'
      },
      {
        'keyword': 'minItems',
        'message': 'must NOT have fewer than 1 items',
        'params': { 'limit': 1 },
        'path': '/items'
      }
    ]);

    const problem = errs.report({ 'instance': '/orders' });
    const cloned = structuredClone(problem);

    assert.deepEqual(cloned, problem, 'structuredClone round-trip is identical');
  });

  void it('errors array is empty when ValidationErrors has no items', () => {
    const errs = new ValidationErrors([]);
    const problem = errs.report();

    assert.equal(problem.errors.length, 0, 'no error entries');
    assert.equal(problem.detail, '0 validation errors', 'zero plural detail');
  });
});
