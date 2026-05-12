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
  BinaryBrandInterface,
  ByteBrandInterface,
  DateBrandInterface,
  DateTimeBrandInterface,
  DoubleBrandInterface,
  DurationBrandInterface,
  EmailBrandInterface,
  FloatBrandInterface,
  HostnameBrandInterface,
  IdnEmailBrandInterface,
  IdnHostnameBrandInterface,
  Int32BrandInterface,
  Int64BrandInterface,
  Ipv4BrandInterface,
  Ipv6BrandInterface,
  IriBrandInterface,
  IriReferenceBrandInterface,
  JsonPointerBrandInterface,
  RegexBrandInterface,
  RelativeJsonPointerBrandInterface,
  TimeBrandInterface,
  UriBrandInterface,
  UriReferenceBrandInterface,
  UriTemplateBrandInterface,
  UuidBrandInterface
} from '../../src/types/ConstraintBrands.js';

// ---------------------------------------------------------------------------
// Diagonal: each brand is assignable to itself
// Positive assignability — no assertion helper needed, just a variable assignment.
// ---------------------------------------------------------------------------

const _emailToEmail: EmailBrandInterface = {} as EmailBrandInterface;
const _idnEmailToIdnEmail: IdnEmailBrandInterface = {} as IdnEmailBrandInterface;
const _uriToUri: UriBrandInterface = {} as UriBrandInterface;
const _uriRefToUriRef: UriReferenceBrandInterface = {} as UriReferenceBrandInterface;
const _uriTplToUriTpl: UriTemplateBrandInterface = {} as UriTemplateBrandInterface;
const _iriToIri: IriBrandInterface = {} as IriBrandInterface;
const _iriRefToIriRef: IriReferenceBrandInterface = {} as IriReferenceBrandInterface;
const _uuidToUuid: UuidBrandInterface = {} as UuidBrandInterface;
const _dateToDate: DateBrandInterface = {} as DateBrandInterface;
const _dateTimeToDateTime: DateTimeBrandInterface = {} as DateTimeBrandInterface;
const _timeToTime: TimeBrandInterface = {} as TimeBrandInterface;
const _durationToDuration: DurationBrandInterface = {} as DurationBrandInterface;
const _hostnameToHostname: HostnameBrandInterface = {} as HostnameBrandInterface;
const _idnHostnameToIdnHostname: IdnHostnameBrandInterface = {} as IdnHostnameBrandInterface;
const _ipv4ToIpv4: Ipv4BrandInterface = {} as Ipv4BrandInterface;
const _ipv6ToIpv6: Ipv6BrandInterface = {} as Ipv6BrandInterface;
const _regexToRegex: RegexBrandInterface = {} as RegexBrandInterface;
const _jsonPointerToJsonPointer: JsonPointerBrandInterface = {} as JsonPointerBrandInterface;

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
  // @ts-expect-error — EmailBrandInterface not assignable to UriBrandInterface
  const _emailToUri: UriBrandInterface = {} as EmailBrandInterface;

  void _emailToUri;

  // idn-email ← (not) date
  // @ts-expect-error — IdnEmailBrandInterface not assignable to DateBrandInterface
  const _idnEmailToDate: DateBrandInterface = {} as IdnEmailBrandInterface;

  void _idnEmailToDate;

  // uri ← (not) uuid
  // @ts-expect-error — UriBrandInterface not assignable to UuidBrandInterface
  const _uriToUuid: UuidBrandInterface = {} as UriBrandInterface;

  void _uriToUuid;

  // uri-reference ← (not) email
  // @ts-expect-error — UriReferenceBrandInterface not assignable to EmailBrandInterface
  const _uriRefToEmail: EmailBrandInterface = {} as UriReferenceBrandInterface;

  void _uriRefToEmail;

  // uri-template ← (not) idn-email
  // @ts-expect-error — UriTemplateBrandInterface not assignable to IdnEmailBrandInterface
  const _uriTplToIdnEmail: IdnEmailBrandInterface = {} as UriTemplateBrandInterface;

  void _uriTplToIdnEmail;

  // iri ← (not) uri-reference
  // @ts-expect-error — IriBrandInterface not assignable to UriReferenceBrandInterface
  const _iriToUriRef: UriReferenceBrandInterface = {} as IriBrandInterface;

  void _iriToUriRef;

  // iri-reference ← (not) uri-template
  // @ts-expect-error — IriReferenceBrandInterface not assignable to UriTemplateBrandInterface
  const _iriRefToUriTpl: UriTemplateBrandInterface = {} as IriReferenceBrandInterface;

  void _iriRefToUriTpl;

  // uuid ← (not) iri
  // @ts-expect-error — UuidBrandInterface not assignable to IriBrandInterface
  const _uuidToIri: IriBrandInterface = {} as UuidBrandInterface;

  void _uuidToIri;

  // date ← (not) date-time
  // @ts-expect-error — DateBrandInterface not assignable to DateTimeBrandInterface
  const _dateToDateTime: DateTimeBrandInterface = {} as DateBrandInterface;

  void _dateToDateTime;

  // date-time ← (not) time
  // @ts-expect-error — DateTimeBrandInterface not assignable to TimeBrandInterface
  const _dateTimeToTime: TimeBrandInterface = {} as DateTimeBrandInterface;

  void _dateTimeToTime;

  // time ← (not) duration
  // @ts-expect-error — TimeBrandInterface not assignable to DurationBrandInterface
  const _timeToDuration: DurationBrandInterface = {} as TimeBrandInterface;

  void _timeToDuration;

  // duration ← (not) hostname
  // @ts-expect-error — DurationBrandInterface not assignable to HostnameBrandInterface
  const _durationToHostname: HostnameBrandInterface = {} as DurationBrandInterface;

  void _durationToHostname;

  // hostname ← (not) idn-hostname
  // @ts-expect-error — HostnameBrandInterface not assignable to IdnHostnameBrandInterface
  const _hostnameToIdnHostname: IdnHostnameBrandInterface = {} as HostnameBrandInterface;

  void _hostnameToIdnHostname;

  // idn-hostname ← (not) ipv4
  // @ts-expect-error — IdnHostnameBrandInterface not assignable to Ipv4BrandInterface
  const _idnHostnameToIpv4: Ipv4BrandInterface = {} as IdnHostnameBrandInterface;

  void _idnHostnameToIpv4;

  // ipv4 ← (not) ipv6
  // @ts-expect-error — Ipv4BrandInterface not assignable to Ipv6BrandInterface
  const _ipv4ToIpv6: Ipv6BrandInterface = {} as Ipv4BrandInterface;

  void _ipv4ToIpv6;

  // ipv6 ← (not) regex
  // @ts-expect-error — Ipv6BrandInterface not assignable to RegexBrandInterface
  const _ipv6ToRegex: RegexBrandInterface = {} as Ipv6BrandInterface;

  void _ipv6ToRegex;

  // regex ← (not) json-pointer
  // @ts-expect-error — RegexBrandInterface not assignable to JsonPointerBrandInterface
  const _regexToJsonPointer: JsonPointerBrandInterface = {} as RegexBrandInterface;

  void _regexToJsonPointer;

  // json-pointer ← (not) relative-json-pointer
  // @ts-expect-error — JsonPointerBrandInterface not assignable to RelativeJsonPointerBrandInterface
  const _jsonPointerToRelJsonPointer: RelativeJsonPointerBrandInterface = {} as JsonPointerBrandInterface;

  void _jsonPointerToRelJsonPointer;

  // relative-json-pointer ← (not) binary
  // @ts-expect-error — RelativeJsonPointerBrandInterface not assignable to BinaryBrandInterface
  const _relJsonPointerToBinary: BinaryBrandInterface = {} as RelativeJsonPointerBrandInterface;

  void _relJsonPointerToBinary;

  // binary ← (not) byte
  // @ts-expect-error — BinaryBrandInterface not assignable to ByteBrandInterface
  const _binaryToByte: ByteBrandInterface = {} as BinaryBrandInterface;

  void _binaryToByte;

  // byte ← (not) email
  // @ts-expect-error — ByteBrandInterface not assignable to EmailBrandInterface
  const _byteToEmail: EmailBrandInterface = {} as ByteBrandInterface;

  void _byteToEmail;

  // Additional cross-pairs to spread coverage across more combinations:

  // date-time ← (not) uuid
  // @ts-expect-error — DateTimeBrandInterface not assignable to UuidBrandInterface
  const _dateTimeToUuid: UuidBrandInterface = {} as DateTimeBrandInterface;

  void _dateTimeToUuid;

  // uuid ← (not) date-time
  // @ts-expect-error — UuidBrandInterface not assignable to DateTimeBrandInterface
  const _uuidToDateTime: DateTimeBrandInterface = {} as UuidBrandInterface;

  void _uuidToDateTime;

  // hostname ← (not) email
  // @ts-expect-error — HostnameBrandInterface not assignable to EmailBrandInterface
  const _hostnameToEmail: EmailBrandInterface = {} as HostnameBrandInterface;

  void _hostnameToEmail;

  // ipv4 ← (not) hostname
  // @ts-expect-error — Ipv4BrandInterface not assignable to HostnameBrandInterface
  const _ipv4ToHostname: HostnameBrandInterface = {} as Ipv4BrandInterface;

  void _ipv4ToHostname;

  // iri ← (not) email
  // @ts-expect-error — IriBrandInterface not assignable to EmailBrandInterface
  const _iriToEmail: EmailBrandInterface = {} as IriBrandInterface;

  void _iriToEmail;

  // iri-reference ← (not) iri
  // @ts-expect-error — IriReferenceBrandInterface not assignable to IriBrandInterface
  const _iriRefToIri: IriBrandInterface = {} as IriReferenceBrandInterface;

  void _iriRefToIri;

  // duration ← (not) time
  // @ts-expect-error — DurationBrandInterface not assignable to TimeBrandInterface
  const _durationToTime: TimeBrandInterface = {} as DurationBrandInterface;

  void _durationToTime;

  // date ← (not) time
  // @ts-expect-error — DateBrandInterface not assignable to TimeBrandInterface
  const _dateToTime: TimeBrandInterface = {} as DateBrandInterface;

  void _dateToTime;

  // binary ← (not) uri
  // @ts-expect-error — BinaryBrandInterface not assignable to UriBrandInterface
  const _binaryToUri: UriBrandInterface = {} as BinaryBrandInterface;

  void _binaryToUri;

  // byte ← (not) uuid
  // @ts-expect-error — ByteBrandInterface not assignable to UuidBrandInterface
  const _byteToUuid: UuidBrandInterface = {} as ByteBrandInterface;

  void _byteToUuid;

  // regex ← (not) uri-template
  // @ts-expect-error — RegexBrandInterface not assignable to UriTemplateBrandInterface
  const _regexToUriTpl: UriTemplateBrandInterface = {} as RegexBrandInterface;

  void _regexToUriTpl;

  // relative-json-pointer ← (not) json-pointer
  // @ts-expect-error — RelativeJsonPointerBrandInterface not assignable to JsonPointerBrandInterface
  const _relJsonPointerToJsonPointer: JsonPointerBrandInterface = {} as RelativeJsonPointerBrandInterface;

  void _relJsonPointerToJsonPointer;

  // idn-hostname ← (not) idn-email
  // @ts-expect-error — IdnHostnameBrandInterface not assignable to IdnEmailBrandInterface
  const _idnHostnameToIdnEmail: IdnEmailBrandInterface = {} as IdnHostnameBrandInterface;

  void _idnHostnameToIdnEmail;

  // uri ← (not) email (reverse of email→uri above)
  // @ts-expect-error — UriBrandInterface not assignable to EmailBrandInterface
  const _uriToEmail: EmailBrandInterface = {} as UriBrandInterface;

  void _uriToEmail;

  // ipv6 ← (not) ipv4 (reverse of ipv4→ipv6 above)
  // @ts-expect-error — Ipv6BrandInterface not assignable to Ipv4BrandInterface
  const _ipv6ToIpv4: Ipv4BrandInterface = {} as Ipv6BrandInterface;

  void _ipv6ToIpv4;
}

void describe('format brand cross-incompatibility (compile-time only)', () => {
  void it('compiles', () => {
    void 0;
  });
});
