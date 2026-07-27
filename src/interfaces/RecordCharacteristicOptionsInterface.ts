/**
 * RecordCharacteristicOptionsInterface — options for recording one characteristic tuple
 * into the fragment in the Characteristics dispatcher.
 */

import type { OwlImportContextInterface } from './OwlImportContextInterface.js';
import type { OwlImportFragmentInterface } from './OwlImportFragmentInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

export interface RecordCharacteristicOptionsInterface {
  'characteristicName': StringValueEntity.Type;
  'characteristicTarget': StringValueEntity.Type;
  'ctx': OwlImportContextInterface;
  'fragment': OwlImportFragmentInterface;
  'propertyIri': StringValueEntity.Type;
  'seen': Set<string>;
}
