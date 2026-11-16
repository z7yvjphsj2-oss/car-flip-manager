import React, { useEffect, useRef, useState } from 'https://esm.sh/react@19.1.0';
import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';
import { Input, icon } from './ui-components.js';
import { ProFinancialMetrics } from './pro-financial-metrics.js';
import { testRequest, displayRub } from './financial-test-client.js';
import { createProDealCommand, expenseCategories, syntheticVin } from './pro-deal-command.js';

const h = React.createElement;
const labels = { acquisition: 'Покупка', expense: 'Расход', sale: 'Продажа', exchange: 'Обмен' };
const title = car => car ? [car.make,car.model,car.year].filter(Boolean).join(' ') : 'Автомобиль';
const money = value => value == null ? '—' : displayRub(value);
const expenseOptions = () => Object.entries(expenseCategories).map(([id,label]) => h('option', { key:id,value:id }, label));

function DealForm({ kind, deal, locked, onSubmit, production }) {
  const [vin] = useState(()=>production ? null : syntheticVin());
  const [direction,setDirection] = useState('none');
  const [fees,setFees] = useState([]);
  const exchange = kind === 'exchange';
  const needsCar = exchange || kind === 'acquisition';
  const field = (label,name,props = {}) => h(Input, { label,name,required:true,...props });
  const amount = (label,name) => field(label,name,{ inputMode:'decimal',maxLength:18,placeholder:'0,00' });
  const select = (label,name,props,children) => h('label', null,h('span',null,label),h('select',{ name,...props },children));
  const submit = event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    onSubmit(kind,values,fees.map(id => ({ category:values['category-'+id],amount:values['amount-'+id] })));
  };
  return h('form',{onSubmit:submit},
    h('fieldset',{disabled:locked,className:'pro-fieldset'},
      needsCar && h('fieldset',{className:'pro-fieldset'},
        h('legend',null,exchange ? 'Автомобиль, полученный взамен' : 'Автомобиль'),
        h('div',{className:'form-grid'},
          field('Марка','make',{maxLength:100}),field('Модель','model',{maxLength:100}),
          field('Год выпуска','year',{type:'number',min:1886,max:2100}),
          production ? field('VIN','vin',{maxLength:17,autoCapitalize:'characters',pattern:'[A-HJ-NPR-Z0-9a-hj-npr-z]{17}'}) :
            field('Синтетический VIN','vin',{value:vin,readOnly:true}),
          h('label',{className:'wide-field'},h('span',null,'Дополнительные сведения'),
            h('textarea',{name:'note',maxLength:500,rows:2,placeholder:production ? 'Примечание к автомобилю' : 'Только вымышленные данные'})),
        ),
      ),
      h('div',{className:'form-grid'},
        field('Дата и время операции (UTC)','date',{type:'datetime-local',step:1}),
        !exchange && amount(kind === 'acquisition' ? 'Цена покупки, ₽' : kind === 'sale' ? 'Сумма продажи, ₽' : 'Сумма расхода, ₽','amount'),
        kind === 'expense' && select('Категория','category',{},expenseOptions()),
        exchange && amount('Оценка передаваемого авто, ₽','outgoing'),
        exchange && amount('Оценка полученного авто, ₽','incoming'),
        exchange && select('Доплата','direction',{value:direction,onChange:event=>setDirection(event.target.value)},[
          h('option',{key:'none',value:'none'},'Без доплаты'),
          h('option',{key:'paid',value:'paid'},'Я доплатил'),
          h('option',{key:'received',value:'received'},'Мне доплатили'),
        ]),
        exchange && direction !== 'none' && amount('Сумма доплаты, ₽','amount'),
        kind === 'sale' && h('label',{className:'wide-field pro-check'},
          h('input',{type:'checkbox',required:true}),h('span',null,'Подтверждаю, что автомобиль продан')),
      ),
      exchange && h('div',{className:'pro-exchange-fees'},
        h('p',null,`Передаём ${title(deal.car)}. Оценки сохраняются в истории сделки.`),
        fees.map((id,index)=>h('div',{className:'form-grid pro-fee',key:id},
          select(`Категория расхода ${index+1}`,'category-'+id,{},expenseOptions()),
          amount('Сумма расхода, ₽','amount-'+id),
          h('button',{className:'secondary-button',type:'button',onClick:()=>setFees(fees.filter(fee=>fee!==id))},'Убрать расход'),
        )),
        h('button',{type:'button',className:'secondary-button',disabled:fees.length>=20,
          onClick:()=>setFees([...fees,crypto.randomUUID()])},'Добавить расход обмена'),
      ),
      h('button',{className:'primary-button pro-submit',type:'submit'},`Сохранить · ${labels[kind]}`),
    ),
  );
}

