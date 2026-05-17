import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

// Simulated request handler
function handleReviewSubmission(req: { 'body': unknown;
  'url': string }) {
  const errs = bookstoreEntities.validate(ReviewSchema.$id, req.body);

  if (!errs.ok) {
    return {
      'body': errs.report({ 'instance': req.url }),
      'contentType': 'application/problem+json',
      'status': 422
    };
  }

  const review = bookstoreEntities.instantiate(ReviewSchema.$id, req.body);

  return {
    'body': review,
    'status': 201
  };
}

// Test with invalid data
const response = handleReviewSubmission({
  'body': {
    'body': 'Short',
    'rating': 6
  },
  'url': '/reviews'
});

console.assert(response.status === 422, 'Invalid review should return 422');
console.assert(
  response.contentType === 'application/problem+json',
  'Response should be problem+json'
);
if ('body' in response && typeof response.body === 'object' && response.body !== null) {
  const problem = response.body as Record<string, unknown>;

  console.assert(problem.status === 422, 'Problem should have 422 status');
  console.assert(Array.isArray(problem.errors), 'Problem should have errors array');
}
