import nodemailer from 'nodemailer';

// Helper to create and cache transporter with lazy initialization
let transporter: nodemailer.Transporter | null = null;
let lastConfigHash: string = '';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  returnPath?: string;
}

/**
 * Safely extracts a clean email address from string inputs like:
 * - "CaronaFlow <user@domain.com>" -> "user@domain.com"
 * - "user@domain.com" -> "user@domain.com"
 * - "smtp.umbler.com" -> null (invalid email)
 */
export function extractValidEmail(input?: string | null): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  // Check for angle bracket format: "Name <email@domain.com>"
  const match = trimmed.match(/<([^>]+)>/);
  const candidate = (match ? match[1] : trimmed).trim();
  // Valid email must contain @ and a domain with dot, and no whitespace or colon
  if (/^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/.test(candidate)) {
    return candidate;
  }
  return null;
}

export function getSmtpConfig() {
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || 'smtp.umbler.com').trim();
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || process.env.EMAIL_SECURE === 'true' || port === 465;
  const rawUser = (process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.SMTP_PASSWORD || process.env.EMAIL_PASSWORD || '').trim();
  
  // Clean authenticated user email
  const validUserEmail = extractValidEmail(rawUser) || (rawUser.includes('@') ? rawUser : '');

  // Determine standard From address (Default official: contato@apponline.ia.br)
  const rawFrom = (process.env.SMTP_FROM || process.env.EMAIL_FROM || 'contato@apponline.ia.br').trim();
  const validFromEmail = extractValidEmail(rawFrom);
  
  let from = '"CaronaFlow" <contato@apponline.ia.br>';
  if (validFromEmail) {
    from = rawFrom.includes('<') ? rawFrom : `"CaronaFlow" <${validFromEmail}>`;
  } else if (validUserEmail) {
    from = `"CaronaFlow" <${validUserEmail}>`;
  }

  // Determine Return-Path (for bounces)
  const rawReturnPath = (process.env.SMTP_RETURN_PATH || process.env.EMAIL_RETURN_PATH || process.env.SMTP_BOUNCE_EMAIL || '').trim();
  const validReturnPath = extractValidEmail(rawReturnPath) || validUserEmail || undefined;

  // Determine Reply-To
  const rawReplyTo = (process.env.SMTP_REPLY_TO || process.env.EMAIL_REPLY_TO || '').trim();
  const validReplyTo = extractValidEmail(rawReplyTo) || validUserEmail || undefined;

  return {
    host,
    port,
    secure,
    user: rawUser,
    validUserEmail,
    pass,
    from,
    returnPath: validReturnPath,
    replyTo: validReplyTo,
    isConfigured: Boolean(rawUser && pass),
  };
}

export function getTransporter(): nodemailer.Transporter | null {
  const config = getSmtpConfig();

  if (!config.isConfigured) {
    return null;
  }

  const currentConfigHash = `${config.host}:${config.port}:${config.secure}:${config.user}:${config.pass}`;

  if (!transporter || lastConfigHash !== currentConfigHash) {
    lastConfigHash = currentConfigHash;
    if (config.host === 'smtp.gmail.com' || process.env.EMAIL_SERVICE?.toLowerCase() === 'gmail') {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    } else {
      transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });
    }
  }

  return transporter;
}

/**
 * Base email layout with modern CaronaFlow / GEA styling
 */
