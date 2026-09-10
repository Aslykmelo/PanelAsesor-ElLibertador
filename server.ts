import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { getConversationContactTags, findConversationsByRequestNumber, redirectConversationsToNgso, getMyConversationStats } from "./lib/infobipNgso";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set generous limit for massive dataset uploads (20k-50k+ records)
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Initialize Supabase Client for backend operations
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;
  
  const supabase = isSupabaseConfigured 
    ? createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: { persistSession: false }
      })
    : null;

  if (isSupabaseConfigured) {
    console.log("Supabase client initialized successfully on El Libertador server.");
  } else {
    console.warn("Supabase NOT configured on the server. Falling back to local/Firebase operations.");
  }

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
    console.log("Recibida solicitud en /api/send-email:", req.body?.requestNumber);
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

      const formattedDate = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

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
      console.log("Correo enviado exitosamente para:", requestNumber);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error al enviar correo en el servidor:", error);
      res.status(500).json({ error: error.message || "Error desconocido al enviar el correo" });
    }
  });

  // Health check para saber si las variables están listas
  app.get("/api/config-status", (req, res) => {
    res.json({
      emailUserSet: !!process.env.EMAIL_USER,
      emailPassSet: !!process.env.EMAIL_PASS,
      supabaseConfigured: isSupabaseConfigured,
      infobipConfigured: !!process.env.INFOBIP_API_KEY && !!process.env.INFOBIP_BASE_URL
    });
  });

  // Redirigir a NGSO: buscar en Infobip los contactos de People cuyo nombre
  // contenga el número de solicitud dado y encontrar sus conversaciones
  // activas (OPEN/WAITING) — un mismo número puede tener varios contactos
  // (deudor, codeudor(es), arrendador...) y por lo tanto varias conversaciones.
  app.get("/api/ngso/search", async (req, res) => {
    const requestNumber = String(req.query.requestNumber || "").trim();
    if (!requestNumber) {
      return res.status(400).json({ error: "requestNumber es requerido" });
    }
    try {
      const conversations = await findConversationsByRequestNumber(requestNumber);
      res.json({ conversations });
    } catch (error: any) {
      console.error("Error al buscar conversaciones de Infobip:", error);
      res.status(500).json({ error: error.message || "Error desconocido al buscar la solicitud" });
    }
  });

  // Perfil: conversaciones que el asesor tiene abiertas ahora mismo y las
  // que ha cerrado hoy en Infobip (busca su agente de CCaaS por correo).
  app.get("/api/ngso/my-conversation-count", async (req, res) => {
    const email = String(req.query.email || "").trim().toLowerCase();
    const name = String(req.query.name || "").trim();
    if (!email) {
      return res.status(400).json({ error: "email es requerido" });
    }
    try {
      const stats = await getMyConversationStats(email, name);
      res.json(stats);
    } catch (error: any) {
      console.error("Error al consultar conversaciones del asesor:", error);
      res.status(500).json({ error: error.message || "Error desconocido al consultar conversaciones" });
    }
  });

  // Redirigir a NGSO: consultar las etiquetas actuales del contacto de
  // People asociado a esta conversación, para que el asesor elija cuáles
  // quitar.
  app.get("/api/ngso/conversation/:id/tags", async (req, res) => {
    try {
      const { tags, campaignAgent } = await getConversationContactTags(req.params.id);
      res.json({ tags, campaignAgent });
    } catch (error: any) {
      console.error("Error al consultar etiquetas de Infobip:", error);
      res.status(500).json({ error: error.message || "Error desconocido al consultar etiquetas" });
    }
  });

  // Redirigir a NGSO: el asesor solo deja la solicitud pendiente de
  // aprobación (eso lo guarda el cliente directo en Firestore). Este
  // endpoint es la ejecución real — mensaje al cliente, etiquetas y correo
  // de aviso a NGSO — y solo lo dispara un aprobador desde NgsoValidation al
  // aprobar la solicitud.
  app.post("/api/ngso/approve", async (req, res) => {
    const { conversationIds, message, tagNamesToRemove, requestNumber } = req.body || {};

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({ error: "conversationIds es requerido" });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "El mensaje para el cliente es requerido" });
    }

    try {
      const results = await redirectConversationsToNgso(
        conversationIds,
        message,
        Array.isArray(tagNamesToRemove) ? tagNamesToRemove : []
      );

      if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        try {
          await getTransporter().sendMail({
            from: `"El Libertador" <${process.env.EMAIL_USER}>`,
            to: "lidercartera2@ngsoabogados.com",
            subject: `Atender requerimiento Eli: Solicitud: ${requestNumber || ""}`,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
              <p>Se está enviando a NGSO la solicitud <b>${requestNumber || ""}</b>.</p>
              <p>Se avisó al cliente y se retiraron las etiquetas de asesor/compañía en Infobip.</p>
            </div>`,
          });
        } catch (emailError) {
          console.error("No fue posible enviar el correo de aviso a NGSO:", emailError);
          // No bloquea la respuesta: el caso ya se redirigió igual, el correo es solo un aviso.
        }
      } else {
        console.warn("EMAIL_USER/EMAIL_PASS no configurados: se omitió el correo de aviso a NGSO.");
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Error al redirigir conversación a NGSO:", error);
      res.status(500).json({ error: error.message || "Error desconocido al redirigir la conversación" });
    }
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
