import { Resend } from 'resend'
import { NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request) {
  try {
    const { 
      customerName, 
      customerEmail, 
      serviceName, 
      servicePrice, 
      barberName, 
      appointmentDate, 
      appointmentTime,
      salonAddress 
    } = await request.json()

    // Format date for Serbian display
    const dateObj = new Date(appointmentDate)
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    const formattedDate = dateObj.toLocaleDateString('sr-RS', options)

    // Format time (remove seconds)
    const formattedTime = appointmentTime.slice(0, 5)

    // Format price
    const formattedPrice = servicePrice 
      ? `${servicePrice.toLocaleString('sr-RS')} RSD` 
      : 'Po dogovoru'

    const { data, error } = await resend.emails.send({
      from: 'Tension Barber <potvrda@tension-barber.rs>',
      to: customerEmail,
      subject: `Potvrda rezervacije - ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #000000;">
                  
                  <!-- Header - Big Title -->
                  <tr>
                    <td style="padding: 30px 20px 10px; text-align: center;">
                      <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 3px;">
                        TENSION BARBER
                      </h1>
                      <p style="color: #888888; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">
                        Muški frizerski salon
                      </p>
                    </td>
                  </tr>

                  <!-- Logo (big) with small checkmark below -->
                  <tr>
                    <td style="padding: 25px 20px; text-align: center;">
                      <img src="https://tension-barber.rs/logo-white.png" alt="Tension Barber" width="140" style="display: block; margin: 0 auto;" />
                      <p style="color: #22c55e; margin: 12px 0 0; font-size: 24px; line-height: 1;">✓</p>
                      <p style="color: #22c55e; margin: 8px 0 0; font-size: 16px; font-weight: 600;">
                        Rezervacija potvrđena!
                      </p>
                    </td>
                  </tr>

                  <!-- Booking Details in gray rounded box -->
                  <tr>
                    <td style="padding: 10px 20px 20px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 12px; overflow: hidden;">
                        
                        <tr>
                          <td style="padding: 15px 20px; border-bottom: 1px solid #333;">
                            <p style="color: #888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Ime</p>
                            <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${customerName}</p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 15px 20px; border-bottom: 1px solid #333;">
                            <p style="color: #888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Usluga</p>
                            <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${serviceName}</p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 15px 20px; border-bottom: 1px solid #333;">
                            <p style="color: #888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Cena</p>
                            <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${formattedPrice}</p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 15px 20px; border-bottom: 1px solid #333;">
                            <p style="color: #888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Frizer</p>
                            <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${barberName}</p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 15px 20px; border-bottom: 1px solid #333;">
                            <p style="color: #888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Datum</p>
                            <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${formattedDate}</p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 15px 20px; border-bottom: 1px solid #333;">
                            <p style="color: #888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Vreme</p>
                            <p style="color: #fff; margin: 0; font-size: 24px; font-weight: bold;">${formattedTime}</p>
                          </td>
                        </tr>

                        <tr>
                          <td style="padding: 15px 20px;">
                            <p style="color: #888; margin: 0 0 5px; font-size: 12px; text-transform: uppercase;">Lokacija</p>
                            <p style="color: #fff; margin: 0; font-size: 14px;">${salonAddress}</p>
                          </td>
                        </tr>

                      </table>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding: 20px; text-align: center;">
                      <p style="color: #666; margin: 0; font-size: 12px;">
                        Vidimo se! 🤙
                      </p>
                      <p style="color: #444; margin: 10px 0 0; font-size: 11px;">
                        Ako želite da otkažete termin, molimo vas da nas kontaktirate.
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}
