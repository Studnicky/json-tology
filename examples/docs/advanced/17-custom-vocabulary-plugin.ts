/**
 * Custom prefixes and vocabulary plugins
 *
 * Define custom vocabulary plugins to emit domain-specific quads
 * beyond the core OWL/SHACL vocabularies.
 */

import { JsonTology } from '../../../src/index.js';
import type { VocabularyPluginInterface } from '../../../src/interfaces/index.js';
import { BookSchema } from '../bookstore/index.js';

const myVocabulary: VocabularyPluginInterface = {
  extractRelations() {
    return [];
  },
  'prefixes': { 'myns': 'https://myorg.io/ns#' },
  project() {
    // Emit custom quads for non-core predicates
  }
};

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [BookSchema] as const,
  'vocabularies': [myVocabulary]
});

const ctx = jt.ontology().context();

console.assert(ctx.myns === 'https://myorg.io/ns#', 'custom prefix registered');
