/**
 * CliWriter — sole authority for json-tology CLI output. All stdout/stderr
 * writes go through here; no `console.*` calls anywhere in `src/`.
 *
 * Methods are instance methods on a singleton-style class so consumers
 * can opt to inject a mock writer for testing without touching globals.
 */

import type { CliWriterInterface } from '../../interfaces/CliWriterInterface.js';

export class CliWriter implements CliWriterInterface {
  public static readonly default: CliWriter = new CliWriter();

  public err(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  public exit(code: number): never {
    process.exit(code);
  }

  public out(message: string): void {
    process.stdout.write(`${message}\n`);
  }
}