function DealHistory({deal,openCar}) {
  const findCar = id => (deal.cars ?? [deal.car]).find(car=>car.id===id);
  return h(React.Fragment,null,
    h(ProFinancialMetrics,{data:deal}),
    h('h3',null,'Финансовая цепочка'),
    h('ol',{className:'pro-history'},deal.steps?.map(step=>h('li',{key:step.car_id},
      h('button',{type:'button',className:'secondary-button',onClick:()=>openCar(step.car_id)},title(findCar(step.car_id))),
      h('span',null,`Себестоимость ${money(step.cost_rub)}`),
      step.transferred_cost_rub != null && h('span',null,`Перенос ${money(step.transferred_cost_rub)}`),
      step.exchange_profit_rub != null && step.exchange_profit_rub !== '0.00' &&
        h('span',null,`Признано при обмене ${money(step.exchange_profit_rub)}`),
    ))),
    h('h3',null,'История операций'),
    h('ul',{className:'pro-history'},deal.history?.map(row=>h('li',{key:row.id},
      h('strong',null,labels[row.kind],row.category ? ` · ${expenseCategories[row.category] ?? row.category}` : '',
        !row.current ? ' · предыдущая версия' : ''),
      h('span',null,`${row.effective_at?.replace('T',' ').slice(0,19) ?? '—'} UTC`),
      h('span',null,row.kind==='exchange'
        ? `${title(findCar(row.from_car_id))} → ${title(findCar(row.to_car_id))} · доплата ${money(row.paid)} · получено ${money(row.received)}`
        : `${title(findCar(row.car_id))} · ${money(row.amount ?? row.price)}`),
      row.kind === 'exchange' && row.exchange_values && h('span',null,
        `Оценки сторон ${money(row.exchange_values.outgoing)} → ${money(row.exchange_values.incoming)}`),
    ))),
  );
}

