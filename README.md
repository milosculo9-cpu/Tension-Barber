# Tension Barber - Website

Moderna web aplikacija za zakazivanje termina u berbernici Tension Barber.

## Tech Stack

- **Frontend:** Next.js 14, React, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage)
- **Hosting:** Vercel

## Setup

### 1. Kloniraj repo

```bash
git clone <your-repo-url>
cd tension-barber
```

### 2. Instaliraj dependencies

```bash
npm install
```

### 3. Podesi environment variables

Kreiraj `.env.local` fajl:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://ygczcwuwmxhnbbfipfby.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tvoj_anon_key>
```

Da nađeš ANON KEY:
1. Idi na Supabase Dashboard
2. Settings → API
3. Kopiraj "anon public" key

### 4. Pokreni lokalno

```bash
npm run dev
```

Otvori [http://localhost:3000](http://localhost:3000)

## Deploy na Vercel

### Opcija 1: Preko Vercel Dashboard

1. Idi na [vercel.com](https://vercel.com)
2. Klikni "New Project"
3. Import-uj GitHub repo
4. Dodaj Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy!

### Opcija 2: Preko CLI

```bash
npm i -g vercel
vercel
```

## Struktura projekta

```
tension-barber/
├── app/
│   ├── globals.css      # Global styles
│   ├── layout.js        # Root layout + SEO
│   └── page.js          # Homepage
├── lib/
│   └── supabase.js      # Supabase client
├── public/              # Static files
├── .env.example         # Example env file
├── next.config.js       # Next.js config
├── tailwind.config.js   # Tailwind config
└── package.json
```

## Funkcionalnosti

- ✅ Hero slider sa slikama
- ✅ Izbor salona (2 lokacije)
- ✅ Kalendar za izbor datuma (2 nedelje unapred)
- ✅ Prikaz berbera sa slikama
- ✅ Prikaz slobodnih termina
- ✅ Forma za zakazivanje
- ✅ Čuvanje rezervacija u Supabase
- ✅ SEO optimizacija
- ✅ Responsive dizajn

## TODO

- [ ] Email potvrde (Resend)
- [ ] Admin panel za berbere
- [ ] Pravo učitavanje slobodnih termina iz baze
- [ ] Google Maps integracija

## Kontakt

Tension Barber
- Tel: 065 9741 038
- Email: tension.barbershop1@gmail.com
