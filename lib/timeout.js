// Upit ka bazi sa rokom: ako ne stigne odgovor za `ms`, upit se prekida i vraca gresku,
// da ekran nikad ne ostane na "Ucitavanje" bez kraja.
export const LOAD_TIMEOUT_MS = 10000;

export async function withTimeout(builder, ms = LOAD_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await builder.abortSignal(ctrl.signal);
    if (res.error && ctrl.signal.aborted) {
      return { data: null, error: { message: 'timeout' } };
    }
    return res;
  } catch (err) {
    return { data: null, error: { message: ctrl.signal.aborted ? 'timeout' : (err?.message || 'greska') } };
  } finally {
    clearTimeout(timer);
  }
}
