// Upit ka bazi sa rokom i jednim automatskim ponovnim pokusajem.
// Ako odgovor ne stigne za `ms`, upit se prekida i salje ponovo (nov fetch cesto ide novom
// vezom); tek ako ni to ne uspe, vraca se greska, da ekran nikad ne ostane na "Ucitavanje".
// `makeQuery` je funkcija koja svaki put pravi nov upit, jer se isti upit ne moze poslati dvaput.
export const LOAD_TIMEOUT_MS = 6000;

async function attempt(builder, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await builder.abortSignal(ctrl.signal);
    if (res.error && ctrl.signal.aborted) return { data: null, error: { message: 'timeout' } };
    return res;
  } catch (err) {
    return { data: null, error: { message: ctrl.signal.aborted ? 'timeout' : (err?.message || 'greska') } };
  } finally {
    clearTimeout(timer);
  }
}

export async function withTimeout(makeQuery, { ms = LOAD_TIMEOUT_MS, retries = 1 } = {}) {
  let res;
  for (let i = 0; i <= retries; i++) {
    res = await attempt(makeQuery(), ms);
    if (!res.error || res.error.message !== 'timeout') return res;
  }
  return res;
}
