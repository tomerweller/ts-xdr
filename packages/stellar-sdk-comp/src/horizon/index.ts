export { Server, type ServerOptions } from './server.js';
export {
  CallBuilder,
  AccountCallBuilder,
  LedgerCallBuilder,
  TransactionCallBuilder,
  OperationCallBuilder,
  PaymentCallBuilder,
  EffectCallBuilder,
  OfferCallBuilder,
  TradesCallBuilder,
  AssetsCallBuilder,
  ClaimableBalanceCallBuilder,
  LiquidityPoolCallBuilder,
  OrderbookCallBuilder,
  StrictReceivePathCallBuilder,
  StrictSendPathCallBuilder,
  TradeAggregationCallBuilder,
  OfferTradesCallBuilder,
  FriendbotBuilder,
} from './call-builder.js';
export {
  AccountResponse,
  type CollectionPage,
  SUBMIT_TRANSACTION_TIMEOUT,
  SERVER_TIME_MAP,
  getCurrentServerTime,
  OperationResponseType,
} from './api.js';
export type * from './api.js';
export { AccountRequiresMemoError } from '@stellar/seps';

// Nested namespace aliases for Freighter compat
export * as HorizonApi from './api.js';
export * as ServerApi from './api.js';
