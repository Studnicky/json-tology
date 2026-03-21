import {
  afterEach, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../utils/Logger.js';

const originalDebug = console.debug;
const originalTrace = console.trace;

afterEach(() => {
  console.debug = originalDebug;
  console.trace = originalTrace;
});

void describe('Logger', () => {
  void it('trace() uses debug logging instead of emitting stack traces', () => {
    const messages: unknown[][] = [];
    let traceCalled = false;

    console.debug = (...args: unknown[]) => {
      messages.push(args);
    };
    console.trace = () => {
      traceCalled = true;
    };

    const logger = new Logger();

    logger.trace('schema registered', 'https://example.io/Test');

    assert.equal(traceCalled, false);
    assert.deepEqual(messages, [[
      'schema registered',
      'https://example.io/Test'
    ]]);
  });
});
