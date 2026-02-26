import {
  DiagnosticEvent,
  LedgerCloseMeta,
  LedgerEntry,
  LedgerEntryData,
  LedgerHeader,
  LedgerHeaderHistoryEntry,
  LedgerKey,
  SCVal,
  SorobanAuthorizationEntry,
  SorobanTransactionData,
  TransactionEnvelope,
  TransactionMeta,
  TransactionResult,
  is,
} from '@stellar/xdr';

import type {
  EventInfo,
  GetEventsResponse,
  GetLatestLedgerResponse,
  GetLedgerEntriesResponse,
  GetLedgersResponse,
  GetTransactionResponse,
  GetTransactionsResponse,
  LedgerEntryResult,
  LedgerInfo,
  SendTransactionResponse,
  SimulateTransactionResponse,
  SimulateTransactionSuccessResponse,
  SimulationResult,
  TransactionInfo,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function decodeOptional<T>(base64: string | undefined, codec: { fromBase64(s: string): T }): T | undefined {
  return base64 !== undefined ? codec.fromBase64(base64) : undefined;
}

function decodeArray<T>(arr: string[] | undefined, codec: { fromBase64(s: string): T }): T[] {
  return arr ? arr.map((s) => codec.fromBase64(s)) : [];
}

// ---------------------------------------------------------------------------
// Return value extraction from TransactionMeta
// ---------------------------------------------------------------------------

function extractReturnValue(meta: TransactionMeta): SCVal | undefined {
  if (is(meta, '3')) {
    return meta['3'].sorobanMeta?.returnValue ?? undefined;
  }
  if (is(meta, '4')) {
    return meta['4'].sorobanMeta?.returnValue ?? undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// getTransaction
// ---------------------------------------------------------------------------

interface RawGetTransactionResponse {
  status: string;
  latestLedger: number;
  latestLedgerCloseTime: number;
  oldestLedger: number;
  oldestLedgerCloseTime: number;
  ledger?: number;
  createdAt?: number;
  applicationOrder?: number;
  feeBump?: boolean;
  envelopeXdr?: string;
  resultXdr?: string;
  resultMetaXdr?: string;
  diagnosticEventsXdr?: string[];
}

export function parseGetTransactionResponse(raw: RawGetTransactionResponse): GetTransactionResponse {
  const resultMetaXdr = decodeOptional(raw.resultMetaXdr, TransactionMeta);
  return {
    status: raw.status as GetTransactionResponse['status'],
    latestLedger: raw.latestLedger,
    latestLedgerCloseTime: raw.latestLedgerCloseTime,
    oldestLedger: raw.oldestLedger,
    oldestLedgerCloseTime: raw.oldestLedgerCloseTime,
    ledger: raw.ledger,
    createdAt: raw.createdAt,
    applicationOrder: raw.applicationOrder,
    feeBump: raw.feeBump,
    envelopeXdr: decodeOptional(raw.envelopeXdr, TransactionEnvelope),
    resultXdr: decodeOptional(raw.resultXdr, TransactionResult),
    resultMetaXdr,
    diagnosticEventsXdr: decodeArray(raw.diagnosticEventsXdr, DiagnosticEvent),
    returnValue: resultMetaXdr ? extractReturnValue(resultMetaXdr) : undefined,
  };
}

// ---------------------------------------------------------------------------
// getTransactions
// ---------------------------------------------------------------------------

interface RawTransactionInfo {
  status: string;
  txHash: string;
  ledger: number;
  createdAt: number;
  applicationOrder: number;
  feeBump: boolean;
  envelopeXdr: string;
  resultXdr: string;
  resultMetaXdr: string;
  diagnosticEventsXdr?: string[];
}

interface RawGetTransactionsResponse {
  transactions: RawTransactionInfo[];
  latestLedger: number;
  latestLedgerCloseTimestamp: number;
  oldestLedger: number;
  oldestLedgerCloseTimestamp: number;
  cursor: string;
}

function parseTransactionInfo(raw: RawTransactionInfo): TransactionInfo {
  return {
    status: raw.status as TransactionInfo['status'],
    txHash: raw.txHash,
    ledger: raw.ledger,
    createdAt: raw.createdAt,
    applicationOrder: raw.applicationOrder,
    feeBump: raw.feeBump,
    envelopeXdr: TransactionEnvelope.fromBase64(raw.envelopeXdr),
    resultXdr: TransactionResult.fromBase64(raw.resultXdr),
    resultMetaXdr: TransactionMeta.fromBase64(raw.resultMetaXdr),
    diagnosticEventsXdr: decodeArray(raw.diagnosticEventsXdr, DiagnosticEvent),
  };
}

export function parseGetTransactionsResponse(raw: RawGetTransactionsResponse): GetTransactionsResponse {
  return {
    transactions: raw.transactions.map(parseTransactionInfo),
    latestLedger: raw.latestLedger,
    latestLedgerCloseTimestamp: raw.latestLedgerCloseTimestamp,
    oldestLedger: raw.oldestLedger,
    oldestLedgerCloseTimestamp: raw.oldestLedgerCloseTimestamp,
    cursor: raw.cursor,
  };
}

// ---------------------------------------------------------------------------
// getLedgerEntries
// ---------------------------------------------------------------------------

interface RawLedgerEntryResult {
  key: string;
  xdr: string;
  lastModifiedLedgerSeq: number;
  liveUntilLedgerSeq?: number;
}

interface RawGetLedgerEntriesResponse {
  latestLedger: number;
  entries?: RawLedgerEntryResult[];
}

function parseLedgerEntry(raw: RawLedgerEntryResult): LedgerEntryResult {
  return {
    key: LedgerKey.fromBase64(raw.key),
    val: LedgerEntryData.fromBase64(raw.xdr),
    lastModifiedLedgerSeq: raw.lastModifiedLedgerSeq,
    liveUntilLedgerSeq: raw.liveUntilLedgerSeq,
  };
}

export function parseGetLedgerEntriesResponse(raw: RawGetLedgerEntriesResponse): GetLedgerEntriesResponse {
  return {
    latestLedger: raw.latestLedger,
    entries: raw.entries ? raw.entries.map(parseLedgerEntry) : [],
  };
}

// ---------------------------------------------------------------------------
// getEvents
// ---------------------------------------------------------------------------

interface RawEventInfo {
  type: string;
  ledger: number;
  ledgerClosedAt: string;
  contractId: string;
  id: string;
  txHash: string;
  topic: string[];
  value: string;
  inSuccessfulContractCall: boolean;
}

interface RawGetEventsResponse {
  latestLedger: number;
  events?: RawEventInfo[];
  cursor: string;
}

function parseEventInfo(raw: RawEventInfo): EventInfo {
  return {
    type: raw.type as EventInfo['type'],
    ledger: raw.ledger,
    ledgerClosedAt: raw.ledgerClosedAt,
    contractId: raw.contractId,
    id: raw.id,
    txHash: raw.txHash,
    topic: raw.topic.map((t) => SCVal.fromBase64(t)),
    value: SCVal.fromBase64(raw.value),
    inSuccessfulContractCall: raw.inSuccessfulContractCall,
  };
}

export function parseGetEventsResponse(raw: RawGetEventsResponse): GetEventsResponse {
  return {
    latestLedger: raw.latestLedger,
    events: raw.events ? raw.events.map(parseEventInfo) : [],
    cursor: raw.cursor,
  };
}

// ---------------------------------------------------------------------------
// sendTransaction
// ---------------------------------------------------------------------------

interface RawSendTransactionResponse {
  hash: string;
  status: string;
  latestLedger: number;
  latestLedgerCloseTime: number;
  errorResultXdr?: string;
  diagnosticEventsXdr?: string[];
}

export function parseSendTransactionResponse(raw: RawSendTransactionResponse): SendTransactionResponse {
  return {
    hash: raw.hash,
    status: raw.status as SendTransactionResponse['status'],
    latestLedger: raw.latestLedger,
    latestLedgerCloseTime: raw.latestLedgerCloseTime,
    errorResultXdr: decodeOptional(raw.errorResultXdr, TransactionResult),
    diagnosticEventsXdr: decodeArray(raw.diagnosticEventsXdr, DiagnosticEvent),
  };
}

// ---------------------------------------------------------------------------
// simulateTransaction
// ---------------------------------------------------------------------------

interface RawSimulationResult {
  xdr: string;
  auth?: string[];
}

interface RawSimulateTransactionResponse {
  error?: string;
  latestLedger: number;
  minResourceFee?: string;
  transactionData?: string;
  results?: RawSimulationResult[];
  events?: string[];
  stateChanges?: {
    type: number;
    key: string;
    before: string | null;
    after: string | null;
  }[];
  restorePreamble?: {
    minResourceFee: string;
    transactionData: string;
  };
}

function parseSimulationResult(raw: RawSimulationResult): SimulationResult {
  return {
    retval: SCVal.fromBase64(raw.xdr),
    auth: decodeArray(raw.auth, SorobanAuthorizationEntry),
  };
}

export function parseSimulateTransactionResponse(
  raw: RawSimulateTransactionResponse,
): SimulateTransactionResponse {
  if (raw.error !== undefined) {
    return {
      error: raw.error,
      latestLedger: raw.latestLedger,
      events: decodeArray(raw.events, DiagnosticEvent),
    };
  }

  const result: SimulateTransactionSuccessResponse = {
    latestLedger: raw.latestLedger,
    minResourceFee: raw.minResourceFee!,
    transactionData: SorobanTransactionData.fromBase64(raw.transactionData!),
    results: raw.results ? raw.results.map(parseSimulationResult) : [],
    events: decodeArray(raw.events, DiagnosticEvent),
  };

  if (raw.stateChanges) {
    result.stateChanges = raw.stateChanges.map((sc) => ({
      type: sc.type,
      key: LedgerKey.fromBase64(sc.key),
      before: sc.before !== null ? LedgerEntry.fromBase64(sc.before) : null,
      after: sc.after !== null ? LedgerEntry.fromBase64(sc.after) : null,
    }));
  }

  if (raw.restorePreamble) {
    result.restorePreamble = {
      minResourceFee: raw.restorePreamble.minResourceFee,
      transactionData: SorobanTransactionData.fromBase64(raw.restorePreamble.transactionData),
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// getLedgers
// ---------------------------------------------------------------------------

interface RawLedgerInfo {
  hash: string;
  sequence: number;
  ledgerCloseTime: string;
  headerXdr: string;
  metadataXdr: string;
}

interface RawGetLedgersResponse {
  ledgers: RawLedgerInfo[];
  latestLedger: number;
  latestLedgerCloseTime: number;
  oldestLedger: number;
  oldestLedgerCloseTime: number;
  cursor: string;
}

function parseLedgerInfo(raw: RawLedgerInfo): LedgerInfo {
  return {
    hash: raw.hash,
    sequence: raw.sequence,
    ledgerCloseTime: raw.ledgerCloseTime,
    headerXdr: LedgerHeaderHistoryEntry.fromBase64(raw.headerXdr),
    metadataXdr: LedgerCloseMeta.fromBase64(raw.metadataXdr),
  };
}

export function parseGetLedgersResponse(raw: RawGetLedgersResponse): GetLedgersResponse {
  return {
    ledgers: raw.ledgers.map(parseLedgerInfo),
    latestLedger: raw.latestLedger,
    latestLedgerCloseTime: raw.latestLedgerCloseTime,
    oldestLedger: raw.oldestLedger,
    oldestLedgerCloseTime: raw.oldestLedgerCloseTime,
    cursor: raw.cursor,
  };
}

// ---------------------------------------------------------------------------
// getLatestLedger
// ---------------------------------------------------------------------------

interface RawGetLatestLedgerResponse {
  id: string;
  sequence: number;
  closeTime: string;
  headerXdr: string;
  metadataXdr: string;
}

export function parseGetLatestLedgerResponse(raw: RawGetLatestLedgerResponse): GetLatestLedgerResponse {
  return {
    id: raw.id,
    sequence: raw.sequence,
    closeTime: raw.closeTime,
    headerXdr: LedgerHeader.fromBase64(raw.headerXdr),
    metadataXdr: LedgerCloseMeta.fromBase64(raw.metadataXdr),
  };
}
