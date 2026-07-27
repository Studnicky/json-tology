import type { InferType } from '../types/Schema.js';
import type { LoggerInterface } from './LoggerInterface.js';
import type { OWL_IMPORTER_OPTIONS_SCHEMA } from '../constants/SCHEMAS.js';

/**
 * Options accepted by the {@link OwlImporter} constructor.
 *
 * @remarks
 * `baseIri` anchors relative IRIs during the import session.
 * `prefixes` extends the default `STANDARD_PREFIXES` map with project-specific
 * prefix bindings used to compact and expand IRIs throughout the import pipeline.
 *
 * A behavioral contract, not schema-derived pure data — it carries an optional
 * {@link LoggerInterface} service reference alongside the schema-expressible
 * `baseIri`/`prefixes` fields, so it is authored as an interface extending the
 * schema-derived base rather than a `type`.
 *
 * @example
 * ```ts
 * const importer = new OwlImporter({ baseIri: 'https://example.com/', prefixes: { ex: 'https://example.com/' } });
 * ```
 *
 * @category OWL Import
 * @since 0.15.0
 * @see {@link OwlImportContextInterface}
 * @group Import
 */
export interface OwlImporterOptionsInterface extends InferType<typeof OWL_IMPORTER_OPTIONS_SCHEMA> {
  /** Optional logger; defaults to SILENT_LOGGER. */
  'logger'?: LoggerInterface;
}
