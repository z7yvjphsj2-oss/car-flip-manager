const PROJECT = 'evdzodpluhxpjifstkrn';
export function canonicalRub(value) {
  const match = /^(0|[1-9][0-9]*)(?:[.,]([0-9]{1,2}))?$/.exec(value.trim());
  if (!match) throw Error('Введите сумму в рублях, не более двух знаков после запятой.');
  return `${match[1]}.${(match[2] ?? '').padEnd(2,'0')}`;
}
// Formatting only. All figures below arrive from the server calculation.
export function displayRub(value) {
  if (value === null || value === undefined) return 'Ожидается';
  if (typeof value !== 'string' || !/^-?\d+\.\d{2}$/.test(value)) throw Error('Некорректный ответ сервера');
  const [whole, fraction] = value.split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g,' ')}${fraction === '00' ? '' : ',' + fraction} ₽`;
}
export async function testRequest(path, { token, body } = {}) {
  if (!['login','logout','writer','purchase','state','cars','car-state','pro-write'].includes(path)) throw Error('TEST_ROUTE_REQUIRED');
  let response;
  try {
    response = await fetch(`/__test/${path}`, { method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { 'content-type':'application/json', ...(token ? { authorization:`Bearer ${token}` } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
    });
  } catch { throw Object.assign(Error(['state','cars','car-state'].includes(path) ? 'Не удалось получить финансовый результат. Повторите загрузку.' :
    'Ответ не получен. Повторите тот же запрос — ключ команды сохранён.'), { uncertain: true }); }
  let data;
  try { data = await response.json(); }
  catch { throw Object.assign(Error('Не удалось прочитать ответ сервера.'), { uncertain: true }); }
  if (!response.ok) {
    const message = data.error === 'SERVER_CALCULATION_INCOMPLETE' ? 'Операция нарушает порядок или полноту финансовой цепочки. Проверьте дату и время.' :
      data.error === 'PRO_TEST_BACKEND_REQUIRED' ? 'Локальный сервер Pro не подключён к тестовой базе.' :
      data.error === 'MONEY_OUT_OF_RANGE' ? 'Сервер отклонил запись: сумма превышает тестовый лимит. Данные не сохранены.' :
      path === 'login' ? 'Не удалось войти. Проверьте данные тестового аккаунта.' :
      response.status === 401 ? 'Сессия истекла. Войдите в тестовый аккаунт повторно.' :
      data.error === 'TEST_CAR_FORBIDDEN' ? 'Тестовый автомобиль не найден или у пользователя нет доступа.' :
      ['state','cars','car-state'].includes(path) ? `Не удалось загрузить финансовый учёт (${data.error ?? response.status}).` :
      `Сервер отклонил запись (${data.error ?? response.status}).`;
    throw Object.assign(Error(message), { uncertain: response.status >= 500, status: response.status });
  }
  if (['login','cars'].includes(path) && data.project_ref !== PROJECT) throw Error('TEST_PROJECT_REQUIRED');
  return data;
}
export function operationCommand(kind, amount, deal) {
  const car = deal?.car?.id ?? crypto.randomUUID(), chain = deal?.chain_id ?? crypto.randomUUID();
  const entryId = crypto.randomUUID();
  const command = {
    schema_version:'financial-data/1', model:'financial-model/1.0', canonicalization_version:'financial-command/1',
    command_type:'manual', idempotency_key:crypto.randomUUID(), correlation_id:crypto.randomUUID(), reason:'Synthetic UI deal',
    components:[...(kind === 'acquisition' ? [
      {component_key:'car',type:'car',id:car},{component_key:'chain',type:'chain',id:chain},
    ] : []), {
      component_key:kind,type:'entry',id:entryId,kind,chain_id:chain,car_id:car,
      ...(kind === 'expense' ? {allocation:'car'} : {}),
      source_system:'manual',source_key:entryId,source_component_key:'main',reason:'Synthetic UI operation',
      version:{date_precision:'instant',effective_at:new Date().toISOString(),evidence_refs:[],body:
        kind === 'expense' ? {currency:'RUB',amount_state:'confirmed',amount,scope:'direct',category:'repair'} :
        {currency:'RUB',price_state:'confirmed',price:amount,...(kind === 'sale' ? {disposal_confirmed:true} : {origin:'native'})}},
    }],
  };
  return {command,car_id:car,chain_id:chain};
}
