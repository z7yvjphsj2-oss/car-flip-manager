// Schema descriptors are local configuration, not a new on-the-wire money format.
const amount = { amount: 'money' };
const event = { price: amount, amount, paid: amount, received: amount, delta: { amount: 'signedMoney' } };
const cost = { value: 'money', eventAmounts: [{ amount: 'money' }],
  adjustments: [{ previousValue: 'money', newValue: 'money', previousEventAmount: 'money', newEventAmount: 'money', delta: 'signedMoney' }] };
const exchange = { value: 'money', transfer: 'signedMoney', excess: 'money', nextCost: cost };
const sale = { value: 'signedMoney' };
const chain = {
  value: 'signedMoney', recognizedResult: 'signedMoney', recognizedExcess: 'money', saleResult: 'signedMoney', terminalCost: 'money',
  steps: [{ cost, exchange, sale }], excesses: [{ value: 'money' }], history: [event],
};
const forecast = { value: 'signedMoney', potentialResult: 'signedMoney', expectedPrice: 'money', currentCost: 'money', remainingCost: 'money' };
const ratio = { numerator: 'signedMoney', denominator: 'money', knownNumerator: 'signedMoney', knownDenominator: 'money' };
const signedMetric = { value: 'signedMoney', knownValue: 'signedMoney' };
const freeze = (value) => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

export const FINANCIAL_MONEY_SCHEMAS = freeze({
  journal: { events: [event] },
  cost, exchange, sale, chain, chainVersions: { original: chain, current: chain },
  roi: ratio, forecast, cashInvestment: { amount },
  portfolio: { closedResult: signedMetric, activeCost: { value: 'money', knownValue: 'money' }, potentialResult: signedMetric,
    recognizedOpenExcess: { value: 'money', knownValue: 'money' }, roi: { carryingCost: ratio, cashInvested: ratio } },
});
