/** Built-in string format names recognized by json-tology. */
export type StringFormatNameType
  = 'binary'
  | 'byte'
  | 'date'
  | 'date-time'
  | 'duration'
  | 'email'
  | 'hostname'
  | 'idn-email'
  | 'idn-hostname'
  | 'ipv4'
  | 'ipv6'
  | 'iri'
  | 'iri-reference'
  | 'json-pointer'
  | 'regex'
  | 'time'
  | 'uri'
  | 'uri-reference'
  | 'uri-template'
  | 'uuid';

/** Built-in number format names recognized by json-tology. */
export type NumberFormatNameType
  = 'double'
  | 'float'
  | 'int32'
  | 'int64';

/** All built-in format names recognized by json-tology. */
export type BuiltinFormatNameType = NumberFormatNameType | StringFormatNameType;
