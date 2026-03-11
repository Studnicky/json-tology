import type { Logger } from './interfaces/logger.js';

/**
 * Logger implementation that writes to the console.
 * Suitable for development, testing, and CLI usage.
 */
export const ConsoleLogger: Logger = {
  trace: (msg, ...args) => console.trace(msg, ...args),
  debug: (msg, ...args) => console.debug(msg, ...args),
  info:  (msg, ...args) => console.info(msg,  ...args),
  warn:  (msg, ...args) => console.warn(msg,  ...args),
  error: (msg, ...args) => console.error(msg, ...args),
  fatal: (msg, ...args) => console.error(`[fatal] ${msg}`, ...args),
};
