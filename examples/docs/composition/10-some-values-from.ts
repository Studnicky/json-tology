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

console.log('AuthoredBook schema $id:', AuthoredBookSchema.$id);
console.log('someValuesFrom restriction on authoredBy:', (AuthoredBookSchema as Record<string, unknown>)['jt:restrictions']);
