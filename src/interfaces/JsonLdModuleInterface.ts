import type { FormatOptionsEntity } from '../entities/FormatOptionsEntity.js';

/**
 * JsonLdModuleInterface — optional peerDependency module shape for the jsonld (v8) package.
 *
 * Used by OwlImporter.importAsync() when the caller passes non-quad JSON-LD
 * input that requires a full JSON-LD processor beyond the synchronous compact
 * walker.
 */
export interface JsonLdModuleInterface {
  'toRDF': (document: unknown, options?: FormatOptionsEntity.Type) => Promise<unknown>;
}
