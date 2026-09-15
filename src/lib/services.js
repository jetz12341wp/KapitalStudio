export function serializePublic(s) {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    duration: s.duration,
    price: s.price,
    priceIsFrom: Boolean(s.price_is_from),
  };
}

export function serializeAdmin(s) {
  return { ...serializePublic(s), active: Boolean(s.active) };
}

export function validateDuration(duration) {
  const n = Number(duration);
  return Number.isInteger(n) && n > 0 && n <= 8 * 60;
}

export function validatePrice(price) {
  if (price === undefined || price === null || price === '') return true; // precio opcional
  const n = Number(price);
  return Number.isFinite(n) && n >= 0;
}
