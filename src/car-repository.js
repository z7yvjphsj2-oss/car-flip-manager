import { carToDb } from './car-model.js';

export async function appendImportedCars(client, cars, userId, toDb) {
  // One INSERT statement. No replacement, UPSERT, cleanup or compensating DELETE.
  const { data, error } = await client.from('cars')
    .insert(cars.map((car) => toDb(car, userId)))
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!Array.isArray(data) || data.length !== cars.length) {
    throw new Error('Incomplete import response; rows may already have been committed');
  }
  return data;
}

export function createCarRepository(client) {
  return {
    listCars: () => client.from('cars').select('*').order('created_at', { ascending: false }),
    saveCar(car, userId, editingCarId) {
      const request = editingCarId
        ? client.from('cars').update(carToDb(car, userId)).eq('id', editingCarId)
        : client.from('cars').insert(carToDb(car, userId));
      return request.select('*').single();
    },
    saveNotes: (id, userId, notes) => client.from('cars').update({ notes })
      .eq('id', id).eq('user_id', userId).select('id,notes').single(),
    deleteCar: (id) => client.from('cars').delete().eq('id', id),
    appendCars: (cars, userId) => appendImportedCars(client, cars, userId, carToDb),
    importLegacyCars: (cars, userId) => client.from('cars')
      .upsert(cars.map((car) => carToDb(car, userId)), { onConflict: 'id', ignoreDuplicates: true }),
  };
}
