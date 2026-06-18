import {
  Compose, JsonTology
} from '../../../src/index.js';

const PARENT = 'https://bookstore.example/parent';

const PersonWithExactlyTwoParents = Compose.subClassOf(
  Compose.cardinality(PARENT, 2),
  {
    '$id': 'https://bookstore.example/PersonWithExactlyTwoParents',
    'type': 'object'
  } as const
);

// doc example with synthetic fixture schemas (strict-graph default does not throw because no inline duplicates)
const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'schemas': [PersonWithExactlyTwoParents] as const
});

console.log(jt.toTbox().jsonLd());
// {
//   "@id": "https://bookstore.example/PersonWithExactlyTwoParents",
//   "@type": "owl:Class",
//   "rdfs:subClassOf": [{
//     "@type": "owl:Restriction",
//     "owl:onProperty": { "@id": "https://bookstore.example/parent" },
//     "owl:cardinality": 2
//   }]
// }
