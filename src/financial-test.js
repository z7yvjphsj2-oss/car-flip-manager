import React, { useState, useRef, useCallback } from 'https://esm.sh/react@19.1.0';
import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';
import { icon, Input, Metric, StatCard } from './ui-components.js';
import { canonicalRub, displayRub, testRequest, operationCommand } from './financial-test-client.js';
import { CarCard } from './car-card.js';
import { FinancialProSection } from './financial-pro-section.js';
const h = React.createElement;

function TestApp() {
  const proView = window.location.pathname === '/financial-pro.html';
  const [session,setSession] = useState(null), [deal,setDeal] = useState(null), [busy,setBusy] = useState(false);
  const [message,setMessage] = useState(''), [error,setError] = useState(false);
  const [form,setForm] = useState({vin:`SYNTHETIC-${crypto.randomUUID().slice(0,8)}`,make:'Synthetic',model:'Test car',purchase:'700000',expense:'50000',sale:'1000000'});
  const [pending,setPending] = useState(null), lock = useRef(false);
  const [knownChain,setKnownChain] = useState(null), [needsRefresh,setNeedsRefresh] = useState(false);
  const [knownCar,setKnownCar] = useState(null), [cards,setCards] = useState([]);
  const change = e => setForm(f => ({...f,[e.target.name]:e.target.value}));
  const storageKey = owner => `cfm-financial-test-evdzodpluhxpjifstkrn-${owner}`;
  const loadProResult = useCallback(()=>testRequest('car-state',{token:session?.access_token,body:{car_id:knownCar}}),[session?.access_token,knownCar]);
  async function action(fn) {
    if (lock.current) return;
    lock.current = true; setBusy(true);setMessage('');setError(false);
    try { await fn(); } catch(e) { setError(true);setMessage(e.message); }
    finally { lock.current = false;setBusy(false); }
  }
  async function load(carId,token=session.access_token,owner=session?.user.id) {
    setKnownCar(carId);setKnownChain(null);setDeal(null);setNeedsRefresh(true);
    const url=new URL(window.location.href);url.search='';url.searchParams.set('car_id',carId);history.replaceState(null,'',url);
    const confirmed = await testRequest('car-state',{token,body:{car_id:carId}});
    if (confirmed.car?.id!==carId) throw Error('Связь тестовой карточки не подтверждена сервером.');
    setKnownChain(confirmed.chain_id);
    const saved=JSON.parse(sessionStorage.getItem(storageKey(owner)) ?? '{}');
    sessionStorage.setItem(storageKey(owner),JSON.stringify({...saved,car_id:carId,chain_id:confirmed.chain_id}));
    setForm(f => ({...f,vin:confirmed.car.vin,make:confirmed.car.make,model:confirmed.car.model,
      purchase:confirmed.purchase_rub,...(confirmed.sale_rub ? {sale:confirmed.sale_rub} : {})}));
    setDeal(confirmed);setNeedsRefresh(false); return confirmed;
  }
  function remember(next) {
    sessionStorage.setItem(storageKey(session.user.id),JSON.stringify(next));setPending(next.pending ?? null);setKnownChain(next.chain_id ?? null);setKnownCar(next.car_id ?? null);
  }
  async function submit(kind) {
    let submission = pending;
    if (!submission) {
      const operation = operationCommand(kind,canonicalRub(form[kind === 'acquisition' ? 'purchase' : kind]),deal);
      submission = {car_id:operation.car_id,chain_id:operation.chain_id,path:kind === 'acquisition' ? 'purchase' : 'writer',
        body:kind === 'acquisition' ? {card:{id:operation.car_id,vin:form.vin,make:form.make,model:form.model},rawCommand:JSON.stringify(operation.command)} : JSON.stringify(operation.command)};
      remember({car_id:deal?.car.id,chain_id:deal?.chain_id,pending:submission});
    }
    let receipt;
    try { receipt = await testRequest(submission.path,{token:session.access_token,body:submission.body}); }
    catch(e) {
      if (!e.uncertain) remember({car_id:deal?.car.id,chain_id:deal?.chain_id});
      throw e;
    }
    // Remember commit before requesting its projection. A failed read must never
    // manufacture a second purchase or expense when the user retries.
    remember({car_id:submission.car_id,chain_id:submission.chain_id});
    setNeedsRefresh(true);
    const confirmed = await load(submission.car_id);
    setCards((await testRequest('cars',{token:session.access_token})).cards);
    setMessage(`Сохранено сервером. Ревизия ${confirmed.revision}. Квитанция ${receipt.receipt_id}.`);
  }
  async function signIn(body) {
    const next = await testRequest('login',{body});
    const catalog = await testRequest('cars',{token:next.access_token});
    setCards(catalog.cards);
    setDeal(null);
    setSession(next);
    const saved = JSON.parse(sessionStorage.getItem(storageKey(next.user.id)) ?? '{}');
    const params = new URL(window.location.href).searchParams;
    let selected = params.get('car_id');
    if (saved.pending) selected = saved.car_id;
    else if (!params.has('car_id') && params.get('new') !== '1') selected = saved.car_id;
    setKnownChain(null);setKnownCar(selected ?? null);setNeedsRefresh(Boolean(selected));
    setPending(saved.pending ?? null);
    if (selected) await load(selected,next.access_token,next.user.id);
  }
  const header = h('section',{className:'hero'},h('div',null,
    h('p',{className:'eyebrow'},'Car Flip Manager Pro · Тестовый режим'),
    h('h1',null,proView ? 'Финансовый учёт Pro' : 'Тестовая сделка'),h('p',{className:'hero-text'},'car-flip-manager-test · Только синтетические данные')),
    h('div',{className:'hero-card'},icon('🧪'),h('span',null,'Среда'),h('strong',null,'TEST')));
  const notice = message ? h('p',{className:'app-message',role:error ? 'alert':'status'},message) : null;
  if (!session) return h('main',{className:'app-shell auth-shell'},header,
    h('section',{className:'panel auth-panel'},h('div',{className:'panel-title'},icon('🔐'),h('h2',null,'Вход в тестовый аккаунт')),
      h('p',{className:'notes'},'Используется отдельный синтетический пользователь тестовой Supabase.'),notice,
      h('form',{onSubmit:event=>{
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const credentials = {email:form.get('email'),password:form.get('password')};
        event.currentTarget.reset();
        action(()=>signIn(credentials));
      }},
        h(Input,{name:'email',label:'Email тестового аккаунта',type:'email',required:true,autoComplete:'username'}),
        h(Input,{name:'password',label:'Пароль',type:'password',required:true,autoComplete:'current-password'}),
        h('button',{className:'primary-button',disabled:busy},'Войти с паролем')),
      h('button',{className:'secondary-button',disabled:busy,onClick:()=>action(()=>signIn())},
        busy ? 'Входим...' : 'Войти в тестовый аккаунт')));
  const sold = deal?.stage === 'sold', canExpense = deal && !sold, canSale = deal?.stage === 'expense';
  const picker = h('section',{className:'panel','aria-label':'Тестовые автомобили'},
    h('h2',null,'Тестовые автомобили'),
    h('p',{className:'notes'},'Выберите конкретную тестовую карточку. Связь с финансовой цепочкой проверяется сервером.'),
    h('div',{className:'card-actions'},cards.map(car=>h('button',{key:car.id,type:'button',className:'secondary-button',disabled:busy || !!pending,
      'aria-pressed':car.id===knownCar,onClick:()=>action(()=>load(car.id))},`${car.make} ${car.model} · ${car.id.slice(0,8)}`))));
  if (proView) return h('main',{className:'app-shell'},header,
    h('p',{className:'notes'},'Изолированная карточка тестовой сделки.'),notice,
    picker,
    h('div',{className:'card-actions'},h('a',{className:'secondary-button',href:knownCar ? `/financial-test.html?car_id=${knownCar}` : '/financial-test.html'},'Открыть тестовые операции'),
      h('a',{className:'secondary-button',href:'/financial-test.html?new=1'},'Создать тестовый автомобиль'),
      h('button',{className:'secondary-button',disabled:busy,onClick:()=>action(async()=>{
        await testRequest('logout',{token:session.access_token});setSession(null);setDeal(null);
      })},'Выйти')),
    busy || needsRefresh ? h('p',{role:'status'},'Загружаем тестовую карточку…') : null,
    deal ? h(CarCard,{car:{...deal.car,status:deal.stage==='sold'?'sold':'bought'},financialProOnly:true,
      financialPro:h(FinancialProSection,{loadResult:loadProResult,expectedCarId:deal.car.id})}) :
      knownCar ? h('button',{className:'secondary-button',disabled:busy,onClick:()=>action(()=>load(knownCar))},'Повторить загрузку карточки') : h('p',null,'Выберите тестовый автомобиль или создайте новый.'));
  const field = (name,label) => h(Input,{key:name,label,name,value:form[name],onChange:change,required:true,
    disabled:busy || !!pending || needsRefresh || ['vin','make','model'].includes(name) || (!!knownChain && name==='purchase'),
    inputMode:['purchase','expense','sale'].includes(name) ? 'decimal' : undefined});
  return h('main',{className:'app-shell'},header,
    h('div',{className:'card-actions'},h('button',{className:'secondary-button',disabled:busy,onClick:()=>action(async()=>{
      await testRequest('logout',{token:session.access_token});setSession(null);setDeal(null);
    })},'Выйти'),knownCar ? h('button',{className:'secondary-button',disabled:busy,onClick:()=>action(()=>load(knownCar))},'Обновить с сервера') : null,
      knownCar ? h('a',{className:'secondary-button',href:`/financial-pro.html?car_id=${knownCar}`},'Открыть Pro этого автомобиля') : null,
      sold ? h('button',{className:'secondary-button',disabled:busy || !!pending,onClick:()=>{
        remember({});setDeal(null);setNeedsRefresh(false);setMessage('');
        history.replaceState(null,'',window.location.pathname+'?new=1');
        setForm({vin:`SYNTHETIC-${crypto.randomUUID().slice(0,8)}`,make:'Synthetic',model:'Test car',purchase:'700000',expense:'50000',sale:'1000000'});
      }},'Новая тестовая сделка') : null),
    notice,
    picker,
    pending ? h('section',{className:'panel'},h('p',null,'Команда ожидает подтверждения. Повтор использует прежний ключ.'),
      h('button',{className:'primary-button',disabled:busy,onClick:()=>action(()=>submit())},'Повторить запрос')) : null,
    h('section',{className:'stats-grid'},
      h(StatCard,{icon:'💰',label:'Себестоимость · сервер',value:displayRub(deal?.cost_rub)}),
      h(StatCard,{icon:'🏁',label:'Продажа · сервер',value:displayRub(deal?.sale_rub)}),
      h(StatCard,{icon:'📈',label:'Прибыль · сервер',value:displayRub(deal?.profit_rub)})),
    h('section',{className:'workspace'},
      h('form',{className:'panel',onSubmit:e=>{e.preventDefault();action(()=>submit('acquisition'));}},
        h('div',{className:'panel-title'},icon('🚘'),h('h2',null,'1. Покупка автомобиля')),
        h('div',{className:'form-grid'},field('vin','Синтетический идентификатор (не VIN)'),field('make','Марка'),field('model','Модель'),field('purchase','Покупка, ₽')),
        h('button',{className:'primary-button',disabled:busy || !!knownChain || !!pending || needsRefresh},'Сохранить покупку')),
      h('form',{className:'panel',onSubmit:e=>{e.preventDefault();action(()=>submit('expense'));}},
        h('div',{className:'panel-title'},icon('🔧'),h('h2',null,'2. Добавление расхода')),field('expense','Расход на ремонт, ₽'),
        h('button',{className:'primary-button',disabled:busy || !canExpense || !!pending || needsRefresh},'Добавить расход')),
      h('form',{className:'panel',onSubmit:e=>{e.preventDefault();action(()=>submit('sale'));}},
        h('div',{className:'panel-title'},icon('🏁'),h('h2',null,'3. Продажа автомобиля')),field('sale','Продажа, ₽'),
        h('button',{className:'primary-button',disabled:busy || !canSale || sold || !!pending || needsRefresh},'Зафиксировать продажу'))),
    deal ? h(CarCard,{car:{...deal.car,status:deal.stage==='sold'?'sold':'bought'},financialProOnly:true,
      financialPro:h(FinancialProSection,{loadResult:loadProResult,expectedCarId:deal.car.id})}) : null);
}
createRoot(document.getElementById('root')).render(h(TestApp));
