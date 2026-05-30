/**
 * Custom prefixes and vocabulary plugins
 *
 * Define custom vocabulary plugins to emit domain-specific quads
 * beyond the core OWL/SHACL vocabularies. Register the plugin prefix
 * via the `prefixes` option so it appears in the OntologyBuilder context.
 */

import { JsonTology } from '../../../src/index.js';
import type { VocabularyPluginInterface } from '../../../src/interfaces/index.js';
import { BookSchema } from '../bookstore/index.js';

const MY_NS = 'https://myorg.io/ns#';

const myVocabulary: VocabularyPluginInterface = {
  extractRelations() {
    return [];
  },
  'prefixes': { 'myns': MY_NS },
  project() {
    // Emit custom quads for non-core predicates
  }
};

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  // prefixes must be declared here to appear in OntologyBuilder.context()
  'prefixes': { 'myns': MY_NS },
  'schemas': [BookSchema] as const,
  'vocabularies': [myVocabulary]
});

const ctx = jt.ontology().context();

console.assert(ctx.myns === MY_NS, 'custom prefix registered');
console.log('custom prefix in context:', ctx.myns);
