/**
 * ShaclSeverityType — severity level for a SHACL validation result.
 *
 * Aligned with the SHACL specification:
 * - `Violation` — the constraint is violated (contributes to non-conformance).
 * - `Warning`   — the constraint is not satisfied but does not block conformance.
 * - `Info`      — informational result; no impact on conformance.
 *
 * @category SHACL
 * @since 0.20.0
 * @see {@link https://www.w3.org/TR/shacl/#results-severity SHACL Severity}
 * @group Types
 */
export type ShaclSeverityType = 'Info' | 'Violation' | 'Warning';
