export interface ValidationError {
  /** JSON Pointer path to the failing value (e.g. "/name", "" for root) */
  path: string;
  /** Human-readable error message */
  message: string;
  /** AJV keyword that triggered the error (e.g. "required", "type", "format") */
  keyword: string;
  /** Keyword-specific parameters (e.g. { missingProperty: "name" } for required) */
  params: Record<string, unknown>;
}

export interface ValidationResult<T> {
  valid: boolean;
  data?: T;
  errors?: string[];
}