export function ProWorkspace({ activeSession, request = testRequest, onBack }) {
  const production = Boolean(onBack);
  const [testSession,setSession] = useState(null);
  const session = production ? activeSession : testSession;
  const [cars,setCars] = useState([]);
  const [writerAvailable,setWriterAvailable] = useState(false);
  const [deal,setDeal] = useState(null);
  const [kind,setKind] = useState('acquisition');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [busy,setBusy] = useState(false);
  const [pending,setPending] = useState(null);
  const [formKey,setFormKey] = useState(0);
  const locked = useRef(false);
  const storageKey = user => 'cfm-pro-'+(production ? 'production' : 'test')+'-pending:'+user;
  const exclusive = async action => {
    if (locked.current) return;
    locked.current = true;setBusy(true);setError('');setNotice('');
    try { await action(); } catch (failure) { setError(failure.message); }
    finally { locked.current=false;setBusy(false); }
  };
  const loadCatalog = async active => {
    const catalog = await request('cars',{token:active.access_token});
    setWriterAvailable(catalog.pro_writer_available === true);
    setCars(catalog.cards);
  };
  const loadCar = async (active,id) => {
    const result = await request('car-state',{token:active.access_token,body:{car_id:id}});
    setDeal(result);setKind(null);
    setCarUrl(id);
  };
  const setCarUrl = id => {
    const url = new URL(location.href);
    if (production) url.searchParams.set('pro','1');
    url.searchParams.set('car_id',id);
    history.replaceState(null,'',url);
  };
  const initialize = async active => {
      const saved = sessionStorage.getItem(storageKey(active.user.id));
      if (saved) {
        try { setPending(JSON.parse(saved)); }
        catch { sessionStorage.removeItem(storageKey(active.user.id)); }
      }
      await loadCatalog(active);
      const carId = new URLSearchParams(location.search).get('car_id');
      if (carId) await loadCar(active,carId);
  };
  const login = data => exclusive(async()=>{
    const active = await request('login',{body:data});
    setSession(active);
    await initialize(active);
  });
  const send = async pendingCommand => {
    const key = storageKey(session.user.id);
    sessionStorage.setItem(key,JSON.stringify(pendingCommand));
    setPending(pendingCommand);
    try {
      await request('pro-write',{token:session.access_token,body:pendingCommand.raw});
    } catch (failure) {
      if (!failure.uncertain && failure.status !== 401) {
        sessionStorage.removeItem(key);setPending(null);
      }
      throw failure;
    }
    sessionStorage.removeItem(key);setPending(null);setFormKey(value=>value+1);setKind(null);
    try {
      await loadCar(session,pendingCommand.carId);
      await loadCatalog(session);
      setNotice('Операция сохранена.');
    } catch (failure) {
      setDeal(null);setCarUrl(pendingCommand.carId);
      setNotice('Операция сохранена. Обновите карточку, чтобы загрузить расчёт.');
      throw failure;
    }
  };
  const submit = (operation,data,fees) => exclusive(async()=>{
    const {carId,command}=createProDealCommand(operation,data,deal,fees,{production});
    await send({carId,raw:JSON.stringify(command)});
  });
  const openCar = id => exclusive(()=>loadCar(session,id));
  const logout = () => exclusive(async()=>{
    try { await request('logout',{token:session.access_token}); }
    finally { setSession(null);setCars([]);setWriterAvailable(false);setDeal(null);setKind('acquisition');setPending(null); }
  });
  useEffect(()=>{
    if (production && activeSession?.user) exclusive(()=>initialize(activeSession));
    if (!production) document.title='Car Flip Manager Pro · тест';
  },[activeSession?.user?.id,production]);
  const terminalOpen = deal?.terminal_id === deal?.car?.id && deal?.stage !== 'sold';
  const action = (value,label) => h('button',{type:'button',className:'secondary-button',
    disabled:busy||Boolean(pending)||!writerAvailable,onClick:()=>{setKind(value);setFormKey(key=>key+1);}},label);
  return h('main',{className:'app-shell pro-main'},
    h('header',{className:'panel pro-heading'},
      h('div',{className:'panel-title'},icon('🚘'),h('h1',null,'Car Flip Manager Pro')),
      production ? h('button',{type:'button',className:'secondary-button',onClick:onBack,disabled:busy},'К списку автомобилей') :
        h('p',null,'Тестовая Supabase. Используйте только вымышленные автомобили и суммы.'),
      !production && session && h('button',{type:'button',className:'secondary-button',onClick:logout,disabled:busy},'Выйти'),
    ),
    error && h('p',{role:'alert',className:'pro-message negative'},error),
    notice && h('p',{role:'status',className:'pro-message positive'},notice),
    busy && h('p',{role:'status'},'Загрузка…'),
    !session ? h('section',{className:'panel'},
      h('h2',null,'Вход в тестовый аккаунт'),
      h('form',{onSubmit:event=>{
        event.preventDefault();
        login(Object.fromEntries(new FormData(event.currentTarget)));
      },className:'form-grid'},
        h(Input,{label:'Тестовый email',name:'email',type:'email',required:true,autoComplete:'username'}),
        h(Input,{label:'Пароль',name:'password',type:'password',required:true,autoComplete:'current-password'}),
        h('button',{className:'primary-button',disabled:busy},'Войти'),
      ),
      h('button',{type:'button',className:'secondary-button pro-submit',disabled:busy,onClick:()=>login({})},
        'Войти сохранённым тестовым аккаунтом'),
    ) : h(React.Fragment,null,
      !writerAvailable && h('p',{role:'status'},production ? 'Запись Pro пока недоступна для этого аккаунта.' : 'Тестовый writer пока не поддерживает новые формы.'),
      h('section',{className:'panel'},
        h('div',{className:'panel-title'},h('h2',null,'Автомобили Pro')),
        h('div',{className:'pro-actions'},action('acquisition','Добавить автомобиль'),
          h('button',{type:'button',className:'secondary-button',disabled:busy,
            onClick:()=>exclusive(async()=>{
              const id=new URLSearchParams(location.search).get('car_id');
              if(id) await loadCar(session,id);
              await loadCatalog(session);
            })},'Обновить')),
        cars.length ? h('ul',{className:'pro-history'},cars.map(car=>h('li',{key:car.id},
          h('button',{type:'button',className:'secondary-button',disabled:busy,onClick:()=>openCar(car.id),
            'aria-current':deal?.car.id===car.id ? 'true' : undefined},title(car)),
          h('span',null,car.vin),
        ))) : h('p',null,production ? 'В журнале Pro пока нет новых автомобилей.' : 'В тестовом каталоге пока нет автомобилей.'),
      ),
      pending && writerAvailable && h('section',{className:'panel'},h('p',null,'Ответ на запись не получен. Повтор сохранит исходный ключ команды.'),
        h('button',{className:'primary-button',type:'button',disabled:busy,onClick:()=>exclusive(()=>send(pending))},'Повторить отправку')),
      deal && h('section',{className:'panel'},
        h('h2',null,title(deal.car)),h('p',null,deal.car.vin),deal.car.note && h('p',null,deal.car.note),
        terminalOpen && h('div',{className:'pro-actions'},action('expense','Добавить расход'),action('sale','Продать'),action('exchange','Обменять')),
        h(DealHistory,{deal,openCar}),
      ),
      kind && (kind==='acquisition'||terminalOpen) && h('section',{className:'panel'},
        h('h2',null,kind==='acquisition'?'Добавление автомобиля':labels[kind]),
        h(DealForm,{key:formKey,kind,deal,locked:busy||Boolean(pending)||!writerAvailable,onSubmit:submit,production}),
      ),
    ),
  );
}

export function mountTestPro() {
  createRoot(document.getElementById('root')).render(h(ProWorkspace));
}
