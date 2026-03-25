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
      : ''

    const { data, error } = await resend.emails.send({
      from: 'Tension Barber <potvrda@tension-barber.rs>',
      to: customerEmail,
      subject: 'Potvrda rezervacije - ' + formattedDate,
      html: `<!DOCTYPE html>
<html lang="sr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Potvrda rezervacije - Tension Barber</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body, table, td, div, p, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #000000 !important;
    }
    table {
      border-collapse: collapse !important;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    @media only screen and (max-width: 600px) {
      .mobile-padding {
        padding-left: 10px !important;
        padding-right: 10px !important;
      }
    }
    /* Force dark mode */
    [data-ogsc] body,
    [data-ogsb] body {
      background-color: #000000 !important;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #000000 !important;
      }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  
  <!-- Wrapper table -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #000000;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        
        <!-- Main content table -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 480px; background-color: #000000;">
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding: 30px 20px 20px;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">TENSION BARBER</h1>
              <p style="color: #666666; margin: 8px 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Muški frizerski salon</p>
            </td>
          </tr>
          
          <!-- Logo -->
          <tr>
            <td align="center" style="padding: 10px 20px;">
              <img src="https://tension-barber.rs/logo/logo.white.PNG" alt="Tension Barber" width="140" style="display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <!-- Success message -->
          <tr>
            <td align="center" style="padding: 20px;">
              <table role="presentation" width="60" height="60" cellpadding="0" cellspacing="0" border="0" style="background-color: #22c55e; border-radius: 30px;">
                <tr>
                  <td align="center" valign="middle" style="color: #ffffff; font-size: 28px; font-weight: bold;">✓</td>
                </tr>
              </table>
              <p style="color: #22c55e; margin: 15px 0 0; font-size: 18px; font-weight: 600;">Rezervacija potvrđena!</p>
            </td>
          </tr>
          
          <!-- Details card -->
          <tr>
            <td style="padding: 10px 15px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #111111; border-radius: 12px; border: 1px solid #222222;">
                
                <!-- Name -->
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid #222222;">
                    <p style="color: #888888; margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Ime</p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 600;">${customerName}</p>
                  </td>
                </tr>
                
                <!-- Service -->
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid #222222;">
                    <p style="color: #888888; margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Usluga</p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 600;">${serviceName}</p>
                  </td>
                </tr>
                
                <!-- Price -->
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid #222222;">
                    <p style="color: #888888; margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Cena</p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 600;">${formattedPrice}</p>
                  </td>
                </tr>
                
                <!-- Barber -->
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid #222222;">
                    <p style="color: #888888; margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Frizer</p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 600;">${barberName}</p>
                  </td>
                </tr>
                
                <!-- Date -->
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid #222222;">
                    <p style="color: #888888; margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Datum</p>
                    <p style="color: #ffffff; margin: 0; font-size: 16px; font-weight: 600;">${formattedDate}</p>
                  </td>
                </tr>
                
                <!-- Time - larger -->
                <tr>
                  <td style="padding: 18px 20px; border-bottom: 1px solid #222222;">
                    <p style="color: #888888; margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Vreme</p>
                    <p style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">${formattedTime}</p>
                  </td>
                </tr>
                
                <!-- Location -->
                <tr>
                  <td style="padding: 18px 20px;">
                    <p style="color: #888888; margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">Lokacija</p>
                    <p style="color: #ffffff; margin: 0; font-size: 14px;">${salonAddress}</p>
                  </td>
                </tr>
                
              </table>
            </td>
          </tr>
          
          <!-- Footer message -->
          <tr>
            <td align="center" style="padding: 10px 20px 15px;">
              <p style="color: #666666; margin: 0; font-size: 14px;">Vidimo se! 🤙</p>
            </td>
          </tr>
          
          ${cancellationToken ? `
          <!-- Cancel button -->
          <tr>
            <td align="center" style="padding: 10px 20px 30px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="background-color: #1a1a1a; border: 2px solid #ef4444; border-radius: 8px;">
                    <a href="${cancelUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ef4444; font-size: 14px; font-weight: 600; text-decoration: none; text-transform: uppercase; letter-spacing: 1px;">
                      ✕ &nbsp; Otkaži rezervaciju
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #444444; margin: 12px 0 0; font-size: 11px;">Otkazivanje je moguće najkasnije 2 sata pre termina</p>
            </td>
          </tr>
          ` : ''}
          
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px; border-top: 1px solid #222222;">
              <p style="color: #444444; margin: 0; font-size: 11px;">© ${new Date().getFullYear()} Tension Barber, Novi Sad</p>
              <p style="color: #333333; margin: 8px 0 0; font-size: 10px;">tension-barber.rs</p>
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
