export function getExchangeChain(car, carById) {
  if (!car || !carById) return [];
  const chain = [];
  const seen = new Set();
  let current = car;
  while (current?.exchangePreviousCarId && carById[current.exchangePreviousCarId] && !seen.has(current.exchangePreviousCarId)) {
    seen.add(current.id);
    current = carById[current.exchangePreviousCarId];
  }
  while (current && !seen.has(current.id)) {
    chain.push(current);
    seen.add(current.id);
    current = current.exchangeNextCarId ? carById[current.exchangeNextCarId] : null;
  }
  return chain;
}
