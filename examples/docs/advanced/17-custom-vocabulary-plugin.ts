/**
 * Custom prefixes and vocabulary plugins
 *
 * Define custom vocabulary plugins to emit domain-specific quads
 * beyond the core OWL/SHACL vocabularies.
 */

import { JsonTology } from 'json-tology';
import type { VocabularyPluginInterface } from 'json-tology/interfaces';
import { BookSchema } from '../bookstore/index.js';

const myVocabulary: VocabularyPluginInterface = {
  extractRelations(_node, _semantics, _graph) {
    return [];
  },
  'prefixes': { 'myns': 'https://myorg.io/ns#' },
  project(_relation, _emit) {
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
