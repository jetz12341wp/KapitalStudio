function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Genera un id único para un nuevo servicio a partir de su nombre,
// agregando -2, -3... si ya existe uno igual.
function uniqueSlug(text, exists) {
  const base = slugify(text) || 'servicio';
  let candidate = base;
  let n = 2;
  while (exists(candidate)) {
    candidate = `${base}-${n}`;
    n += 1;
  }
  return candidate;
}

module.exports = { slugify, uniqueSlug };
