import type { ExecContextInterface } from '../interfaces/ExecContextInterface.js';

/**
 * At least one key of `T` promoted to required, the rest left optional —
 * one union member per key, mirroring `T`'s own field types exactly.
 */
type RequireAtLeastOneType<T> = { [K in keyof T]: Partial<Omit<T, K>> & Required<Pick<T, K>>; }[keyof T];

/**
 * Explicit overrides accepted by `ExecContext.build()` — every field of
 * {@link ExecContextInterface}, individually optional, at least one present.
 *
 * @remarks
 * A TypeScript `interface` cannot express a union, so this stays a `type`.
 * Built via {@link RequireAtLeastOneType} over `ExecContextInterface` rather
 * than a hand-spelled N-way union — identical semantics (one variant per
 * field promoted to required) without repeating all fourteen fields per
 * variant. Modeled as an N-way union (one variant per field promoted to
 * required) rather than a single all-optional literal, so the type isn't
 * structurally subsumed by any unrelated all-optional shape (see
 * {@link ProblemDetailsOverridesEntity.Type}).
 *
 * No schema-derived remedy exists either: `ExecContextInterface` itself
 * carries `Set<string>` / `Set<number>` execution state, which is not
 * JSON-representable, so there is no `Entity.Schema` for this mapped type
 * to be built from (contrast {@link ProblemDetailsOverridesEntity}, whose
 * source fields are all JSON-primitive).
 */
export type ExecContextOverridesType = RequireAtLeastOneType<ExecContextInterface>;
