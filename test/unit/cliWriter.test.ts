/**
 * CliWriter unit tests — stdout/stderr routing and interface contract
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { CliWriter } from '../../src/modules/cli/CliWriter.js';
import type { CliWriterInterface } from '../../src/interfaces/CliWriterInterface.js';

// ---------------------------------------------------------------------------
// Good — normal stdout / stderr writes succeed
// ---------------------------------------------------------------------------

void describe('CliWriter — Good: normal writes', () => {
  void it('out() writes message with trailing newline to stdout', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];
    const capturedErr: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      capturedErr.push(String(chunk));

      return true;
    };

    try {
      const cliWriter = new CliWriter();

      cliWriter.out('hello world');
      cliWriter.out('second line');

      assert.strictEqual(capturedOut.length, 2);
      assert.strictEqual(capturedOut[0], 'hello world\n');
      assert.strictEqual(capturedOut[1], 'second line\n');
      assert.strictEqual(capturedErr.length, 0);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
  });

  void it('err() writes message with trailing newline to stderr', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];
    const capturedErr: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      capturedErr.push(String(chunk));

      return true;
    };

    try {
      const cliWriter = new CliWriter();

      cliWriter.err('something went wrong');
      cliWriter.err('and again');

      assert.strictEqual(capturedErr.length, 2);
      assert.strictEqual(capturedErr[0], 'something went wrong\n');
      assert.strictEqual(capturedErr[1], 'and again\n');
      assert.strictEqual(capturedOut.length, 0);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
  });

  void it('out() and err() route independently to stdout/stderr', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];
    const capturedErr: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      capturedErr.push(String(chunk));

      return true;
    };

    try {
      const cliWriter = new CliWriter();

      cliWriter.out('stdout-message');
      cliWriter.err('stderr-message');
      cliWriter.out('stdout-message-2');

      assert.strictEqual(capturedOut.length, 2);
      assert.strictEqual(capturedErr.length, 1);
      assert.strictEqual(capturedOut[0], 'stdout-message\n');
      assert.strictEqual(capturedErr[0], 'stderr-message\n');
      assert.strictEqual(capturedOut[1], 'stdout-message-2\n');
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
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
  void it('out() and err() with empty string write only a newline without throwing', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];
    const capturedErr: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      capturedErr.push(String(chunk));

      return true;
    };

    try {
      const cliWriter = new CliWriter();

      assert.doesNotThrow(() => {
        cliWriter.out('');
      });
      assert.doesNotThrow(() => {
        cliWriter.err('');
      });
      assert.strictEqual(capturedOut[0], '\n');
      assert.strictEqual(capturedErr[0], '\n');
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
  });

  void it('out() and err() handle very large strings without throwing', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];
    const capturedErr: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      capturedErr.push(String(chunk));

      return true;
    };

    try {
      const cliWriter = new CliWriter();
      const large = 'x'.repeat(1_000_000);

      assert.doesNotThrow(() => {
        cliWriter.out(large);
      });
      assert.doesNotThrow(() => {
        cliWriter.err(large);
      });
      assert.strictEqual(capturedOut[0], `${large}\n`);
      assert.strictEqual(capturedErr[0], `${large}\n`);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
  });
});

// ---------------------------------------------------------------------------
// Ugly — bytes that need escaping pass through unchanged
// ---------------------------------------------------------------------------

void describe('CliWriter — Ugly: special bytes pass through unchanged', () => {
  void it('out() and err() pass embedded newlines through unchanged', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];
    const capturedErr: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      capturedErr.push(String(chunk));

      return true;
    };

    try {
      const cliWriter = new CliWriter();

      cliWriter.out('line1\nline2\nline3');
      cliWriter.err('error\ndetail');

      assert.strictEqual(capturedOut[0], 'line1\nline2\nline3\n');
      assert.strictEqual(capturedErr[0], 'error\ndetail\n');
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
  });

  void it('out() and err() pass ANSI escape codes through unchanged', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];
    const capturedErr: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      capturedErr.push(String(chunk));

      return true;
    };

    try {
      const cliWriter = new CliWriter();
      const ansiRed = '[31mred text[0m';
      const ansiGreen = '[32mgreen text[0m';

      cliWriter.out(ansiRed);
      cliWriter.err(ansiGreen);

      assert.strictEqual(capturedOut[0], `${ansiRed}\n`);
      assert.strictEqual(capturedErr[0], `${ansiGreen}\n`);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
  });

  void it('out() passes Unicode and multi-byte sequences through unchanged', () => {
    const originalStdout = process.stdout.write;
    const originalStderr = process.stderr.write;
    const capturedOut: string[] = [];

    process.stdout.write = (chunk: string | Uint8Array): boolean => {
      capturedOut.push(String(chunk));

      return true;
    };
    process.stderr.write = (chunk: string | Uint8Array): boolean => {
      void chunk;

      return true;
    };

    try {
      const cliWriter = new CliWriter();
      const unicode = '日本語テスト\u{1F4A9}';
      const control = 'tab:\there null:\0end';

      cliWriter.out(unicode);
      cliWriter.out(control);

      assert.strictEqual(capturedOut[0], `${unicode}\n`);
      assert.strictEqual(capturedOut[1], `${control}\n`);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
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
