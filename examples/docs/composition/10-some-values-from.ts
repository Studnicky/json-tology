import { Compose } from '../../../src/index.js';

const AUTHORED_BY = 'https://bookstore.example/authoredBy';
const AUTHOR_IRI = 'https://bookstore.example/Author';

const AuthoredBookSchema = Compose.subClassOf(
  Compose.someValuesFrom(AUTHORED_BY, AUTHOR_IRI),
  {
    '$id': 'https://bookstore.example/AuthoredBook',
    'type': 'object'
  } as const
);

// TypeScript narrows the authored-by property to a non-empty tuple at compile time
void 0 as unknown as typeof AuthoredBookSchema;
