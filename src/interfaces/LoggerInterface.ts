/**
 * Logger interface compatible with Pino and Fastify loggers.
 *
 * All methods accept an optional message followed by additional interpolation
 * arguments, matching the Pino/Fastify call signatures.
 */
export interface LoggerInterface {
  debug(msg: string, ...argumentList: unknown[]): void;
  error(msg: string, ...argumentList: unknown[]): void;
  fatal(msg: string, ...argumentList: unknown[]): void;
  info(msg: string, ...argumentList: unknown[]): void;
  trace(msg: string, ...argumentList: unknown[]): void;
  warn(msg: string, ...argumentList: unknown[]): void;
}
