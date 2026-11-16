import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabase-config.js';
import { productionProWrites } from './financial-production-config.js';

const project = 'juhesiosvievacpiijjz';
export async function productionProRequest(path, {token,body} = {}) {
  if (!productionProWrites || SUPABASE_URL !== `https://${project}.supabase.co` ||
      !['cars','car-state','pro-write'].includes(path) || !token) throw Error('Финансовая запись Pro пока недоступна.');
  let response, data;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/financial-writer/${path}`, {
      method:'POST', redirect:'error', signal:AbortSignal.timeout(30000),
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:typeof body === 'string' ? body : JSON.stringify(body ?? {}),
    });
    data = await response.json();
  } catch {
    throw Object.assign(Error('Ответ сервера не получен. Повторите запрос.'),{uncertain:true});
  }
  if (!response.ok) {
    const message = response.status === 401 ? 'Сессия истекла. Войдите повторно.' :
      response.status === 403 ? 'У аккаунта нет доступа к этой операции Pro.' :
      data.error === 'SERVER_CALCULATION_INCOMPLETE' ? 'Проверьте даты, порядок и суммы операций.' :
      data.error === 'CARD_IDENTITY_CONFLICT' ? 'Автомобиль с таким VIN уже есть в вашем каталоге.' :
      `Операция Pro отклонена (${data.error ?? response.status}).`;
    throw Object.assign(Error(message),{status:response.status,uncertain:response.status>=500});
  }
  if (path === 'cars' && data.project_ref !== project) throw Error('Ответ получен от другого проекта.');
  return data;
}
