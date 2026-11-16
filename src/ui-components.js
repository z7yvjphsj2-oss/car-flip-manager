import React from 'https://esm.sh/react@19.1.0';
const h = React.createElement;

export function icon(symbol) {
  return h('span', { className: 'icon', 'aria-hidden': 'true' }, symbol);
}

export function StatCard({ icon: iconSymbol, label, value, positive = true }) {
  return h('article', { className: 'stat-card' },
    h('div', { className: 'stat-icon' }, icon(iconSymbol)),
    h('span', null, label),
    h('strong', { className: positive ? 'positive' : 'negative' }, value),
  );
}

export function Input({ label, ...props }) {
  return h('label', null, h('span', null, label), h('input', props));
}


export function Metric({ label, value, accent }) {
  return h('div', { className: 'metric' }, h('span', null, label), h('strong', { className: accent }, value));
}
