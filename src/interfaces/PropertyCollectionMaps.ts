/**
 * PropertyCollectionMaps — intermediate collection maps produced by the
 * single-pass graph traversal in the Properties dispatcher.
 */

import type { PropertyIndexValue } from './PropertyIndexValue.js';

export interface PropertyCollectionMaps {
  readonly 'domainsByProperty': Map<string, string[]>;
  readonly 'inverseOf': Map<string, string[]>;
  readonly 'propertyIndex': Map<string, PropertyIndexValue>;
  readonly 'rangeByProperty': Map<string, string>;
  readonly 'subPropertyOf': Map<string, string[]>;
}
