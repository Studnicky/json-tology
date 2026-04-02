const FORMAT_PATTERN_EMAIL = '^\\S+@\\S+\\.\\S+$';
const FORMAT_PATTERN_HOSTNAME = '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$';
const FORMAT_PATTERN_IPV4 = '^(\\d{1,3}\\.){3}\\d{1,3}$';
const FORMAT_PATTERN_IPV6 = '^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$';
const FORMAT_PATTERN_JSON_POINTER = '^(/[^/]*)*$';
const FORMAT_PATTERN_RELATIVE_JSON_POINTER = '^[0-9]+(#|(/[^/]*)*)$';
const FORMAT_PATTERN_UUID = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export const URI_SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:/iu;

export const FORMAT_PATTERNS: Record<string, string> = {
  'email': FORMAT_PATTERN_EMAIL,
  'hostname': FORMAT_PATTERN_HOSTNAME,
  'idn-email': FORMAT_PATTERN_EMAIL,
  'ipv4': FORMAT_PATTERN_IPV4,
  'ipv6': FORMAT_PATTERN_IPV6,
  'json-pointer': FORMAT_PATTERN_JSON_POINTER,
  'relative-json-pointer': FORMAT_PATTERN_RELATIVE_JSON_POINTER,
  'uuid': FORMAT_PATTERN_UUID
};
