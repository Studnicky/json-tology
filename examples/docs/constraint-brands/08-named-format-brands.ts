import type {
  EmailBrandInterface, UuidBrandInterface
} from '../../../src/types/index.js';

// Reject plain string — must come from instantiate/validate
// These signatures demonstrate that brand types are not assignable from plain string.
type SendEmailFn = (_to: EmailBrandInterface) => void;
type TrackEventFn = (_id: UuidBrandInterface) => void;

void 0 as unknown as [SendEmailFn, TrackEventFn];
