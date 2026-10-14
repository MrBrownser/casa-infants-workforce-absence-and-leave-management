/** What every Server Function of a form returns: success, or a Catalan message to show with an icon. */
export type ActionResult = { ok: true } | { ok: false; message: string };
