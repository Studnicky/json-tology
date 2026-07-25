/**
 * JsonLdModuleType — optional peerDependency module shape for the jsonld (v8) package.
 *
 * Used by OwlImporter.importAsync() when the caller passes non-quad JSON-LD
 * input that requires a full JSON-LD processor beyond the synchronous compact
 * walker.
 */

import type { IdentityType } from './IdentityType.js';

export type JsonLdModuleType = IdentityType<{
  'toRDF': (document: unknown, options?: { 'format'?: string }) => Promise<unknown>
}>;
