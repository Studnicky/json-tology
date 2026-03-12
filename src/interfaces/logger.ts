/**
 * Logger interface compatible with Pino and Fastify loggers.
 *
 * All methods accept an optional message followed by additional interpolation
 * arguments, matching the Pino/Fastify call signatures.
 */
export interface LoggerInterface {
  debug(msg: string, ...args: unknown[]): void;
  error(msg: string, ...args: unknown[]): void;
  fatal(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  trace(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
}
