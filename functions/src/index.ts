import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { logger } from "firebase-functions";

admin.initializeApp();

/**
 * Configuración de Nodemailer
 * Se recomienda configurar las variables de entorno en la consola de Google Cloud o Firebase
 * EMAIL_USER: Tu correo de Gmail
 * EMAIL_PASS: Tu contraseña de aplicación (App Password)
 */
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Cloud Function que se dispara al crear un nuevo registro en Firestore
 */
export const onRegistroCreated = onDocumentCreated("registros/{registroId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    logger.info("No se encontraron datos en el documento creado.");
    return;
  }

  const data = snapshot.data();
  const {
    managementType,
    fromAdvisorName,
    toAdvisorName,
    toAdvisorEmail,
    supervisorEmail,
    customerName, // Mapeado de clientName
    requestNumber,
    paymentLinkValue // Mapeado de value
  } = data;

  logger.info(`Procesando gestión: ${managementType} - ID: ${event.params.registroId}`);

  try {
    // 1. Lógica para Mensaje (Transferencia de llamada)
    if (managementType.includes("Mensaje")) {
      const mailOptions = {
        from: '"El Libertador" <noreply@segurosbolivar.com>',
        to: toAdvisorEmail,
        cc: supervisorEmail,
        subject: "Nueva transferencia asignada",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #a1161b; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Nueva Transferencia</h1>
            </div>
            <div style="padding: 30px; color: #153157;">
              <p style="font-size: 16px;">Hola <strong>${toAdvisorName}</strong>,</p>
              <p style="font-size: 16px; line-height: 1.5;">Tienes una nueva transferencia asignada por parte de <strong>${fromAdvisorName}</strong>.</p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #a1161b; padding: 20px; margin: 25px 0;">
                <p style="margin: 5px 0;"><strong>Cliente:</strong> ${customerName}</p>
                <p style="margin: 5px 0;"><strong>Número de Solicitud:</strong> ${requestNumber}</p>
                <p style="margin: 5px 0;"><strong>Tipo:</strong> ${managementType}</p>
              </div>
              
              <p style="font-size: 14px; color: #666;">Por favor, ingresa al sistema para gestionar este caso lo antes posible.</p>
            </div>
            <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #999;">
              Este es un mensaje automático de El Libertador. Por favor no responder.
            </div>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      logger.info(`Correo de transferencia enviado a ${toAdvisorEmail} con CC a ${supervisorEmail}`);
      
      // Actualizar el documento para reflejar que el correo fue enviado
      await snapshot.ref.update({ 
        notified: true, 
        notifiedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    } 
    
    // 2. Lógica para Regalo (Generación de link de pago)
    else if (managementType.includes("Regalo") || managementType.includes("Pago")) {
      const formattedDate = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
      const phone = data.contactPhones || data.phone || 'No registrado';
      const observations = data.observations || '';

      const mailOptions = {
        from: '"El Libertador" <noreply@segurosbolivar.com>',
        to: [supervisorEmail, data.fromAdvisorEmail],
        subject: "Link de Pago Generado",
        html: `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e2e8f0; font-family: 'Segoe UI', Arial, sans-serif;">
                  <!-- Header -->
                  <tr>
                    <td bgcolor="#153157" style="padding: 30px; text-align: center; color: #ffffff;">
                      <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 1px;">Link de Pago Generado</h1>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding: 40px; color: #153157;">
                      <p style="font-size: 16px; margin-bottom: 15px;">Cordial saludo,</p>
                      <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
                        Se informa que el asesor <b>${fromAdvisorName}</b> ha generado un link de pago exitoso:
                      </p>
                      
                      <div style="background-color: #f8fafc; border-radius: 12px; padding: 25px; margin-bottom: 30px; border: 1px solid #e2e8f0;">
                        <h2 style="margin: 0 0 20px 0; font-size: 14px; text-transform: uppercase; color: #153157; letter-spacing: 1px; text-align: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Información de la Gestión</h2>
                        
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
                            <td style="padding: 20px 0 0 0; font-size: 18px; color: #153157;"><b>💰 Valor del Link:</b></td>
                            <td style="padding: 20px 0 0 0; font-size: 24px; color: #153157; text-align: right; font-weight: bold;">$${Number(paymentLinkValue).toLocaleString()}</td>
                          </tr>
                        </table>
                        ${observations ? `<div style="margin-top: 15px; font-style: italic; color: #64748b; font-size: 14px; text-align: center; border-top: 1px dashed #cbd5e1; padding-top: 10px;"><b>Obs:</b> ${observations}</div>` : ''}
                      </div>

                      <div style="background-color: #e0e7ff; color: #153157; padding: 15px; border-radius: 12px; text-align: center; font-weight: bold; font-size: 14px; border: 1px solid #c7d2fe;">
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

      await transporter.sendMail(mailOptions);
      logger.info(`Correo de link de pago enviado al supervisor: ${supervisorEmail}`);

      // Actualizar el documento para reflejar que el correo fue enviado
      await snapshot.ref.update({ 
        notified: true, 
        notifiedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
    }
  } catch (error) {
    logger.error("Error al procesar la Cloud Function o enviar el correo:", error);
  }
});
