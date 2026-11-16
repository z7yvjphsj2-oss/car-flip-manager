// The only public entry point. No imports from UI, SDK, storage or legacy finance.
export { createRubMoney, MoneyError } from './money.js';
export { roundHalfUp } from './rounding.js';
export { MODEL_VERSION as FINANCIAL_MODEL_VERSION } from './calculation.js';
export { createFinancialEngine } from './transactions.js';
export { selectEventVersions } from './journal.js';
export { validateExchangeChain } from './chain-validation.js';
export { createChainEngine } from './chains.js';
export { createFinancialAnalytics } from './analytics.js';
export { createFinancialTransport, FinancialTransportError } from './transport.js';
export { FINANCIAL_MONEY_SCHEMAS } from './transport-schemas.js';
