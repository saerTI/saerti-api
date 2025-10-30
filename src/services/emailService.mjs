// src/services/emailService.mjs
import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Enviar email de invitación a organización
 */
export async function sendInvitationEmail(email, organizationName, inviterName, token) {
  const invitationUrl = `${FRONTEND_URL}/invitations/accept?token=${token}`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitación a ${organizationName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #3B82F6;
    }
    .logo {
      font-size: 32px;
      font-weight: bold;
      color: #3B82F6;
      margin-bottom: 10px;
    }
    h1 {
      color: #1F2937;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .invitation-box {
      background-color: #EFF6FF;
      border-left: 4px solid #3B82F6;
      padding: 20px;
      margin: 30px 0;
      border-radius: 4px;
    }
    .invitation-box p {
      margin: 10px 0;
      font-size: 16px;
    }
    .organization-name {
      font-size: 20px;
      font-weight: bold;
      color: #3B82F6;
    }
    .cta-button {
      display: inline-block;
      background-color: #3B82F6;
      color: white !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .cta-button:hover {
      background-color: #2563EB;
    }
    .button-container {
      text-align: center;
      margin: 30px 0;
    }
    .warning {
      background-color: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
      font-size: 14px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
      text-align: center;
      color: #6B7280;
      font-size: 14px;
    }
    .link-box {
      background-color: #F9FAFB;
      padding: 15px;
      border-radius: 4px;
      margin: 20px 0;
      word-break: break-all;
      font-size: 12px;
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">SAER TI</div>
      <p style="color: #6B7280; margin: 0;">Sistema de Administración Empresarial</p>
    </div>

    <h1>¡Has sido invitado! 🎉</h1>

    <p>Hola,</p>

    <div class="invitation-box">
      <p><strong>${inviterName}</strong> te ha invitado a unirte a:</p>
      <p class="organization-name">${organizationName}</p>
    </div>

    <p>Al aceptar esta invitación, podrás colaborar y acceder a todos los recursos compartidos de esta organización.</p>

    <div class="button-container">
      <a href="${invitationUrl}" class="cta-button">
        Aceptar Invitación
      </a>
    </div>

    <div class="warning">
      <strong>⏱️ Esta invitación expira en 24 horas</strong><br>
      Asegúrate de aceptarla antes de que caduque.
    </div>

    <p style="font-size: 14px; color: #6B7280;">
      Si no puedes hacer clic en el botón, copia y pega este enlace en tu navegador:
    </p>
    <div class="link-box">
      ${invitationUrl}
    </div>

    <div class="footer">
      <p>Si no esperabas esta invitación, puedes ignorar este email.</p>
      <p style="margin-top: 20px;">
        <strong>SAER TI</strong><br>
        Sistema de Administración Empresarial
      </p>
    </div>
  </div>
</body>
</html>
  `;

  const textContent = `
Has sido invitado a ${organizationName}

${inviterName} te ha invitado a unirte a la organización ${organizationName}.

Para aceptar esta invitación, visita:
${invitationUrl}

Esta invitación expira en 24 horas.

Si no esperabas esta invitación, puedes ignorar este email.

---
SAER TI - Sistema de Administración Empresarial
  `;

  try {
    // Sanitizar organizationName para tags (solo ASCII, números, guiones y guiones bajos)
    const sanitizedOrgName = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')  // Reemplazar caracteres no permitidos con guión
      .replace(/-+/g, '-')            // Reemplazar múltiples guiones con uno solo
      .replace(/^-|-$/g, '');         // Eliminar guiones al inicio/final

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: `Invitación a unirte a ${organizationName}`,
      html: htmlContent,
      text: textContent,
      tags: [
        { name: 'type', value: 'organization-invitation' },
        { name: 'organization', value: sanitizedOrgName || 'unknown' }
      ]
    });

    if (error) {
      console.error('❌ Error enviando email con Resend:', error);
      throw new Error(`Error al enviar email: ${error.message}`);
    }

    console.log(`✅ Email de invitación enviado a ${email} (ID: ${data.id})`);

    return {
      success: true,
      emailId: data.id
    };

  } catch (error) {
    console.error('❌ Error en sendInvitationEmail:', error);
    throw error;
  }
}

/**
 * Validar configuración de Resend
 */
export function validateEmailConfig() {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️ RESEND_API_KEY no está configurada');
    return false;
  }

  if (!process.env.RESEND_FROM_EMAIL) {
    console.warn('⚠️ RESEND_FROM_EMAIL no está configurada, usando default');
  }

  if (!process.env.FRONTEND_URL) {
    console.warn('⚠️ FRONTEND_URL no está configurada, usando http://localhost:5173');
  }

  return true;
}

/**
 * Función auxiliar para testing (no envía email real)
 */
export async function sendTestEmail(to) {
  return sendInvitationEmail(
    to,
    'Organización de Prueba',
    'Usuario de Prueba',
    'test-token-123'
  );
}
