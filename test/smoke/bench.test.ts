import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { runCompiledBench } from '../../examples/docs/benchmarks/compiled.bench.js';

void describe('Benchmark smoke tests', () => {
  void it('runCompiledBench completes without unresolved refs', () => {
    const results = runCompiledBench();

    assert.equal(results.length, 3);
    assert.ok(results.some((result) => {
      return result.name === 'compiled nested valid' && result.library === 'compiled';
    }));
    assert.ok(results.every((result) => {
      return result.library === 'compiled';
    }));
  });
});
