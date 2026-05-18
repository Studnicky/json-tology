/**
 * ExhaustiveType — Example: Pairing with EnumValuesType for a string
 * enum.
 *
 * Switch over an OrderStatus union derived from an `enum` schema. The
 * default branch uses ExhaustiveType to assert the switch is total.
 * Adding 'refunded' to the schema without a matching case becomes a
 * compile error.
 */

import type {
  EnumValuesType, ExhaustiveType
} from '../../../src/types/index.js';

const _OrderStatusSchema = {
  'enum': [
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled'
  ],
  'type': 'string'
} as const;

type OrderStatus = EnumValuesType<typeof _OrderStatusSchema>;

function describeStatus(status: OrderStatus): string {
  switch (status) {
    case 'cancelled': return 'Order cancelled';
    case 'confirmed': return 'Confirmed, preparing shipment';
    case 'delivered': return 'Delivered';
    case 'pending': return 'Awaiting confirmation';
    case 'shipped': return 'In transit';
    default: {
      // Adding 'refunded' to the enum without a case here becomes a compile error.
      const _: ExhaustiveType<typeof status> = status;

      return _;
    }
  }
}

console.assert(describeStatus('pending') === 'Awaiting confirmation');
console.assert(describeStatus('shipped') === 'In transit');
