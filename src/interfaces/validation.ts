export interface ValidationError {
  /** Schema keyword that triggered the error (e.g. "required", "type", "format") */
  'keyword': string;
  /** Human-readable error message */
  'message': string;
  /** Keyword-specific parameters (e.g. { missingProperty: "name" } for required) */
  'params': Record<string, unknown>;
  /** JSON Pointer path to the failing value (e.g. "/name", "" for root) */
  'path': string;
}

export interface ValidationResult<T> {
  'data'?: T;
  'errors'?: string[];
  'valid': boolean;
}
