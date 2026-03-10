import './globals.css'

export const metadata = {
  title: 'Tension Barber | Muški Frizerski Salon Novi Sad',
  description: 'Tension Barber - premium muški frizerski salon u Novom Sadu. Profesionalno šišanje, brijanje i nega brade. Dve lokacije: Bulevar kralja Petra I 85 i Bulevar patrijarha Pavla 117. Zakaži termin online!',
  keywords: 'berber novi sad, frizer novi sad, muški frizer, šišanje novi sad, brijanje, tension barber, barbershop',
  authors: [{ name: 'Tension Barber' }],
  creator: 'Tension Barber',
  publisher: 'Tension Barber',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://tension-barber.rs'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Tension Barber | Muški Frizerski Salon Novi Sad',
    description: 'Premium muški frizerski salon u Novom Sadu. Dve lokacije. Zakaži termin online!',
    url: 'https://tension-barber.rs',
    siteName: 'Tension Barber',
    locale: 'sr_RS',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

// JSON-LD Schema for Local Business (SEO)
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'BarberShop',
  name: 'Tension Barber',
  description: 'Premium muški frizerski salon u Novom Sadu',
  url: 'https://tension-barber.rs',
  telephone: '+381659741038',
  email: 'tension.barbershop1@gmail.com',
  address: [
    {
      '@type': 'PostalAddress',
      streetAddress: 'Bulevar kralja Petra I 85',
      addressLocality: 'Novi Sad',
      postalCode: '21000',
      addressCountry: 'RS',
    },
    {
      '@type': 'PostalAddress',
      streetAddress: 'Bulevar patrijarha Pavla 117',
      addressLocality: 'Novi Sad',
      postalCode: '21000',
      addressCountry: 'RS',
    },
  ],
  openingHoursSpecification: [
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '09:00',
      closes: '23:00',
    },
    {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Sunday',
      opens: '12:00',
      closes: '18:00',
    },
  ],
  priceRange: '$$',
  currenciesAccepted: 'RSD',
  paymentAccepted: 'Cash',
}

export default function RootLayout({ children }) {
  return (
    <html lang="sr">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="bg-black text-white antialiased">
        {children}
      </body>
    </html>
  )
}
