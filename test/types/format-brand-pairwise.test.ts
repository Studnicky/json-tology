/* eslint-disable @typescript-eslint/consistent-type-assertions -- type-test phantom values */
/**
 * Compile-time cross-format brand incompatibility assertions.
 *
 * For each of the 18 named format brands:
 *   1. Asserts the brand is assignable to itself (diagonal check).
 *   2. Asserts it is NOT assignable to a distinct partner brand (@ts-expect-error).
 *
 * This covers the audit finding that only 1 of 153 cross-format pairs was
 * previously tested. Each brand is exercised on at least one negative pair,
 * spreading coverage across the full cross-product.
 *
 * No runtime work — compile-time only.
 */

import {
  describe, it
} from 'node:test';

import type {
  BinaryBrandType,
  ByteBrandType,
  DateBrandType,
  DateTimeBrandType,
  DurationBrandType,
  EmailBrandType,
  HostnameBrandType,
  IdnEmailBrandType,
  IdnHostnameBrandType,
  Ipv4BrandType,
  Ipv6BrandType,
  IriBrandType,
  IriReferenceBrandType,
  JsonPointerBrandType,
  RegexBrandType,
  RelativeJsonPointerBrandType,
  TimeBrandType,
  UriBrandType,
  UriReferenceBrandType,
  UriTemplateBrandType,
  UuidBrandType
} from '../../src/types/ConstraintBrands.js';

// ---------------------------------------------------------------------------
// Diagonal: each brand is assignable to itself
// Positive assignability — no assertion helper needed, just a variable assignment.
// ---------------------------------------------------------------------------

const _emailToEmail: EmailBrandType = {} as EmailBrandType;
const _idnEmailToIdnEmail: IdnEmailBrandType = {} as IdnEmailBrandType;
const _uriToUri: UriBrandType = {} as UriBrandType;
const _uriRefToUriRef: UriReferenceBrandType = {} as UriReferenceBrandType;
const _uriTplToUriTpl: UriTemplateBrandType = {} as UriTemplateBrandType;
const _iriToIri: IriBrandType = {} as IriBrandType;
const _iriRefToIriRef: IriReferenceBrandType = {} as IriReferenceBrandType;
const _uuidToUuid: UuidBrandType = {} as UuidBrandType;
const _dateToDate: DateBrandType = {} as DateBrandType;
const _dateTimeToDateTime: DateTimeBrandType = {} as DateTimeBrandType;
const _timeToTime: TimeBrandType = {} as TimeBrandType;
const _durationToDuration: DurationBrandType = {} as DurationBrandType;
const _hostnameToHostname: HostnameBrandType = {} as HostnameBrandType;
const _idnHostnameToIdnHostname: IdnHostnameBrandType = {} as IdnHostnameBrandType;
const _ipv4ToIpv4: Ipv4BrandType = {} as Ipv4BrandType;
const _ipv6ToIpv6: Ipv6BrandType = {} as Ipv6BrandType;
const _regexToRegex: RegexBrandType = {} as RegexBrandType;
const _jsonPointerToJsonPointer: JsonPointerBrandType = {} as JsonPointerBrandType;

void [
  _emailToEmail,
  _idnEmailToIdnEmail,
  _uriToUri,
  _uriRefToUriRef,
  _uriTplToUriTpl,
  _iriToIri,
  _iriRefToIriRef,
  _uuidToUuid,
  _dateToDate,
  _dateTimeToDateTime,
  _timeToTime,
  _durationToDuration,
  _hostnameToHostname,
  _idnHostnameToIdnHostname,
  _ipv4ToIpv4,
  _ipv6ToIpv6,
  _regexToRegex,
  _jsonPointerToJsonPointer
];

// ---------------------------------------------------------------------------
// Negative cross-format pairs: each brand vs. a distinct partner.
// 18 format brands × 1 negative partner each = 18 negative-assignability checks.
// Partners are selected to spread coverage: each brand appears on
// at least one side of at least one negative pair.
//
// All assignments are guarded by `if (false as boolean)` to prevent
// runtime execution while keeping the @ts-expect-error directive active.
// ---------------------------------------------------------------------------

