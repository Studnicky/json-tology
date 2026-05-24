/**
 * Error constructor option bags.
 *
 * Required args remain positional on each error class. Optional / override
 * fields are folded into a single options object passed as the last
 * parameter so the constructor surface stays stable as fields evolve.
 */

export interface BaseErrorOptionsType {
  'cause'?: Error;
  'retryable'?: boolean;
}

export interface SchemaErrorOptionsType {
  'cause'?: Error;
  'schemaId'?: string;
}

export interface GraphErrorOptionsType {
  'cause'?: Error;
  'pointer'?: string;
}
