import { Compose } from '../../../src/index.js';

const AUTHORED_BY = 'https://bookstore.example/authoredBy';
const AUTHOR_IRI = 'https://bookstore.example/Author';

const VerifiedAuthoredBook = Compose.subClassOf(
  Compose.minCardinality(AUTHORED_BY, 1),
  Compose.subClassOf(
    Compose.allValuesFrom(AUTHORED_BY, AUTHOR_IRI),
    {
      '$id': 'https://bookstore.example/VerifiedAuthoredBook',
      'type': 'object'
    } as const
  )
);

// TBox carries two owl:Restriction blank nodes on rdfs:subClassOf
void 0 as unknown as typeof VerifiedAuthoredBook;
