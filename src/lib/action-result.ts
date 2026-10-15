export type ActionFailure = { ok: false; message: string };

/**
 * What every Server Function of a form returns: success (with `data` when the
 * function has something to give back, such as a new id), or a Catalan message
 * to show with an icon.
 */
export type ActionResult<T = void> = ([T] extends [void] ? { ok: true } : { ok: true; data: T }) | ActionFailure;
