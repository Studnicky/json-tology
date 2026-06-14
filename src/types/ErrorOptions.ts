/**
 * Error constructor option bags.
 *
 * Required args remain positional on each error class. Optional / override
 * fields are folded into a single options object passed as the last
 * parameter so the constructor surface stays stable as fields evolve.
 */

export type BaseErrorOptionsType = {
  'cause'?: Error;
  'retryable'?: boolean;
};

export type SchemaErrorOptionsType = {
  'cause'?: Error;
  'schemaId'?: string;
};

export type GraphErrorOptionsType = {
  'cause'?: Error;
  'pointer'?: string;
};
