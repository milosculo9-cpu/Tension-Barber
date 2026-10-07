'use client';

// Izbor usluga za rucno zakazivanje (pult i berber), isto kao na sajtu:
// glavna usluga + koliko god dodatnih, ili samo dodatna (npr. samo brada).
// Cene su po lokalu berbera kod kog se zakazuje.

export const isLocation2 = (locationName) => !!locationName && !locationName.includes('Petra');

export const priceAt = (service, locationName) => {
  if (!service) return null;
  const raw = isLocation2(locationName) ? service.price_location2 : service.price;
  const n = raw === null || raw === undefined || raw === '' ? null : Number(raw);
  return n || null;
};

export const priceLabel = (service, locationName) => {
  const p = priceAt(service, locationName);
  return p ? `${p.toLocaleString('sr-RS')} RSD` : 'po dogovoru';
};

// Naziv, cena i trajanje izabrane kombinacije, u istom obliku kao termini sa sajta
export const describeSelection = (services, mainId, addonIds, locationName, fallbackDuration = 30) => {
  const main = services.find(s => s.id === mainId) || null;
  const addons = addonIds.map(id => services.find(s => s.id === id)).filter(Boolean);
  if (!main && addons.length === 0) return null;
  const addonNames = addons.map(a => a.name).join(', ');
  const name = !main ? addonNames : addonNames ? `${main.name} + ${addonNames}` : main.name;
  const price = (priceAt(main, locationName) || 0) + addons.reduce((s, a) => s + (priceAt(a, locationName) || 0), 0);
  const duration = (main ? (main.duration_minutes || fallbackDuration) : 0)
    + addons.reduce((s, a) => s + (a.duration_minutes || 0), 0);
  return { serviceId: main?.id || null, name, price, duration: duration || fallbackDuration };
};

export default function ServicePicker({ services, locationName, mainId, addonIds, onChange }) {
  const mains = services.filter(s => !s.is_additional);
  const addons = services.filter(s => s.is_additional);
  const selection = describeSelection(services, mainId, addonIds, locationName);

  const toggleAddon = (id) => onChange({
    mainId,
    addonIds: addonIds.includes(id) ? addonIds.filter(a => a !== id) : [...addonIds, id],
  });

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-white/50 text-xs mb-1">Usluga</label>
        <select
          value={mainId || ''}
          onChange={(e) => onChange({ mainId: e.target.value || null, addonIds })}
          className="w-full bg-black border border-zinc-700 rounded-lg px-3 py-2.5 text-white"
        >
          <option value="">{addonIds.length ? 'Samo dodatna usluga' : 'Izaberi uslugu'}</option>
          {mains.map(s => (
            <option key={s.id} value={s.id}>{s.name} - {priceLabel(s, locationName)}</option>
          ))}
        </select>
      </div>

      {addons.length > 0 && (
        <div>
          <label className="block text-white/50 text-xs mb-1">
            Dodatne usluge {mainId ? '(opciono)' : '(može i samo dodatna, npr. brada)'}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {addons.map(a => {
              const on = addonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAddon(a.id)}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded text-sm text-left
                    ${on ? 'bg-white text-black' : 'bg-white/5 text-white hover:bg-white/10'}`}
                >
                  <span className="truncate">{a.name}</span>
                  <span className={`shrink-0 text-xs ${on ? 'text-black/60' : 'text-white/40'}`}>
                    {priceLabel(a, locationName)} {on ? '✓' : '+'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selection && (
        <div className="bg-white/5 rounded-lg p-3 flex justify-between items-baseline gap-3">
          <div className="min-w-0">
            <p className="text-white/50 text-[10px] tracking-wider">UKUPNO</p>
            <p className="text-sm truncate">{selection.name}</p>
          </div>
          <p className="text-lg font-medium shrink-0">
            {selection.price ? `${selection.price.toLocaleString('sr-RS')} RSD` : 'po dogovoru'}
          </p>
        </div>
      )}
    </div>
  );
}
