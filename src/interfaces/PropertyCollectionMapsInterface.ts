/**
 * PropertyCollectionMapsInterface — intermediate collection maps produced by the
 * single-pass graph traversal in the Properties dispatcher.
 */

import type { PropertyIndexValueEntity } from '../entities/PropertyIndexValueEntity.js';

export interface PropertyCollectionMapsInterface {
  'domainsByProperty': Map<string, string[]>;
  'inverseOf': Map<string, string[]>;
  'propertyIndex': Map<string, PropertyIndexValueEntity.Type>;
  'rangeByProperty': Map<string, string>;
  'subPropertyOf': Map<string, string[]>;
}
