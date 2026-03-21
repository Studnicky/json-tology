import type { LoggerInterface } from '../interfaces/logger.js';

/* eslint-disable @typescript-eslint/no-empty-function -- intentional no-op logger */
/** No-op logger used as default when no logger is provided. */
export const SILENT_LOGGER: LoggerInterface = {
  debug() {},
  error() {},
  fatal() {},
  info() {},
  trace() {},
  warn() {}
};
/* eslint-enable @typescript-eslint/no-empty-function */
