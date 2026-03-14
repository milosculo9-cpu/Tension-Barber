import './globals.css'

export const metadata = {
  title: 'Tension Barber | Muški frizer Novi Sad',
  description: 'Premium muški frizer u Novom Sadu. Zakazite termin online. Dve lokacije: Bulevar kralja Petra I i Bulevar patrijarha Pavla.',
  keywords: 'frizer, barbershop, muški frizer, Novi Sad, šišanje, brada, fade, tension barber',
  openGraph: {
    title: 'Tension Barber | Muški frizer Novi Sad',
    description: 'Premium muški frizer u Novom Sadu. Zakazite termin online.',
    type: 'website',
    locale: 'sr_RS',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }) {
  return (
    <html lang="sr">
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
