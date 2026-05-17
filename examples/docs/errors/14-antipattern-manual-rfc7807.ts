import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'Too',
  'rating': 6
});

if (!errs.ok) {
  // Anti-pattern: Constructing RFC 7807 manually
  // Don't do this - roll-your-own is fragile and inconsistent
  const problem_wrong = {
    'errors': errs.items.map((err) => {
      return {
        'error': err.message,
        'field': err.path
      };
    }),
    'status': 422,
    'type': 'validation-error'
  };

  // Correct approach: use report() for RFC 7807 compliance
  const problem = errs.report({ 'instance': '/reviews' });

  console.assert(
    problem.type === 'https://json-tology.dev/problems/validation',
    'Should use standard problem type'
  );
  console.assert(
    problem.status === 422,
    'Should have correct status'
  );
  console.assert(
    Array.isArray(problem.errors) && problem.errors.length > 0,
    'Should have errors array with standard structure'
  );
}
