export function normalize(s) {
  return (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * CR names arrive shouted ("MODIFY ORDER API") or lowercase from sheets; the
 * briefing reads them as words. Short all-caps tokens are left alone — they're
 * acronyms (BRD, API, UAT, SKU), not words that need lowering.
 */
export function toTitleCase(value) {
  return (value || '')
    .toString()
    .split(/(\s+)/)
    .map((word) => {
      if (/^\s+$/.test(word) || !word) return word
      if (/^[A-Z0-9&/.-]{2,4}$/.test(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join('')
}

export function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Unique-enough id suffix for client-created records. */
export function uid() {
  return Date.now() + '-' + Math.floor(Math.random() * 1000);
}

export function slugifyId(label, existingList) {
  const base =
    (label || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'project';
  let id = base;
  let n = 1;
  while (existingList.some((p) => p.id === id)) id = base + '-' + n++;
  return id;
}

export function slugifyStatus(label, existing) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12) || 'status';
  let key = base;
  let n = 1;
  while (existing.some((s) => s.key === key)) key = base + n++;
  return key;
}

export function slugifyCategory(label, existing) {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'category';
  let key = base;
  let n = 1;
  while (existing.some((c) => c.id === key)) key = base + n++;
  return key;
}

/** Sequential `${prefix}N` id that avoids collisions in `existing`. */
export function sequentialId(prefix, existing, idKey = 'id') {
  let n = existing.length + 1;
  let id = prefix + n;
  while (existing.some((x) => x[idKey] === id)) id = prefix + ++n;
  return id;
}
