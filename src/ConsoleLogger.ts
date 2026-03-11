import type { Logger } from './interfaces/logger.js';

/**
 * Logger implementation that writes to the console.
 * Suitable for development, testing, and CLI usage.
 */
export const ConsoleLogger: Logger = {
  'debug': (msg, ...args) => {
    return console.debug(msg, ...args);
  },
  'error': (msg, ...args) => {
    return console.error(msg, ...args);
  },
  'fatal': (msg, ...args) => {
    return console.error(`[fatal] ${msg}`, ...args);
  },
  'info': (msg, ...args) => {
    return console.info(msg, ...args);
  },
  'trace': (msg, ...args) => {
    return console.trace(msg, ...args);
  },
  'warn': (msg, ...args) => {
    return console.warn(msg, ...args);
  }
};
