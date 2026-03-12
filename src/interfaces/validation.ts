export interface ValidationResultInterface<T> {
  'data'?: T;
  'errors'?: string[];
  'valid': boolean;
}
