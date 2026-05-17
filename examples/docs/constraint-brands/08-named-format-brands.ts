import type {
  EmailBrandInterface, UuidBrandInterface
} from '../../../src/types/index.js';

// Reject plain string — must come from instantiate/validate
function send(to: EmailBrandInterface): void {}

function track(id: UuidBrandInterface): void {}

void 0 as unknown as [send, track];
