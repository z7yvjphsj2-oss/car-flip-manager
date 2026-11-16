import { toNumber } from './validation.js';

export function calculateExchangePurchasePrice(sourceCar, paymentType, paymentAmount) {
  const sourceCost = calculateTotals(sourceCar).totalCost;
  if (paymentType === 'received') return Math.max(sourceCost - toNumber(paymentAmount), 0);
  if (paymentType === 'paid') return sourceCost + toNumber(paymentAmount);
  return sourceCost;
}

export function calculateTotals(car) {
  const totalCost =
    toNumber(car.purchasePrice) +
    toNumber(car.deliveryCost) +
    toNumber(car.repairCost) +
    toNumber(car.partsCost) +
    toNumber(car.extraExpenses);
  const actualSalePrice = toNumber(car.actualSalePrice ?? car.salePrice);
  const hasActualSale = actualSalePrice > 0;
  const isExchangeOut = car.status === 'exchanged' && car.exchangeNextCarId;
  const netProfit = hasActualSale && !isExchangeOut ? actualSalePrice - totalCost : 0;
  const roi = hasActualSale && totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  return { totalCost, netProfit, roi, actualSalePrice, hasActualSale };
}

export function calculateStats(cars) {
  return cars.reduce(
    (acc, car) => {
      const { totalCost, netProfit, hasActualSale } = calculateTotals(car);
      const isTransferredByExchange = car.status === 'exchanged' && car.exchangeNextCarId;
      if (!isTransferredByExchange) {
        acc.totalInvestment += totalCost;
        acc.totalProfit += netProfit;
        acc.profitableDeals += hasActualSale ? 1 : 0;
      }
      acc.sold += car.status === 'sold' ? 1 : 0;
      acc.active += ['sold', 'exchanged'].includes(car.status) ? 0 : 1;
      acc.exchanged += car.status === 'exchanged' ? 1 : 0;
      return acc;
    },
    { totalInvestment: 0, totalProfit: 0, sold: 0, active: 0, exchanged: 0, profitableDeals: 0 },
  );
}

export function calculateSummary(stats) {
  const averageProfit = stats.profitableDeals > 0 ? stats.totalProfit / stats.profitableDeals : 0;
  const roi = stats.totalInvestment > 0 ? (stats.totalProfit / stats.totalInvestment) * 100 : 0;
  return { averageProfit, roi };
}
