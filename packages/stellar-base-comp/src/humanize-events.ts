/**
 * humanizeEvents — convert raw XDR contract events to human-readable format.
 * Compatible with js-stellar-base.
 */

import { is } from '@stellar/xdr';

export interface SorobanEvent {
  type: string;
  contractId?: string;
  topics: any[];
  data: any;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert raw XDR DiagnosticEvent[] or ContractEvent[] into human-readable SorobanEvent[].
 */
export function humanizeEvents(events: any[]): SorobanEvent[] {
  return events.map((event) => {
    // Handle DiagnosticEvent wrapper
    const contractEvent = event.event ? event.event : event;

    // Get event type
    let type = 'contract';
    if (contractEvent.type !== undefined) {
      if (typeof contractEvent.type === 'number') {
        type = contractEvent.type === 0 ? 'system' : contractEvent.type === 1 ? 'contract' : 'diagnostic';
      } else if (typeof contractEvent.type === 'string') {
        type = contractEvent.type;
      }
    }

    // Get contract ID
    let contractId: string | undefined;
    if (contractEvent.contractID) {
      contractId = bytesToHex(contractEvent.contractID);
    } else if (contractEvent.contractId) {
      contractId = typeof contractEvent.contractId === 'string'
        ? contractEvent.contractId
        : bytesToHex(contractEvent.contractId);
    }

    // Get topics and data from the event body
    let topics: any[] = [];
    let data: any = null;
    const body = contractEvent.body;
    if (body) {
      if (is(body, 'V0')) {
        topics = body.V0.topics ?? [];
        data = body.V0.data ?? null;
      } else if (body.v0) {
        topics = body.v0.topics ?? [];
        data = body.v0.data ?? null;
      } else if (body.topics) {
        topics = body.topics;
        data = body.data ?? null;
      }
    }

    return { type, contractId, topics, data };
  });
}
