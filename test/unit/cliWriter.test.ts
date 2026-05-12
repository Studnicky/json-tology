/**
 * CliWriter unit tests — stdout/stderr routing and interface contract
 */

import {
  afterEach, beforeEach, describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { CliWriter } from '../../src/modules/cli/CliWriter.js';
import type { CliWriterInterface } from '../../src/interfaces/CliWriter.js';

// Capture helpers — intercept process.stdout / process.stderr writes and restore.

function captureStdout(): {
  'captured': string[];
  'restore': () => void;
} {
  const captured: string[] = [];
  const original = process.stdout.write;

  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    captured.push(String(chunk));

    return true;
  };

  return {
    captured,
    restore(): void {
      process.stdout.write = original;
    }
  };
}

function captureStderr(): {
  'captured': string[];
  'restore': () => void;
} {
  const captured: string[] = [];
  const original = process.stderr.write;

  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    captured.push(String(chunk));

    return true;
  };

  return {
    captured,
    restore(): void {
      process.stderr.write = original;
    }
  };
}

// ---------------------------------------------------------------------------
// Good — normal stdout / stderr writes succeed
// ---------------------------------------------------------------------------

void describe('CliWriter — Good: normal writes', () => {
  let stdout: ReturnType<typeof captureStdout>;
  let stderr: ReturnType<typeof captureStderr>;

  beforeEach(() => {
    stdout = captureStdout();
    stderr = captureStderr();
  });

  afterEach(() => {
    stdout.restore();
    stderr.restore();
  });

  void it('out() writes message with trailing newline to stdout', () => {
    const cliWriter = new CliWriter();

    cliWriter.out('hello world');
    cliWriter.out('second line');

    assert.strictEqual(stdout.captured.length, 2);
    assert.strictEqual(stdout.captured[0], 'hello world\n');
    assert.strictEqual(stdout.captured[1], 'second line\n');
    assert.strictEqual(stderr.captured.length, 0);
  });

  void it('err() writes message with trailing newline to stderr', () => {
    const cliWriter = new CliWriter();

    cliWriter.err('something went wrong');
    cliWriter.err('and again');

    assert.strictEqual(stderr.captured.length, 2);
    assert.strictEqual(stderr.captured[0], 'something went wrong\n');
    assert.strictEqual(stderr.captured[1], 'and again\n');
    assert.strictEqual(stdout.captured.length, 0);
  });

  void it('out() and err() route independently to stdout/stderr', () => {
    const cliWriter = new CliWriter();

    cliWriter.out('stdout-message');
    cliWriter.err('stderr-message');
    cliWriter.out('stdout-message-2');

    assert.strictEqual(stdout.captured.length, 2);
    assert.strictEqual(stderr.captured.length, 1);
    assert.strictEqual(stdout.captured[0], 'stdout-message\n');
    assert.strictEqual(stderr.captured[0], 'stderr-message\n');
    assert.strictEqual(stdout.captured[1], 'stdout-message-2\n');
  });

  void it('CliWriter.default is a shared singleton instance of CliWriter', () => {
    assert.ok(CliWriter.default instanceof CliWriter);
    assert.strictEqual(CliWriter.default, CliWriter.default);
  });
});

// ---------------------------------------------------------------------------
// Bad — no throw on edge inputs (empty string, very large string)
// ---------------------------------------------------------------------------

void describe('CliWriter — Bad: edge inputs do not throw', () => {
  let stdout: ReturnType<typeof captureStdout>;
  let stderr: ReturnType<typeof captureStderr>;

  beforeEach(() => {
    stdout = captureStdout();
    stderr = captureStderr();
  });

  afterEach(() => {
    stdout.restore();
    stderr.restore();
  });

  void it('out() and err() with empty string write only a newline without throwing', () => {
    const cliWriter = new CliWriter();

    assert.doesNotThrow(() => {
      cliWriter.out('');
    });
    assert.doesNotThrow(() => {
      cliWriter.err('');
    });
    assert.strictEqual(stdout.captured[0], '\n');
    assert.strictEqual(stderr.captured[0], '\n');
  });

  void it('out() and err() handle very large strings without throwing', () => {
    const cliWriter = new CliWriter();
    const large = 'x'.repeat(1_000_000);

    assert.doesNotThrow(() => {
      cliWriter.out(large);
    });
    assert.doesNotThrow(() => {
      cliWriter.err(large);
    });
    assert.strictEqual(stdout.captured[0], `${large}\n`);
    assert.strictEqual(stderr.captured[0], `${large}\n`);
  });
});