export function buildHtmlEmailTemplate({
  title,
  preheader,
  badgeText,
  headline,
  recipientName,
  contentHtml,
  actionButton,
  footerNote,
}: {
  title: string;
  preheader?: string;
  badgeText?: string;
  headline: string;
  recipientName?: string;
  contentHtml: string;
  actionButton?: {
    label: string;
    url: string;
  };
  footerNote?: string;
}): string {
  const appUrl = process.env.APP_URL || 'https://caronaflow.app';
  const buttonUrl = actionButton?.url || appUrl;

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .email-container {
      max-width: 600px;
      margin: 24px auto;
      background: #ffffff;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #059669 0%, #047857 50%, #4338ca 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .header-logo {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }
    .header-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(4px);
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .header-title {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      line-height: 1.3;
    }
    .content {
      padding: 32px 24px;
      line-height: 1.6;
    }
    .greeting {
      font-size: 16px;
      font-weight: 600;
      color: #0f172a;
      margin-bottom: 16px;
    }
    .card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin: 20px 0;
    }
    .route-box {
      margin: 12px 0;
    }
    .route-step {
      display: flex;
      align-items: flex-start;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .route-step-icon {
      margin-right: 10px;
      font-size: 16px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 13px;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-value {
      color: #0f172a;
      font-weight: 600;
      text-align: right;
    }
    .button-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background: #059669;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 28px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }
    .footer {
      background: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
    .footer a {
      color: #059669;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="header-logo">🚗 CaronaFlow</div>
      ${badgeText ? `<div class="header-badge">${badgeText}</div>` : ''}
      <h1 class="header-title">${headline}</h1>
    </div>

    <div class="content">
      ${recipientName ? `<div class="greeting">Olá, ${recipientName}! 👋</div>` : ''}
      
      ${contentHtml}

      ${actionButton ? `
        <div class="button-container">
          <a href="${buttonUrl}" class="btn" target="_blank">${actionButton.label}</a>
        </div>
      ` : ''}

      ${footerNote ? `
        <p style="font-size: 12px; color: #64748b; margin-top: 20px; font-style: italic;">
          ${footerNote}
        </p>
      ` : ''}
    </div>

    <div class="footer">
      <p style="margin: 0 0 8px 0;"><strong>CaronaFlow</strong> • Sistema Inteligente de Caronas e Mobilidade Sustentável</p>
      <p style="margin: 0;">Este é um e-mail automático gerado pelo sistema de notificações do CaronaFlow.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Sends an email using Nodemailer or logs to console if credentials are not configured
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; simulated?: boolean; error?: string }> {
  const config = getSmtpConfig();
  const mailer = getTransporter();

  if (!mailer || !config.isConfigured) {
    console.log('\n📧 [EMAIL SERVICE - SIMULAÇÃO]');
    console.log(`Para: ${options.to}`);
    console.log(`Assunto: ${options.subject}`);
    console.log(`De: ${options.from || config.from}`);
    console.log('--- Status: SMTP não configurado com credenciais ativas. E-mail simulado com sucesso. ---\n');
    return {
      success: true,
      simulated: true,
      messageId: `sim-${Date.now()}`,
    };
  }

  try {
    // 1. Sanitize recipient
    const recipientEmail = extractValidEmail(options.to) || options.to.trim();

    // 2. Determine display 'from' header
    let senderHeader = config.from;
    if (options.from) {
      const validOptFrom = extractValidEmail(options.from);
      if (validOptFrom) {
        senderHeader = options.from.includes('<') ? options.from : `"CaronaFlow" <${validOptFrom}>`;
      }
    }

    // 3. Determine SMTP envelope sender (MAIL FROM)
    // Umbler requires MAIL FROM to strictly match the authenticated user account
    const envelopeSender = config.validUserEmail || extractValidEmail(senderHeader) || undefined;

    // 4. Determine Reply-To
    const finalReplyTo = extractValidEmail(options.replyTo) || config.replyTo || extractValidEmail(senderHeader) || undefined;

    // 5. Determine Return-Path
    const finalReturnPath = extractValidEmail(options.returnPath) || config.returnPath || envelopeSender || undefined;

    const mailOptions: nodemailer.SendMailOptions = {
      from: senderHeader,
      to: recipientEmail,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>?/gm, ''),
      replyTo: finalReplyTo,
      headers: {
        'X-Mailer': 'CaronaFlow-GEA-Notification-Engine',
        ...(finalReturnPath ? { 'Return-Path': `<${finalReturnPath}>` } : {}),
      },
    };

    // For Umbler and standard SMTP, set envelope sender only if valid email is present
    if (envelopeSender) {
      mailOptions.envelope = {
        from: envelopeSender,
        to: recipientEmail,
      };
    }

    const info = await mailer.sendMail(mailOptions);

    console.log(`✅ [EMAIL SERVICE] E-mail enviado com sucesso para ${recipientEmail} (MessageId: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
      simulated: false,
    };
  } catch (err: any) {
    console.error(`❌ [EMAIL SERVICE ERROR] Falha ao enviar e-mail para ${options.to}:`, err);
    return {
      success: false,
      error: err.message || 'Erro ao enviar e-mail via SMTP',
    };
  }
}
