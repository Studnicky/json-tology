/**
 * PropertyIndexValue — the value shape stored in the property index map
 * during the Properties dispatcher graph traversal.
 */

export interface PropertyIndexValue {
  'domains': string[];
  'inverseOf': string[];
  'range': null | string;
  'subPropertyOf': string[];
  'type': 'datatype' | 'object'
}
