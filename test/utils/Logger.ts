import type { LoggerInterface } from '../../src/interfaces/LoggerInterface.js';

export class Logger implements LoggerInterface {
  private readonly silent: boolean;
  /**
   * Create a Logger, optionally silencing all output.
   *
   * @param options - Pass silent: true to suppress all log output
   */
  constructor(options?: { 'silent'?: boolean }) {
    this.silent = options?.silent ?? false;
  }
  /**
   * Log a debug-level message.
   *
   * @param msg - Message string
   * @param args - Additional values to log
   */
  debug(msg: string, ...args: unknown[]): void {
    if (!this.silent) {
      console.debug(msg, ...args);
    }
  }
  /**
   * Log an error-level message.
   *
   * @param msg - Message string
   * @param args - Additional values to log
   */
  error(msg: string, ...args: unknown[]): void {
    if (!this.silent) {
      console.error(msg, ...args);
    }
  }
  /**
   * Log a fatal-level message, prefixed with [fatal].
   *
   * @param msg - Message string
   * @param args - Additional values to log
   */
  fatal(msg: string, ...args: unknown[]): void {
    if (!this.silent) {
      console.error(`[fatal] ${msg}`, ...args);
    }
  }
  /**
   * Log an info-level message.
   *
   * @param msg - Message string
   * @param args - Additional values to log
   */
  info(msg: string, ...args: unknown[]): void {
    if (!this.silent) {
      console.info(msg, ...args);
    }
  }
  /**
   * Log a trace-level message.
   *
   * @param msg - Message string
   * @param args - Additional values to log
   */
  trace(msg: string, ...args: unknown[]): void {
    if (!this.silent) {
      console.debug(msg, ...args);
    }
  }
  /**
   * Log a warn-level message.
   *
   * @param msg - Message string
   * @param args - Additional values to log
   */
  warn(msg: string, ...args: unknown[]): void {
    if (!this.silent) {
      console.warn(msg, ...args);
    }
  }
}
