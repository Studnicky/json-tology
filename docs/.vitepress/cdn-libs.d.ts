// Ambient declarations for CDN-only libraries loaded at runtime via esm.sh.
// These are NOT installed as npm dependencies — they are fetched via importOnce().
// Types are modelled as honest chainable interfaces covering the methods actually used.

declare module 'yup' {
  interface YupSchema {
    cast(data: unknown, opts?: unknown): unknown;
    validate(data: unknown, opts?: unknown): Promise<unknown>;
    validateSync(data: unknown, opts?: unknown): unknown;
    noUnknown(): YupSchema;
    required(): YupSchema;
    default(value: unknown): YupSchema;
    uuid(): YupSchema;
    email(): YupSchema;
    strip(): YupSchema;
  }

  export function object(shape?: Record<string, YupSchema>): YupSchema;
  export function string(): YupSchema;
  export function number(): YupSchema;
  export function boolean(): YupSchema;
}

declare module 'joi' {
  interface JoiSchema {
    validate(data: unknown, opts?: unknown): unknown;
    unknown(allow: boolean): JoiSchema;
    required(): JoiSchema;
    uuid(): JoiSchema;
    email(): JoiSchema;
    default(value: unknown): JoiSchema;
  }

  export function object(shape?: Record<string, JoiSchema>): JoiSchema;
  export function string(): JoiSchema;
  export function number(): JoiSchema;
  export function boolean(): JoiSchema;
}
