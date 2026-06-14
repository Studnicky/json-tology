/**
 * PropertyCollectionMapsType — intermediate collection maps produced by the
 * single-pass graph traversal in the Properties dispatcher.
 */

import type { PropertyIndexValueType } from './PropertyIndexValueType.js';

export type PropertyCollectionMapsType = {
  readonly 'domainsByProperty': Map<string, string[]>;
  readonly 'inverseOf': Map<string, string[]>;
  readonly 'propertyIndex': Map<string, PropertyIndexValueType>;
  readonly 'rangeByProperty': Map<string, string>;
  readonly 'subPropertyOf': Map<string, string[]>;
};
