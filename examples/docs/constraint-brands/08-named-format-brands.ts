import type {
  EmailBrandInterface, UuidBrandInterface
} from '../../../src/types/index.js';

// Reject plain string — must come from instantiate/validate
function sendEmail(_to: EmailBrandInterface): void {
  // type-level demo — no runtime body needed
}

function trackEvent(_id: UuidBrandInterface): void {
  // type-level demo — no runtime body needed
}

void 0 as unknown as [typeof sendEmail, typeof trackEvent];
