import React, { useCallback, useEffect, useRef, useState } from 'https://esm.sh/react@19.1.0';
import { ProFinancialMetrics } from './pro-financial-metrics.js';
import { displayRub } from './financial-test-client.js';
import { loadProCard } from './financial-pro.js';
const h = React.createElement;

// The transition deliberately receives no production car/owner identifiers.
export function FinancialProSection(props) {
  if (props.transitionOnly) return h('section',{className:'deal-history','aria-label':'Финансовый учёт Pro'},
    h('strong',null,'Финансовый учёт Pro · Тестовый режим'),
    h('p',{className:'notes'},'Откройте отдельную тестовую карточку. Этот автомобиль не связан с тестовой сделкой.'),
    h('a',{className:'secondary-button',href:'http://127.0.0.1:5174/financial-pro.html',target:'_blank',rel:'noopener noreferrer'},'Открыть тестовый финансовый учёт'));
  return h(LiveFinancialPro,props);
}

export function ProductionFinancialPro({ client, ownerId, carId, status }) {
  const loadResult = useCallback(() => loadProCard(client, ownerId, carId), [client, ownerId, carId]);
  if (status === 'linked') return h(LiveFinancialPro, { loadResult, expectedCarId: carId, production: true });
  const message = {
    unlinked: 'Автомобиль ещё не перенесён. Суммы выше относятся к прежнему учёту.',
    unavailable: 'Финансовое хранилище ещё не подключено. Карточка показывает прежний учёт.',
    loading: 'Проверяем связь с финансовым журналом…',
    error: 'Не удалось проверить связь. Обновите страницу.',
  }[status];
  return h('section', {className:'deal-history','aria-label':'Финансовый учёт Pro'},
    h('strong',null,'Финансовый учёт Pro'), h('p',{className:'notes'},message));
}

function LiveFinancialPro({ loadResult, expectedCarId, initiallyOpen = false, production = false }) {
  const [open,setOpen] = useState(initiallyOpen), [data,setData] = useState(null);
  const [loading,setLoading] = useState(false), [error,setError] = useState(''), [attempt,setAttempt] = useState(0);
  const generation = useRef(0);
  // Never render a prior card's amounts during a selection/render transition.
  const matchingData = data?.car?.id === expectedCarId ? data : null;
  useEffect(()=>{
    const current = ++generation.current;
    if (!open) return;
    setLoading(true);setError('');setData(null);
    Promise.resolve().then(loadResult).then(result=>{
      if (current !== generation.current) return;
      if (result.status === 'review_required' || result.status === 'unlinked') {
        throw Error('Требуется сверка финансового журнала. Суммы будут доступны после подтверждения.');
      }
      if (result.car?.id !== expectedCarId) throw Error('Ответ сервера относится к другой карточке.');
      // Validate formatting before rendering. No local amount calculation.
      for(const key of ['purchase_rub','expenses_rub','sale_rub','profit_rub'])displayRub(result[key]);
      setData(result);
    }).catch(e=>{if(current===generation.current)setError(e.message || 'Не удалось загрузить финансовый учёт.');})
      .finally(()=>{if(current===generation.current)setLoading(false);});
    return ()=>{generation.current++;};
  },[open,attempt,expectedCarId,loadResult]);
  return h('section',{className:'deal-history','aria-label':'Финансовый учёт Pro'},
    h('button',{type:'button',className:'secondary-button','aria-expanded':open,onClick:()=>setOpen(v=>!v)},'Финансовый учёт Pro'),
    h('span',null,production ? 'Финансовый журнал автомобиля' : 'Тестовый режим · car-flip-manager-test'),
    open ? h('div',null,
      loading ? h('p',{role:'status'},'Загружаем финансовый результат с сервера…') : null,
      error ? h('div',null,h('p',{role:'alert'},error),
        h('button',{className:'secondary-button',type:'button',onClick:()=>setAttempt(v=>v+1)},'Повторить загрузку')) : null,
      matchingData ? h('div',null,h(ProFinancialMetrics,{data:matchingData}),
        h('p',{className:'notes'},`Подтверждено серверным журналом · Ревизия ${data.revision}`),
        h('button',{className:'secondary-button',type:'button',onClick:()=>setAttempt(v=>v+1)},'Обновить финансовый учёт')) : null,
    ) : null);
}
