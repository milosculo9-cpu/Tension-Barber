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
      salonAddress,
      cancellationToken
    } = await request.json()

    const dateObj = new Date(appointmentDate)
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
    const formattedDate = dateObj.toLocaleDateString('sr-RS', options)
    const formattedTime = appointmentTime.slice(0, 5)
    const formattedPrice = servicePrice ? servicePrice.toLocaleString('sr-RS') + ' RSD' : 'Po dogovoru'

    const cancelUrl = cancellationToken 
      ? `https://tension-barber.rs/api/cancel-reservation?token=${cancellationToken}`
      : null

    const { data, error } = await resend.emails.send({
      from: 'Tension Barber <potvrda@tension-barber.rs>',
      to: customerEmail,
      subject: 'Potvrda rezervacije - ' + formattedDate,
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #000000; padding: 20px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #000000;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 30px 20px 10px;">
              <img src="https://tension-barber.rs/logo/logo.white.PNG" alt="Tension Barber" width="120" style="display: block;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 10px 20px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: bold; letter-spacing: 3px;">TENSION BARBER</h1>
            </td>
          </tr>
          
          <!-- Success Badge -->
          <tr>
            <td align="center" style="padding: 10px 20px 20px;">
              <div style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 12px 24px; border-radius: 50px; font-size: 16px; font-weight: bold;">
                ✓ Rezervacija potvrđena!
              </div>
            </td>
          </tr>
          
          <!-- Details Card -->
          <tr>
            <td style="padding: 0 20px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 12px;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #333;">
                    <p style="color: #888; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Ime</p>
                    <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${customerName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #333;">
                    <p style="color: #888; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Usluga</p>
                    <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${serviceName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #333;">
                    <p style="color: #888; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Cena</p>
                    <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${formattedPrice}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #333;">
                    <p style="color: #888; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Frizer</p>
                    <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${barberName}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #333;">
                    <p style="color: #888; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Datum</p>
                    <p style="color: #fff; margin: 0; font-size: 16px; font-weight: bold;">${formattedDate}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #333;">
                    <p style="color: #888; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Vreme</p>
                    <p style="color: #fff; margin: 0; font-size: 26px; font-weight: bold;">${formattedTime}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="color: #888; margin: 0 0 4px; font-size: 11px; text-transform: uppercase;">Lokacija</p>
                    <p style="color: #fff; margin: 0; font-size: 14px;">${salonAddress}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- See you message -->
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <p style="color: #666; margin: 0; font-size: 14px;">Vidimo se! 🤙</p>
            </td>
          </tr>
          
          ${cancelUrl ? `
          <!-- Cancel Button -->
          <tr>
            <td align="center" style="padding: 20px;">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1a1a1a" style="border: 2px solid #ef4444; border-radius: 8px;">
                    <a href="${cancelUrl}" target="_blank" style="display: block; padding: 14px 28px; color: #ef4444; font-size: 14px; font-weight: bold; text-decoration: none; text-transform: uppercase; letter-spacing: 1px;">
                      ✕ OTKAŽI REZERVACIJU
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #555; margin: 10px 0 0; font-size: 11px;">Otkazivanje najkasnije 2h pre termina</p>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px; border-top: 1px solid #222;">
              <p style="color: #444; margin: 0; font-size: 11px;">© 2026 Tension Barber, Novi Sad</p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
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
