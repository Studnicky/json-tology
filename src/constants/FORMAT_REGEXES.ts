export const IPV6_FULL = /^[\da-f]{1,4}(?::[\da-f]{1,4}){7}$/iu;
export const IPV6_WITH_DOUBLE_COLON = /^(?:[\da-f]{1,4}:){0,7}:(?:[\da-f]{1,4}:){0,6}[\da-f]{0,4}$/iu;
export const IPV6_MIXED = /^(?:[\da-f]{1,4}:){6}(?:\d{1,3}\.){3}\d{1,3}$/iu;
export const IPV6_MIXED_COMPRESSED = /^::(?:[\da-f]{1,4}:){0,5}(?:\d{1,3}\.){3}\d{1,3}$/iu;
