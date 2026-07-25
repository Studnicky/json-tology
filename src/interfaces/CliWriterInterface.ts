/**
 * CliWriter interface — contract for CLI stdout/stderr output and process exit.
 *
 * Consumers depend on this interface so a mock writer can be injected for
 * testing without touching process globals.
 */
export interface CliWriterInterface {
  error(message: string): void;
  exit(code: number): never;
  out(message: string): void;
}
