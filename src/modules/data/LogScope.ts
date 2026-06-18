/**
 * Logging scope formatter.
 *
 * House convention: every logger call carries `component` (the originating
 * module or class name) and `operation` (the method name), with
 * `component !== operation`, rendered as a `[Component.operation]` prefix.
 * This keeps logs greppable by origin regardless of the underlying
 * {@link LoggerInterface} implementation, without requiring the interface to
 * support structured (object-first) fields.
 */

/**
 * Render a log message prefixed with its originating component and operation.
 *
 * @param component - module or class name (e.g. `"OwlImporter"`)
 * @param operation - method name (e.g. `"import"`); must differ from `component`
 * @param message - the human-readable log message
 * @returns the message prefixed with `[component.operation] `
 */
export function logScope(component: string, operation: string, message: string): string {
  return `[${component}.${operation}] ${message}`;
}
