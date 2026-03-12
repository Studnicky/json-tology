import type { LoggerInterface } from '../../interfaces/logger.js';

export class Logger implements LoggerInterface {
  private readonly silent: boolean;
  constructor(options?: { silent?: boolean }) {
    this.silent = options?.silent ?? false;
  }
  debug(msg: string, ...args: unknown[]): void { if (!this.silent) console.debug(msg, ...args); }
  error(msg: string, ...args: unknown[]): void { if (!this.silent) console.error(msg, ...args); }
  fatal(msg: string, ...args: unknown[]): void { if (!this.silent) console.error(`[fatal] ${msg}`, ...args); }
  info(msg: string, ...args: unknown[]): void { if (!this.silent) console.info(msg, ...args); }
  trace(msg: string, ...args: unknown[]): void { if (!this.silent) console.trace(msg, ...args); }
  warn(msg: string, ...args: unknown[]): void { if (!this.silent) console.warn(msg, ...args); }
}
