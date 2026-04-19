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
        from: '"CRM Corporativo" <noreply@segurosbolivar.com>',
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
              </div>
              
              <p style="font-size: 14px; color: #666;">Por favor, ingresa al CRM para gestionar este caso lo antes posible.</p>
            </div>
            <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #999;">
              Este es un mensaje automático del Sistema CRM Corporativo. No respondas a este correo.
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
    else if (managementType.includes("Regalo")) {
      const mailOptions = {
        from: '"CRM Corporativo" <noreply@segurosbolivar.com>',
        to: supervisorEmail,
        subject: "Nuevo link de pago generado",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e1e1e1; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #153157; color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">Link de Pago Generado</h1>
            </div>
            <div style="padding: 30px; color: #153157;">
              <p style="font-size: 16px;">Se ha registrado una nueva generación de link de pago exitosa.</p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #153157; padding: 20px; margin: 25px 0;">
                <p style="margin: 5px 0;"><strong>Asesor:</strong> ${fromAdvisorName}</p>
                <p style="margin: 5px 0;"><strong>Cliente:</strong> ${customerName}</p>
                <p style="margin: 5px 0;"><strong>Valor Generado:</strong> $${paymentLinkValue.toLocaleString()}</p>
                <p style="margin: 5px 0;"><strong>Solicitud:</strong> ${requestNumber}</p>
              </div>
              
              <p style="font-size: 16px;"><strong>${fromAdvisorName}</strong> generó un link de pago por valor de <strong>$${paymentLinkValue.toLocaleString()}</strong> para el cliente <strong>${customerName}</strong>.</p>
            </div>
            <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #999;">
              Este es un mensaje automático del Sistema CRM Corporativo. No respondas a este correo.
            </div>
          </div>
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
