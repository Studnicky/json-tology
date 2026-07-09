/**
 * PropertyCollectionMapsType — intermediate collection maps produced by the
 * single-pass graph traversal in the Properties dispatcher.
 */

import type { PropertyIndexValueType } from './PropertyIndexValueType.js';

export type PropertyCollectionMapsType = {
  'domainsByProperty': Map<string, string[]>;
  'inverseOf': Map<string, string[]>;
  'propertyIndex': Map<string, PropertyIndexValueType>;
  'rangeByProperty': Map<string, string>;
  'subPropertyOf': Map<string, string[]>;
};
