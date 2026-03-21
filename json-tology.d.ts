/**
 * json-tology type configuration — strictest settings (all brands enabled).
 *
 * This project dogfoods its own constraint branding system. All categories
 * are enabled, matching the library defaults. Every JSON Schema constraint
 * keyword surfaces as a compile-time phantom brand, enforcing that
 * constrained values can only be obtained through the validation API.
 *
 * Consumers copy this file to their project root and set flags to false
 * to disable specific brand categories:
 *
 *   interface JsonTologyTypeConfigInterface {
 *     formatBrands: false;   // plain string, no format brand
 *     numericBrands: false;  // plain number, no min/max brands
 *   }
 *
 * The file must be within tsconfig's `include` path.
 * See docs/constraint-brands.md for the full reference.
 */
declare module 'json-tology/types' {
  interface JsonTologyTypeConfigInterface {
    arrayBrands: true;
    brands: true;
    contentBrands: true;
    formatBrands: true;
    nominalBrands: true;
    numericBrands: true;
    objectBrands: true;
    stringBrands: true;
  }
}