if (false as boolean) {
  // email ← (not) uri
  // @ts-expect-error — EmailBrandType not assignable to UriBrandType
  const _emailToUri: UriBrandType = {} as EmailBrandType;

  void _emailToUri;

  // idn-email ← (not) date
  // @ts-expect-error — IdnEmailBrandType not assignable to DateBrandType
  const _idnEmailToDate: DateBrandType = {} as IdnEmailBrandType;

  void _idnEmailToDate;

  // uri ← (not) uuid
  // @ts-expect-error — UriBrandType not assignable to UuidBrandType
  const _uriToUuid: UuidBrandType = {} as UriBrandType;

  void _uriToUuid;

  // uri-reference ← (not) email
  // @ts-expect-error — UriReferenceBrandType not assignable to EmailBrandType
  const _uriRefToEmail: EmailBrandType = {} as UriReferenceBrandType;

  void _uriRefToEmail;

  // uri-template ← (not) idn-email
  // @ts-expect-error — UriTemplateBrandType not assignable to IdnEmailBrandType
  const _uriTplToIdnEmail: IdnEmailBrandType = {} as UriTemplateBrandType;

  void _uriTplToIdnEmail;

  // iri ← (not) uri-reference
  // @ts-expect-error — IriBrandType not assignable to UriReferenceBrandType
  const _iriToUriRef: UriReferenceBrandType = {} as IriBrandType;

  void _iriToUriRef;

  // iri-reference ← (not) uri-template
  // @ts-expect-error — IriReferenceBrandType not assignable to UriTemplateBrandType
  const _iriRefToUriTpl: UriTemplateBrandType = {} as IriReferenceBrandType;

  void _iriRefToUriTpl;

  // uuid ← (not) iri
  // @ts-expect-error — UuidBrandType not assignable to IriBrandType
  const _uuidToIri: IriBrandType = {} as UuidBrandType;

  void _uuidToIri;

  // date ← (not) date-time
  // @ts-expect-error — DateBrandType not assignable to DateTimeBrandType
  const _dateToDateTime: DateTimeBrandType = {} as DateBrandType;

  void _dateToDateTime;

  // date-time ← (not) time
  // @ts-expect-error — DateTimeBrandType not assignable to TimeBrandType
  const _dateTimeToTime: TimeBrandType = {} as DateTimeBrandType;

  void _dateTimeToTime;

  // time ← (not) duration
  // @ts-expect-error — TimeBrandType not assignable to DurationBrandType
  const _timeToDuration: DurationBrandType = {} as TimeBrandType;

  void _timeToDuration;

  // duration ← (not) hostname
  // @ts-expect-error — DurationBrandType not assignable to HostnameBrandType
  const _durationToHostname: HostnameBrandType = {} as DurationBrandType;

  void _durationToHostname;

  // hostname ← (not) idn-hostname
  // @ts-expect-error — HostnameBrandType not assignable to IdnHostnameBrandType
  const _hostnameToIdnHostname: IdnHostnameBrandType = {} as HostnameBrandType;

  void _hostnameToIdnHostname;

  // idn-hostname ← (not) ipv4
  // @ts-expect-error — IdnHostnameBrandType not assignable to Ipv4BrandType
  const _idnHostnameToIpv4: Ipv4BrandType = {} as IdnHostnameBrandType;

  void _idnHostnameToIpv4;

  // ipv4 ← (not) ipv6
  // @ts-expect-error — Ipv4BrandType not assignable to Ipv6BrandType
  const _ipv4ToIpv6: Ipv6BrandType = {} as Ipv4BrandType;

  void _ipv4ToIpv6;

  // ipv6 ← (not) regex
  // @ts-expect-error — Ipv6BrandType not assignable to RegexBrandType
  const _ipv6ToRegex: RegexBrandType = {} as Ipv6BrandType;

  void _ipv6ToRegex;

  // regex ← (not) json-pointer
  // @ts-expect-error — RegexBrandType not assignable to JsonPointerBrandType
  const _regexToJsonPointer: JsonPointerBrandType = {} as RegexBrandType;

  void _regexToJsonPointer;

  // json-pointer ← (not) relative-json-pointer
  // @ts-expect-error — JsonPointerBrandType not assignable to RelativeJsonPointerBrandType
  const _jsonPointerToRelJsonPointer: RelativeJsonPointerBrandType = {} as JsonPointerBrandType;

  void _jsonPointerToRelJsonPointer;

  // relative-json-pointer ← (not) binary
  // @ts-expect-error — RelativeJsonPointerBrandType not assignable to BinaryBrandType
  const _relJsonPointerToBinary: BinaryBrandType = {} as RelativeJsonPointerBrandType;

  void _relJsonPointerToBinary;

  // binary ← (not) byte
  // @ts-expect-error — BinaryBrandType not assignable to ByteBrandType
  const _binaryToByte: ByteBrandType = {} as BinaryBrandType;

  void _binaryToByte;

  // byte ← (not) email
  // @ts-expect-error — ByteBrandType not assignable to EmailBrandType
  const _byteToEmail: EmailBrandType = {} as ByteBrandType;

  void _byteToEmail;

  // Additional cross-pairs to spread coverage across more combinations:

  // date-time ← (not) uuid
  // @ts-expect-error — DateTimeBrandType not assignable to UuidBrandType
  const _dateTimeToUuid: UuidBrandType = {} as DateTimeBrandType;

  void _dateTimeToUuid;

  // uuid ← (not) date-time
  // @ts-expect-error — UuidBrandType not assignable to DateTimeBrandType
  const _uuidToDateTime: DateTimeBrandType = {} as UuidBrandType;

  void _uuidToDateTime;

  // hostname ← (not) email
  // @ts-expect-error — HostnameBrandType not assignable to EmailBrandType
  const _hostnameToEmail: EmailBrandType = {} as HostnameBrandType;

  void _hostnameToEmail;

  // ipv4 ← (not) hostname
  // @ts-expect-error — Ipv4BrandType not assignable to HostnameBrandType
  const _ipv4ToHostname: HostnameBrandType = {} as Ipv4BrandType;

  void _ipv4ToHostname;

  // iri ← (not) email
  // @ts-expect-error — IriBrandType not assignable to EmailBrandType
  const _iriToEmail: EmailBrandType = {} as IriBrandType;

  void _iriToEmail;

  // iri-reference ← (not) iri
  // @ts-expect-error — IriReferenceBrandType not assignable to IriBrandType
  const _iriRefToIri: IriBrandType = {} as IriReferenceBrandType;

  void _iriRefToIri;

  // duration ← (not) time
  // @ts-expect-error — DurationBrandType not assignable to TimeBrandType
  const _durationToTime: TimeBrandType = {} as DurationBrandType;

  void _durationToTime;

  // date ← (not) time
  // @ts-expect-error — DateBrandType not assignable to TimeBrandType
  const _dateToTime: TimeBrandType = {} as DateBrandType;

  void _dateToTime;

  // binary ← (not) uri
  // @ts-expect-error — BinaryBrandType not assignable to UriBrandType
  const _binaryToUri: UriBrandType = {} as BinaryBrandType;

  void _binaryToUri;

  // byte ← (not) uuid
  // @ts-expect-error — ByteBrandType not assignable to UuidBrandType
  const _byteToUuid: UuidBrandType = {} as ByteBrandType;

  void _byteToUuid;

  // regex ← (not) uri-template
  // @ts-expect-error — RegexBrandType not assignable to UriTemplateBrandType
  const _regexToUriTpl: UriTemplateBrandType = {} as RegexBrandType;

  void _regexToUriTpl;

  // relative-json-pointer ← (not) json-pointer
  // @ts-expect-error — RelativeJsonPointerBrandType not assignable to JsonPointerBrandType
  const _relJsonPointerToJsonPointer: JsonPointerBrandType = {} as RelativeJsonPointerBrandType;

  void _relJsonPointerToJsonPointer;

  // idn-hostname ← (not) idn-email
  // @ts-expect-error — IdnHostnameBrandType not assignable to IdnEmailBrandType
  const _idnHostnameToIdnEmail: IdnEmailBrandType = {} as IdnHostnameBrandType;

  void _idnHostnameToIdnEmail;

  // uri ← (not) email (reverse of email→uri above)
  // @ts-expect-error — UriBrandType not assignable to EmailBrandType
  const _uriToEmail: EmailBrandType = {} as UriBrandType;

  void _uriToEmail;

  // ipv6 ← (not) ipv4 (reverse of ipv4→ipv6 above)
  // @ts-expect-error — Ipv6BrandType not assignable to Ipv4BrandType
  const _ipv6ToIpv4: Ipv4BrandType = {} as Ipv6BrandType;

  void _ipv6ToIpv4;
}

void describe('format brand cross-incompatibility (compile-time only)', () => {
  void it('compiles', () => {
    void 0;
  });
});
