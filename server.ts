import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Configuración de Nodemailer
  const getTransporter = () => {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  };

  // API para enviar correos
  app.post("/api/send-email", async (req, res) => {
    const { 
      managementType, 
      fromAdvisorName, 
      toAdvisorName, 
      toAdvisorEmail, 
      supervisorEmail, 
      customerName, 
      requestNumber, 
      paymentLinkValue 
    } = req.body;

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

      if (managementType.includes("Mensaje")) {
        mailOptions = {
          from: `"CRM El Libertador" <${process.env.EMAIL_USER}>`,
          to: toAdvisorEmail,
          cc: supervisorEmail,
          subject: "🚨 Nueva transferencia asignada",
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 20px; background-color: white;">
              <div style="background-color: ${colors.red}; color: white; padding: 30px; text-align: center; border-top-left-radius: 20px; border-top-right-radius: 20px;">
                <h1 style="margin: 0; font-size: 24px;">Nueva Transferencia</h1>
              </div>
              <div style="padding: 40px; color: ${colors.blue};">
                <p style="font-size: 16px;">Hola <b>${toAdvisorName}</b>,</p>
                <p style="font-size: 16px; line-height: 1.6;">Has recibido una <b>transferencia de llamada</b> de parte de <b>${fromAdvisorName}</b>. Es necesario realizar la gestión lo antes posible.</p>
                
                <div style="background: ${colors.bg}; border-left: 5px solid ${colors.red}; padding: 25px; margin: 30px 0; border-radius: 8px;">
                  <h3 style="margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; color: ${colors.red};">Detalles del Cliente</h3>
                  <p style="margin: 8px 0; font-size: 15px;"><b>Cliente:</b> ${customerName}</p>
                  <p style="margin: 8px 0; font-size: 15px;"><b>Solicitud:</b> ${requestNumber}</p>
                  <p style="margin: 8px 0; font-size: 15px;"><b>Teléfono:</b> ${req.body.contactPhones || req.body.phone || 'No registrado'}</p>
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
        mailOptions = {
          from: `"CRM El Libertador" <${process.env.EMAIL_USER}>`,
          to: supervisorEmail,
          subject: "💹 Nuevo link de pago generado",
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 20px; background-color: white;">
              <div style="background-color: ${colors.blue}; color: white; padding: 30px; text-align: center; border-top-left-radius: 20px; border-top-right-radius: 20px;">
                <h1 style="margin: 0; font-size: 24px;">Link de Pago Generado</h1>
              </div>
              <div style="padding: 40px; color: ${colors.blue};">
                <p style="font-size: 16px;">Cordial saludo,</p>
                <p style="font-size: 16px; line-height: 1.6;">Se informa que el asesor <b>${fromAdvisorName}</b> ha generado un link de pago exitoso para el siguiente cliente:</p>
                
                <div style="background: ${colors.bg}; border-left: 5px solid ${colors.blue}; padding: 25px; margin: 30px 0; border-radius: 8px;">
                  <h3 style="margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; color: ${colors.blue}; text-align: center;">Información de la Gestión</h3>
                  <div style="display: flex; flex-direction: column; gap: 10px;">
                    <p style="margin: 5px 0;"><b>Asesor de Origen:</b> ${fromAdvisorName}</p>
                    <p style="margin: 5px 0;"><b>Asesor de Destino:</b> ${toAdvisorName}</p>
                    <p style="margin: 5px 0;"><b>Cliente:</b> ${customerName}</p>
                    <p style="margin: 5px 0;"><b>Solicitud:</b> ${requestNumber}</p>
                    <p style="margin: 5px 0;"><b>Teléfono:</b> ${req.body.contactPhones || req.body.phone || 'No registrado'}</p>
                    <p style="margin: 10px 0; font-size: 20px; color: ${colors.blue};"><b>Valor:</b> $${Number(paymentLinkValue).toLocaleString()}</p>
                  </div>
                </div>

                <p style="text-align: center; font-size: 14px; font-weight: bold; color: ${colors.blue}; background: #e0e7ff; padding: 10px; border-radius: 10px;">
                  🏆 Esta gestión suma puntos al ranking de productividad.
                </p>
              </div>
              ${footer}
            </div>
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

  // Health check para saber si las variables están listas
  app.get("/api/config-status", (req, res) => {
    res.json({
      emailUserSet: !!process.env.EMAIL_USER,
      emailPassSet: !!process.env.EMAIL_PASS,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor de El Libertador corriendo en http://localhost:${PORT}`);
  });
}

startServer();
