/**
 * SorobanRpc.Api response types — mirrors the official @stellar/stellar-sdk typings.
 */

export interface GetHealthResponse {
  status: string;
  latestLedger: number;
  oldestLedger: number;
  ledgerRetentionWindow: number;
}

export interface GetNetworkResponse {
  friendbotUrl?: string;
  passphrase: string;
  protocolVersion: number;
}

export interface GetLatestLedgerResponse {
  id: string;
  protocolVersion: number;
  sequence: number;
}

export interface GetAccountResponse {
  id: string;
  sequence: string;
}

export interface SimulateTransactionResponse {
  latestLedger: number;
  cost?: { cpuInsns: string; memBytes: string };
  transactionData?: string;
  minResourceFee?: string;
  events?: string[];
  results?: Array<{ xdr: string }>;
  result?: { retval: any; auth?: any[] };
  error?: string;
  [key: string]: any;
}

export interface SendTransactionResponse {
  status: string;
  hash: string;
  latestLedger: number;
  latestLedgerCloseTime: string;
  errorResultXdr?: string;
  errorResult?: any;
  diagnosticEventsXdr?: string[];
  [key: string]: any;
}

export interface GetTransactionResponse {
  status: string;
  latestLedger: number;
  latestLedgerCloseTime: string;
  oldestLedger: number;
  oldestLedgerCloseTime: string;
  ledger?: number;
  createdAt?: string;
  applicationOrder?: number;
  feeBump?: boolean;
  envelopeXdr?: string;
  resultXdr?: string;
  resultMetaXdr?: string;
  returnValue?: any;
  [key: string]: any;
}

export interface GetEventsResponse {
  events: EventInfo[];
  latestLedger: number;
}

export interface EventInfo {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  pagingToken: string;
  topic: string[];
  value: string;
  inSuccessfulContractCall: boolean;
}

export interface GetLedgerEntriesResponse {
  entries: Array<{
    key: string;
    xdr: string;
    val?: any;
    lastModifiedLedgerSeq: number;
    liveUntilLedgerSeq?: number;
  }>;
  latestLedger: number;
}

export interface RawGetLedgerEntriesResponse {
  entries: Array<{
    key: string;
    xdr: string;
    lastModifiedLedgerSeq: number;
    liveUntilLedgerSeq?: number;
  }> | null;
  latestLedger: number;
}

// Re-export type guards from rpc-client
export { isSimulationError, isSimulationSuccess, isSimulationRestore } from '@stellar/rpc-client';

// Status enum objects (Freighter uses SorobanRpc.Api.SendTransactionStatus.PENDING etc.)
export const SendTransactionStatus = {
  PENDING: 'PENDING' as const,
  DUPLICATE: 'DUPLICATE' as const,
  TRY_AGAIN_LATER: 'TRY_AGAIN_LATER' as const,
  ERROR: 'ERROR' as const,
};

// Type alias for the same name — allows `SorobanRpc.Api.SendTransactionStatus` as a type
export type SendTransactionStatus = 'PENDING' | 'DUPLICATE' | 'TRY_AGAIN_LATER' | 'ERROR';

export const GetTransactionStatus = {
  SUCCESS: 'SUCCESS' as const,
  NOT_FOUND: 'NOT_FOUND' as const,
  FAILED: 'FAILED' as const,
};

export type GetTransactionStatus = 'SUCCESS' | 'NOT_FOUND' | 'FAILED';

// Re-export types from rpc-client that may be needed
export type {
  SimulateTransactionSuccessResponse,
  SimulateTransactionErrorResponse,
  SendTransactionResponse as RawSendTransactionResponse,
  SendTransactionStatus as SendTransactionStatusType,
  GetTransactionStatus as GetTransactionStatusType,
} from '@stellar/rpc-client';
