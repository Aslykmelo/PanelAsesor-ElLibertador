import express from "express";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

app.post("/api/send-email", async (req, res) => {
  const { 
    managementType, 
    fromAdvisorName, 
    fromAdvisorEmail,
    toAdvisorName, 
    toAdvisorEmail, 
    supervisorEmail, 
    customerName, 
    requestNumber, 
    paymentLinkValue,
    observations,
    canalGestion,
    cartera
  } = req.body;

  const phone = req.body.contactPhones || req.body.phone || 'No registrado';
  const formattedDate = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(500).json({ error: "Credenciales de correo no configuradas en el servidor" });
  }

  try {
    const transporter = getTransporter();
    let mailOptions;

    const colors = {
      red: '#a1161b',
      blue: '#153157',
      bg: '#f8fafc',
      text: '#1e293b'
    };

    const footer = `<div style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 11px; color: #64748b; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;">
      Este es un mensaje automático, por favor no responder.
    </div>`;

    const isNgso = (cartera || '').toUpperCase().trim() === 'NGSO' || 
                   (toAdvisorEmail || '').toLowerCase().trim() === 'lidercartera2@ngsoabogados.com' ||
                   (supervisorEmail || '').toLowerCase().trim() === 'lidercartera2@ngsoabogados.com';

    if (managementType.includes("Mensaje")) {
      mailOptions = {
        from: `"El Libertador" <${process.env.EMAIL_USER}>`,
        to: isNgso ? "lidercartera2@ngsoabogados.com" : toAdvisorEmail,
        ...(isNgso ? {} : { cc: supervisorEmail }),
        subject: "🚨 Nueva transferencia asignada",
        html: `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 20px; background-color: white;">
            <div style="background-color: ${colors.red}; color: white; padding: 30px; text-align: center; border-top-left-radius: 20px; border-top-right-radius: 20px;">
              <h1 style="margin: 0; font-size: 24px;">Nueva Transferencia</h1>
            </div>
            <div style="padding: 40px; color: ${colors.blue};">
              <p style="font-size: 16px;">Hola <b>${toAdvisorName}</b>,</p>
              <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Has recibido una <b>transferencia de llamada</b> de parte de <b>${fromAdvisorName}</b>. Es necesario realizar la gestión lo antes posible.</p>
              
              <div style="background: ${colors.bg}; border-left: 5px solid ${colors.red}; padding: 25px; margin: 30px 0; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; color: ${colors.red};">Detalles de la Gestión</h3>
                <p style="margin: 8px 0; font-size: 15px;"><b>Cliente:</b> ${customerName}</p>
                <p style="margin: 8px 0; font-size: 15px;"><b>Solicitud:</b> ${requestNumber}</p>
                <p style="margin: 8px 0; font-size: 15px;"><b>Teléfono:</b> ${phone}</p>
                <p style="margin: 8px 0; font-size: 15px;"><b>Fecha:</b> ${formattedDate}</p>
                <p style="margin: 8px 0; font-size: 15px;"><b>Tipo:</b> ${managementType}</p>
                <p style="margin: 8px 0; font-size: 15px;"><b>Canal de Gestión:</b> ${canalGestion === 'WhatsApp' ? '💬 WhatsApp' : (canalGestion === 'Llamada' ? '📞 Llamada' : '💬 No especificado')}</p>
              </div>

              <div style="text-align: center; margin-top: 30px;">
                <p style="font-weight: 900; color: ${colors.red}; font-size: 14px; text-transform: uppercase;">⚠️ URGENCIA: ALTA</p>
              </div>
            </div>
            ${footer}
          </div>
        `,
      };
    } else {
      // LINK DE PAGO: Enviar a Supervisor y al Asesor que generó el link
      mailOptions = {
        from: `"El Libertador" <${process.env.EMAIL_USER}>`,
        to: isNgso ? ["lidercartera2@ngsoabogados.com"] : [supervisorEmail, fromAdvisorEmail],
        subject: "Link de Pago Generado",
        html: `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif;">
                  <!-- Header -->
                  <tr>
                    <td bgcolor="${colors.blue}" style="padding: 30px; text-align: center; color: #ffffff;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">Link de Pago Generado</h1>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px; color: ${colors.blue};">
                      <p style="font-size: 16px; margin-bottom: 15px;">Cordial saludo,</p>
                      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        Se informa que el asesor <b>${fromAdvisorName}</b> ha generado un link de pago exitoso:
                      </p>
                      
                      <div style="background-color: ${colors.bg}; border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                        <h2 style="margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; color: ${colors.blue}; letter-spacing: 1px; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Información de la Gestión</h2>
                        
                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                          <tr>
                            <td width="55%" style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">👤 Asesor Responsable del caso:</td>
                            <td width="45%" style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${toAdvisorName}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">📝 Registrado por:</td>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${fromAdvisorName}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">👤 Cliente:</td>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${customerName}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">📄 Solicitud:</td>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${requestNumber}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">📞 Teléfono:</td>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${phone}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">📅 Fecha:</td>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${formattedDate}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">📌 Tipo de Gestión:</td>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${managementType}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; color: #64748b;">${canalGestion === 'WhatsApp' ? '📱' : (canalGestion === 'Llamada' ? '📞' : '💬')} Canal de Gestión:</td>
                            <td style="padding: 10px 0; font-size: 15px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>${canalGestion || 'No especificado'}</b></td>
                          </tr>
                          <tr>
                            <td style="padding: 20px 0 0 0; font-size: 18px; color: ${colors.blue};"><b>💰 Valor del Link:</b></td>
                            <td style="padding: 20px 0 0 0; font-size: 24px; color: ${colors.blue}; text-align: right; font-weight: bold;">$${Number(paymentLinkValue).toLocaleString()}</td>
                          </tr>
                        </table>
                        ${observations ? `<div style="margin-top: 15px; font-style: italic; color: #64748b; font-size: 14px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px;"><b>Obs:</b> ${observations}</div>` : ''}
                      </div>

                      <div style="background-color: #e0e7ff; color: ${colors.blue}; padding: 15px; border-radius: 12px; text-align: center; font-weight: bold; font-size: 14px; border: 1px solid #c7d2fe;">
                        🏆 Esta gestión suma puntos al ranking de productividad.
                      </div>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-bottom-left-radius: 20px; border-bottom-right-radius: 20px;">
                      Este es un mensaje automático, por favor no responder.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        `,
      };
    }

    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error al enviar correo:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/config-status", (req, res) => {
  res.json({
    emailUserSet: !!process.env.EMAIL_USER,
    emailPassSet: !!process.env.EMAIL_PASS,
  });
});

export default app;
