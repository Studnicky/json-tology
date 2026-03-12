import type { Logger } from './interfaces/logger.js';

/**
 * No-op logger that discards all output.
 * Used as the default logger when no logger is injected.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop(): void {}

export const SilentLogger: Logger = {
  'debug': noop,
  'error': noop,
  'fatal': noop,
  'info': noop,
  'trace': noop,
  'warn': noop
};
