import { CityNameSchema } from './CityName.js';
import { CountryCodeSchema } from './CountryCode.js';
import { PostalCodeSchema } from './PostalCode.js';
import { StreetLineSchema } from './StreetLine.js';

export const AddressSchema = {
  '$id': 'urn:bookstore:Address',
  'properties': {
    'city': { '$ref': CityNameSchema.$id },
    'country': { '$ref': CountryCodeSchema.$id },
    'postalCode': { '$ref': PostalCodeSchema.$id },
    'street': { '$ref': StreetLineSchema.$id }
  },
  'required': [
    'street',
    'city',
    'postalCode'
  ],
  'type': 'object'
} as const;
