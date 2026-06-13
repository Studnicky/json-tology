/**
 * RecordCharacteristicOptions — options for recording one characteristic tuple
 * into the fragment in the Characteristics dispatcher.
 */

import type {
  OwlImportContext, OwlImportFragment
} from './OwlImport.js';

export interface RecordCharacteristicOptions {
  readonly 'characteristicName': string;
  readonly 'characteristicTarget': string;
  readonly 'ctx': OwlImportContext;
  readonly 'fragment': OwlImportFragment;
  readonly 'propertyIri': string;
  readonly 'seen': Set<string>;
}
