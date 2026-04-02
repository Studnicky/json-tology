import type { LoggerInterface } from '../interfaces/Logger.js';

/** No-op logger used as default when no logger is provided. */
export const SILENT_LOGGER: LoggerInterface = {
  'debug': (_: string) => {
    return void 0;
  },
  'error': (_: string) => {
    return void 0;
  },
  'fatal': (_: string) => {
    return void 0;
  },
  'info': (_: string) => {
    return void 0;
  },
  'trace': (_: string) => {
    return void 0;
  },
  'warn': (_: string) => {
    return void 0;
  }
};
