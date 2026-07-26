import type { StringValueEntity } from '../entities/StringValueEntity.js';

/**
 * A prefix-to-IRI map, identical in structure to the prefixes accepted by
 * JsonTology and Curie — a plain string-keyed lookup.
 *
 * @remarks
 * Used throughout the import pipeline to compactify and expand IRIs. The
 * `STANDARD_PREFIXES` constant provides the default set; project-specific
 * prefixes are merged on top via `OwlImporterOptionsInterface.prefixes`.
 *
 * Authored as an interface with a `readonly` index signature rather than a
 * `Record<string, string>` type alias: `Record` is itself a generic mapped-type
 * alias in the TypeScript standard library, so a bare top-level reference to it
 * carries type-function computation that the codebase's alias-purity rule
 * treats as a behavioral contract, not schema-derived data. The `readonly`
 * modifier also reflects this map's actual usage — it is built once per import
 * session and never mutated by any dispatcher. `@typescript-eslint/consistent-
 * indexed-object-style` is disabled for this file at the config level (see
 * `eslint.config.mjs`), matching `JsonTologyTypeConfigInterface.ts`'s precedent:
 * that rule's preferred `Record<string, string>` form is exactly the alias-
 * purity violation this interface exists to avoid.
 *
 * @example
 * ```ts
 * const prefixes: PrefixMapInterface = { schema: 'https://schema.org/', ex: 'https://example.com/' };
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImporterOptionsInterface}
 * @group Import
 */
export interface PrefixMapInterface {
  readonly [key: string]: StringValueEntity.Type;
}
