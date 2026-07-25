import type { InferType } from './Schema.js';
import type { PARSED_LITERAL_SCHEMA } from '../constants/SCHEMAS.js';

/** Result of parsing a literal token from an N-Quad line. */
export type ParsedLiteralType = InferType<typeof PARSED_LITERAL_SCHEMA>;
