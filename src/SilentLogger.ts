import type { Logger } from './interfaces/logger.js';

/**
 * No-op logger that discards all output.
 * Used as the default logger when no logger is injected.
 */
export const SilentLogger: Logger = {
  trace: () => {},
  debug: () => {},
  info:  () => {},
  warn:  () => {},
  error: () => {},
  fatal: () => {},
};
