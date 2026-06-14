/**
 * RecordCharacteristicOptionsType — options for recording one characteristic tuple
 * into the fragment in the Characteristics dispatcher.
 */

import type {
  OwlImportContextType, OwlImportFragmentType
} from './OwlImport.js';

export type RecordCharacteristicOptionsType = {
  readonly 'characteristicName': string;
  readonly 'characteristicTarget': string;
  readonly 'ctx': OwlImportContextType;
  readonly 'fragment': OwlImportFragmentType;
  readonly 'propertyIri': string;
  readonly 'seen': Set<string>;
};
