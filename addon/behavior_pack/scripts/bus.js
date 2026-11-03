// Minimal publish/subscribe bus so feature modules can talk without
// circular imports.
/** @type {Map<string, Array<(data: any) => void>>} */
const handlers = new Map();

/** @param {string} name @param {(data: any) => void} fn */
export function on(name, fn) {
  if (!handlers.has(name)) handlers.set(name, []);
  handlers.get(name).push(fn);
}

/** @param {string} name @param {any} [data] */
export function emit(name, data) {
  for (const fn of handlers.get(name) ?? []) {
    try {
      fn(data);
    } catch (e) {
      console.warn(`[superhuman] handler for ${name} failed: ${e}`);
    }
  }
}
