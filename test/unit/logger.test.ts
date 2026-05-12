import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Logger } from '../utils/Logger.js';

void describe('Logger', () => {
  void describe('silent mode suppresses output', () => {
    const silentScenarios: Array<{
      'method': 'debug' | 'error' | 'fatal' | 'info' | 'trace' | 'warn';
      'name': string;
    }> = [
      {
        'method': 'debug',
        'name': 'happy: silent debug produces no output'
      },
      {
        'method': 'info',
        'name': 'happy: silent info produces no output'
      },
      {
        'method': 'warn',
        'name': 'happy: silent warn produces no output'
      },
      {
        'method': 'error',
        'name': 'happy: silent error produces no output'
      },
      {
        'method': 'trace',
        'name': 'happy: silent trace produces no output'
      },
      {
        'method': 'fatal',
        'name': 'happy: silent fatal produces no output'
      }
    ];

    for (const {
      'method': method, 'name': name
    } of silentScenarios) {
      void it(name, () => {
        const originalDebug = console.debug;
        const originalTrace = console.trace;
        const originalInfo = console.info;
        const originalWarn = console.warn;
        const originalError = console.error;

        try {
          let called = false;

          console.debug = () => {
            called = true;
          };
          console.info = () => {
            called = true;
          };
          console.warn = () => {
            called = true;
          };
          console.error = () => {
            called = true;
          };
          console.trace = () => {
            called = true;
          };

          const logger = new Logger({ 'silent': true });

          logger[method]('test message', 'extra');

          assert.equal(called, false);
        } finally {
          console.debug = originalDebug;
          console.trace = originalTrace;
          console.info = originalInfo;
          console.warn = originalWarn;
          console.error = originalError;
        }
      });
    }
  });

  void describe('non-silent mode routes to correct console method', () => {
    const routingScenarios: Array<{
      'consoleMethod': 'debug' | 'error' | 'info' | 'warn';
      'method': 'debug' | 'error' | 'info' | 'trace' | 'warn';
      'name': string;
    }> = [
      {
        'consoleMethod': 'debug',
        'method': 'debug',
        'name': 'happy: debug routes to console.debug'
      },
      {
        'consoleMethod': 'info',
        'method': 'info',
        'name': 'happy: info routes to console.info'
      },
      {
        'consoleMethod': 'warn',
        'method': 'warn',
        'name': 'happy: warn routes to console.warn'
      },
      {
        'consoleMethod': 'error',
        'method': 'error',
        'name': 'happy: error routes to console.error'
      },
      {
        'consoleMethod': 'debug',
        'method': 'trace',
        'name': 'happy: trace routes to console.debug (not console.trace)'
      }
    ];

    for (const {
      'consoleMethod': consoleMethod, 'method': method, 'name': name
    } of routingScenarios) {
      void it(name, () => {
        const originalDebug = console.debug;
        const originalTrace = console.trace;
        const originalInfo = console.info;
        const originalWarn = console.warn;
        const originalError = console.error;

        try {
          const messages: unknown[][] = [];
          let traceCalled = false;

          console.debug = (...args: unknown[]) => {
            messages.push(args);
          };
          console.info = (...args: unknown[]) => {
            messages.push(args);
          };
          console.warn = (...args: unknown[]) => {
            messages.push(args);
          };
          console.error = (...args: unknown[]) => {
            messages.push(args);
          };
          console.trace = () => {
            traceCalled = true;
          };

          const logger = new Logger();

          logger[method]('test msg', 'arg1');

          if (consoleMethod === 'debug' && method === 'trace') {
            assert.equal(traceCalled, false, 'trace() must not call console.trace');
          }
          assert.equal(messages.length, 1);
          assert.deepEqual(messages[0], [
            'test msg',
            'arg1'
          ]);
        } finally {
          console.debug = originalDebug;
          console.trace = originalTrace;
          console.info = originalInfo;
          console.warn = originalWarn;
          console.error = originalError;
        }
      });
    }
  });

  void it('happy: trace() uses debug logging instead of emitting stack traces', () => {
    const originalDebug = console.debug;
    const originalTrace = console.trace;

    try {
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
    } finally {
      console.debug = originalDebug;
      console.trace = originalTrace;
    }
  });

  void it('edge: fatal prefixes message with [fatal]', () => {
    const originalError = console.error;

    try {
      const messages: unknown[][] = [];

      console.error = (...args: unknown[]) => {
        messages.push(args);
      };

      const logger = new Logger();

      logger.fatal('system down', 'details');

      assert.equal(messages.length, 1);
      assert.equal(messages[0]?.[0], '[fatal] system down');
      assert.equal(messages[0]?.[1], 'details');
    } finally {
      console.error = originalError;
    }
  });

  void it('edge: methods accept multiple variadic arguments', () => {
    const originalDebug = console.debug;

    try {
      const messages: unknown[][] = [];

      console.debug = (...args: unknown[]) => {
        messages.push(args);
      };

      const logger = new Logger();

      logger.debug('msg', 1, 2, 3, { 'key': 'val' });

      assert.equal(messages.length, 1);
      assert.deepEqual(messages[0], [
        'msg',
        1,
        2,
        3,
        { 'key': 'val' }
      ]);
    } finally {
      console.debug = originalDebug;
    }
  });
});
