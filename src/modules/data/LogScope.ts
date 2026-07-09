/**
 * Logging scope formatter.
 *
 * House convention: every logger call carries `component` (the originating
 * module or class name) and `operation` (the method name), with
 * `component !== operation`, rendered as a `[Component.operation]` prefix.
 * This keeps logs greppable by origin regardless of the underlying
 * {@link LoggerInterface} implementation, without requiring the interface to
 * support structured (object-first) fields.
 *
 * Level semantics (the six drilldown levels of {@link LoggerInterface}):
 * - `trace` — per-iteration flow inside hot paths (per-schema registration,
 *   per-node dispatch, ref-walk steps). Highest volume; off by default.
 * - `debug` — operation entry/exit in non-trivial methods (quad counts,
 *   parse summaries).
 * - `info` — lifecycle milestones: a compiled validator produced, a TBox
 *   import completed, a materialization finished. One line per phase boundary.
 * - `warn` — recoverable anomalies: duplicate shapes, hash conflicts,
 *   unsupported-but-tolerated constructs, silent fallbacks.
 * - `error` — an operation failed but the caller can handle it; always log
 *   before rethrowing.
 * - `fatal` — process-unrecoverable. This library throws typed errors rather
 *   than terminating, so `fatal` is intentionally unused; it exists only for
 *   {@link LoggerInterface} compatibility with Pino/Fastify.
 */

/**
 * LogScope — renders the `[component.operation]` log prefix.
 */
export class LogScope {
  /**
   * Render a log message prefixed with its originating component and operation.
   *
   * @param component - module or class name (e.g. `"OwlImporter"`)
   * @param operation - method name (e.g. `"import"`); must differ from `component`
   * @param message - the human-readable log message
   * @returns the message prefixed with `[component.operation] `
   */
  public static format(component: string, operation: string, message: string): string {
    const result = `[${component}.${operation}] ${message}`;

    return result;
  }
}
