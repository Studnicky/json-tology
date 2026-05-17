import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Too',
  'rating': 6
});

if (!errs.ok) {
  const problem = errs.report({
    'status': 400,
    'title': 'Review submission failed',
    'type': 'https://api.bookstore.example/problems/validation'
  });

  console.assert(
    problem.type === 'https://api.bookstore.example/problems/validation',
    'Custom type should be set'
  );
  console.assert(
    problem.title === 'Review submission failed',
    'Custom title should be set'
  );
  console.assert(
    problem.status === 400,
    'Custom status should be set'
  );
}