// ---------------------------------------------------------------------------
// Ugly — bytes that need escaping pass through unchanged
// ---------------------------------------------------------------------------

void describe('CliWriter — Ugly: special bytes pass through unchanged', () => {
  let stdout: ReturnType<typeof captureStdout>;
  let stderr: ReturnType<typeof captureStderr>;

  beforeEach(() => {
    stdout = captureStdout();
    stderr = captureStderr();
  });

  afterEach(() => {
    stdout.restore();
    stderr.restore();
  });

  void it('out() and err() pass embedded newlines through unchanged', () => {
    const cliWriter = new CliWriter();

    cliWriter.out('line1\nline2\nline3');
    cliWriter.err('error\ndetail');

    assert.strictEqual(stdout.captured[0], 'line1\nline2\nline3\n');
    assert.strictEqual(stderr.captured[0], 'error\ndetail\n');
  });

  void it('out() and err() pass ANSI escape codes through unchanged', () => {
    const cliWriter = new CliWriter();
    const ansiRed = '[31mred text[0m';
    const ansiGreen = '[32mgreen text[0m';

    cliWriter.out(ansiRed);
    cliWriter.err(ansiGreen);

    assert.strictEqual(stdout.captured[0], `${ansiRed}\n`);
    assert.strictEqual(stderr.captured[0], `${ansiGreen}\n`);
  });

  void it('out() passes Unicode and multi-byte sequences through unchanged', () => {
    const cliWriter = new CliWriter();
    const unicode = '日本語テスト\u{1F4A9}';
    const control = 'tab:\there null:\0end';

    cliWriter.out(unicode);
    cliWriter.out(control);

    assert.strictEqual(stdout.captured[0], `${unicode}\n`);
    assert.strictEqual(stdout.captured[1], `${control}\n`);
  });
});

// ---------------------------------------------------------------------------
// Interface injection — mock writer satisfies CliWriterInterface
// ---------------------------------------------------------------------------

void describe('CliWriter — Interface: mock writer can be injected', () => {
  void it('a plain object implementing CliWriterInterface collects output without writing to process streams', () => {
    const outMessages: string[] = [];
    const errMessages: string[] = [];

    const mock: CliWriterInterface = {
      err(message: string): void {
        errMessages.push(message);
      },
      exit(_: number): never {
        throw new Error('exit called');
      },
      out(message: string): void {
        outMessages.push(message);
      }
    };

    function invoke(writer: CliWriterInterface, msg: string): void {
      writer.out(msg);
      writer.err(`err:${msg}`);
    }

    invoke(mock, 'injected');
    invoke(mock, 'second');

    assert.strictEqual(outMessages.length, 2);
    assert.strictEqual(errMessages.length, 2);
    assert.strictEqual(outMessages[0], 'injected');
    assert.strictEqual(errMessages[0], 'err:injected');
    assert.strictEqual(outMessages[1], 'second');
    assert.strictEqual(errMessages[1], 'err:second');
  });

  void it('mock exit() is called with the correct code and propagates as a testable throw', () => {
    const mock: CliWriterInterface = {
      err(): void {
        // no-op
      },
      exit(code: number): never {
        throw new Error(`exit:${code}`);
      },
      out(): void {
        // no-op
      }
    };

    assert.throws(() => {
      mock.exit(1);
    }, /exit:1/u);
    assert.throws(() => {
      mock.exit(42);
    }, /exit:42/u);
  });

  void it('CliWriter instance satisfies CliWriterInterface structurally', () => {
    const cliWriter: CliWriterInterface = new CliWriter();

    assert.ok(typeof cliWriter.out === 'function');
    assert.ok(typeof cliWriter.err === 'function');
    assert.ok(typeof cliWriter.exit === 'function');
  });
});
