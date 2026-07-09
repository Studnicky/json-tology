/**
 * RecordCharacteristicOptionsType — options for recording one characteristic tuple
 * into the fragment in the Characteristics dispatcher.
 */

import type {
  OwlImportContextType, OwlImportFragmentType
} from './OwlImport.js';

export type RecordCharacteristicOptionsType = {
  'characteristicName': string;
  'characteristicTarget': string;
  'ctx': OwlImportContextType;
  'fragment': OwlImportFragmentType;
  'propertyIri': string;
  'seen': Set<string>;
};
