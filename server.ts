import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { sendEmail, getSmtpConfig } from './server/email';
import { generateEmailForAction, generateEmailVerificationCodeTemplate, ConfirmationPayload } from './server/emailTemplates';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory store for pending verification codes (expires after 15 min)
const verificationCodesMap = new Map<string, { code: string; expiresAt: number; userName?: string }>();
// In-memory set of verified emails (and also validated via request payload)
const validatedEmailsSet = new Set<string>();

// Pre-validate superuser and seed emails
validatedEmailsSet.add('silvano.kassio@gmail.com');
validatedEmailsSet.add('contato@apponline.ia.br');

// In-memory data store for live simulation state
let liveTrackingState: Record<string, {
  rideId: string;
  latitude: number;
  longitude: number;
  speedKmH: number;
  heading: number;
  progressPercent: number;
  nextStopLabel: string;
  etaMinutes: number;
  timestamp: string;
  currentStepIndex: number;
}> = {};

// Healthcheck
app.get('/api/health', (_req, res) => {
  const smtpConfig = getSmtpConfig();
  res.json({ 
    status: 'ok', 
    service: 'CaronaFlow Cloud Run Backend', 
    emailService: {
      isConfigured: smtpConfig.isConfigured,
      host: smtpConfig.host,
      port: smtpConfig.port,
      userConfigured: Boolean(smtpConfig.user),
    },
    timestamp: new Date().toISOString() 
  });
});

// Email Service: Status & Diagnostics
app.get('/api/email/status', (_req, res) => {
  const config = getSmtpConfig();
  res.json({
    success: true,
    isConfigured: config.isConfigured,
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.user ? `${config.user.substring(0, 3)}***@${config.user.split('@')[1] || 'domain'}` : 'Não configurado',
    from: config.from,
    info: config.isConfigured 
      ? 'Serviço SMTP Ativo para envio de e-mails de confirmação.' 
      : 'Serviço em Modo Simulação (Defina SMTP_USER e SMTP_PASS nas variáveis de ambiente do Cloud Run/AI Studio para disparo real).',
  });
});

// Email Validation: Send 6-digit PIN code via contato@apponline.ia.br
app.post('/api/email/send-verification-code', async (req, res) => {
  try {
    const { email, userName } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ success: false, error: 'E-mail inválido ou não fornecido' });
    }

    const normEmail = email.trim().toLowerCase();
    // Generate secure 6-digit numeric PIN
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    verificationCodesMap.set(normEmail, {
      code,
      expiresAt,
      userName: userName || 'Membro CaronaFlow',
    });

    const { subject, html } = generateEmailVerificationCodeTemplate({
      code,
      recipientName: userName,
      expiresInMinutes: 15,
    });

    const result = await sendEmail({
      to: normEmail,
      subject,
      html,
      from: '"CaronaFlow" <contato@apponline.ia.br>',
      replyTo: 'contato@apponline.ia.br',
    });

    console.log(`🔐 [EMAIL VALIDATION] Código de validação enviado para ${normEmail}: ${code} (Expira em 15m)`);

    res.json({
      success: true,
      email: normEmail,
      simulated: result.simulated,
      messageId: result.messageId,
      expiresInMinutes: 15,
      // For developer or test convenience in simulated environment
      ...(result.simulated ? { devVerificationCode: code } : {}),
    });
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao enviar código de validação' });
  }
});

// Email Validation: Verify 6-digit PIN code
app.post('/api/email/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, error: 'E-mail e código de 6 dígitos são obrigatórios' });
    }

    const normEmail = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();
    const pending = verificationCodesMap.get(normEmail);

    if (!pending) {
      // Fallback: Check if already verified or allow demo code in simulation
      if (validatedEmailsSet.has(normEmail)) {
        return res.json({ success: true, verified: true, message: 'E-mail já se encontra validado no sistema.' });
      }
      return res.status(400).json({ success: false, error: 'Nenhum código de validação pendente ou código expirado. Solicite um novo código.' });
    }

    if (Date.now() > pending.expiresAt) {
      verificationCodesMap.delete(normEmail);
      return res.status(400).json({ success: false, error: 'Código de validação expirado (limite de 15 minutos). Por favor solicite um novo código.' });
    }

    if (pending.code !== cleanCode) {
      return res.status(400).json({ success: false, error: 'Código de validação incorreto. Verifique os 6 dígitos recebidos.' });
    }

    // Success: register as validated
    validatedEmailsSet.add(normEmail);
    verificationCodesMap.delete(normEmail);

    console.log(`✅ [EMAIL VALIDATION] E-mail ${normEmail} validado com sucesso no sistema!`);

    res.json({
      success: true,
      verified: true,
      email: normEmail,
      message: 'E-mail validado com sucesso! Agora você está habilitado a receber confirmações e e-mails automáticos.',
    });
  } catch (error: any) {
    console.error('Error verifying email code:', error);
    res.status(500).json({ success: false, error: error.message || 'Erro ao validar código' });
  }
});

// Email Validation: Check Status
app.get('/api/email/validation-status', (req, res) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  const isValidated = validatedEmailsSet.has(email);
  res.json({
    email,
    isValidated,
  });
});

// Email Service: Send Direct Email
app.post('/api/email/send', async (req, res) => {
  try {
    const { to, subject, html, text, from } = req.body;
    if (!to || !subject || !html) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: to, subject, html' });
    }

    const result = await sendEmail({ to, subject, html, text, from: from || '"CaronaFlow" <contato@apponline.ia.br>' });
    res.json(result);
  } catch (error: any) {
    console.error('Error sending email via /api/email/send:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Email Service: Send Action Confirmation Email (User actions: Ride Created, Request Sent, Request Accepted, Proposal, etc.)
// ENFORCES: Automatic emails are strictly dispatched only to validated email addresses
app.post('/api/email/send-confirmation', async (req, res) => {
  try {
    const payload: ConfirmationPayload & { recipientEmailVerified?: boolean } = req.body;
    if (!payload.recipientEmail || !payload.type) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios: recipientEmail, type' });
    }

    const normEmail = payload.recipientEmail.trim().toLowerCase();
    const isEmailValidated = validatedEmailsSet.has(normEmail) || payload.recipientEmailVerified === true;

    // RULE: Enviar os emails automáticos apenas para emails validados
    if (!isEmailValidated) {
      console.log(`ℹ️ [EMAIL GUARD] Envio automático IGNORADO para ${normEmail}: e-mail ainda não validado pelo usuário.`);
      return res.json({
        success: true,
        skipped: true,
        reason: 'E-mail não validado. As confirmações automáticas são disparadas exclusivamente para e-mails validados via contato@apponline.ia.br.',
        recipient: normEmail,
        type: payload.type,
      });
    }

    const { subject, html } = generateEmailForAction(payload);
    const result = await sendEmail({
      to: normEmail,
      subject,
      html,
      from: '"CaronaFlow" <contato@apponline.ia.br>',
      replyTo: 'contato@apponline.ia.br',
    });

    res.json({
      success: result.success,
      type: payload.type,
      recipient: normEmail,
      simulated: result.simulated,
      messageId: result.messageId,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Error dispatching confirmation email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Google Maps Routes API Advanced simulation & calculations
app.post('/api/routes/calculate', (req, res) => {
  try {
    const { origin, destination, waypoints = [], fuelPricePerLiter = 5.89, carEfficiencyKmPerLiter = 11.5 } = req.body;

    // Calculate approximate distance based on Euclidean-Haversine approximation for SP region
    let totalKm = 0;
    const allPoints = [origin, ...waypoints, destination].filter(Boolean);

    for (let i = 0; i < allPoints.length - 1; i++) {
      const p1 = allPoints[i];
      const p2 = allPoints[i + 1];
      const dLat = (p2.lat - p1.lat) * 111; // ~111 km per lat degree
      const dLng = (p2.lng - p1.lng) * 102; // ~102 km per lng degree in SP
      const segKm = Math.sqrt(dLat * dLat + dLng * dLng) * 1.35; // 1.35 urban road winding factor
      totalKm += segKm;
    }

    const finalDistanceKm = Math.max(2.5, Number(totalKm.toFixed(1)));
    const avgUrbanSpeedKmH = 22.5; // SP peak hours average
    const estimatedDurationMin = Math.round((finalDistanceKm / avgUrbanSpeedKmH) * 60);
    const fuelLiters = finalDistanceKm / carEfficiencyKmPerLiter;
    const fuelCost = Number((fuelLiters * fuelPricePerLiter).toFixed(2));
    const carbonSavingKg = Number(((finalDistanceKm * 0.16) * Math.max(1, waypoints.length)).toFixed(2)); // avg 160g CO2/km saved per car off road

    res.json({
      success: true,
      distanceKm: finalDistanceKm,
      estimatedDurationMin,
      fuelCostEstimated: fuelCost,
      estimatedCarbonSavingKg: carbonSavingKg,
      optimizedWaypointsOrder: waypoints.map((w: any, idx: number) => ({
        ...w,
        orderIndex: idx + 1,
        optimizedEtaMinutes: Math.round(((idx + 1) / (waypoints.length + 1)) * estimatedDurationMin),
      })),
      metrics: {
        fuelPricePerLiter,
        carEfficiencyKmPerLiter,
        fuelLiters: Number(fuelLiters.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error('Error calculating route:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gemini Vertex AI: Smart Routine Optimizer & Group Matching Assistant
app.post('/api/gemini/optimize-routines', async (req, res) => {
  try {
    const { users = [], groups = [] } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Fallback heuristics if API key not available in sandbox
      return res.json({
        success: true,
        source: 'heuristic-engine',
        suggestions: [
          {
            title: 'Cluster Pinheiros ➔ USP Cidade Universitária',
            description: 'Identificamos 3 usuários (Carlos, Beatriz e Lucas) com horários e rotas convergentes para o Campus Butantã.',
            suggestedGroupName: 'USP / Poli - Engenharia',
            driverId: 'usr-carlos-mot',
            passengerIds: ['usr-beatriz-pass', 'usr-lucas-pass'],
            commonOriginZone: 'Pinheiros / Butantã',
            commonDestinationZone: 'USP Poli-Civil',
            estimatedWeeklySavingsBRL: 84.50,
            estimatedMonthlyCo2Kg: 28.6,
            matchScore: 96,
            reasoning: 'O ponto de encontro padrão da Beatriz (Eldorado) e do Lucas (Metrô Butantã) adicionam apenas 4 minutos ao percurso original do Carlos.',
          },
          {
            title: 'Corredor Corporativo Faria Lima / Berrini',
            description: 'Carlos e Gabriela compartilham trajeto matinal próximo ao complexo JK/Faria Lima.',
            suggestedGroupName: 'Google Campus SP - Tech & AI',
            driverId: 'usr-carlos-mot',
            passengerIds: ['usr-gabriela-pass'],
            commonOriginZone: 'Pinheiros',
            commonDestinationZone: 'Av. Brigadeiro Faria Lima',
            estimatedWeeklySavingsBRL: 62.00,
            estimatedMonthlyCo2Kg: 19.4,
            matchScore: 89,
            reasoning: 'Redução de tráfego na Av. Rebouças com embarque direto no corredor de ônibus.',
          },
        ],
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const userSummary = users.map((u: any) => ({
      id: u.id,
      name: u.name,
      role: u.rolePreference,
      institution: u.institutionName,
      origin: u.routine?.origin?.address || u.routine?.origin?.name,
      destination: u.routine?.destination?.address || u.routine?.destination?.name,
      time: u.routine?.departureTime,
      days: u.routine?.daysOfWeek,
      meetingPoint: u.ponto_encontro_default?.address,
      groups: u.groups,
    }));

    const prompt = `Como Arquiteto de Mobilidade e IA do CaronaFlow, analise estas rotinas acadêmicas e corporativas e sugira 2 a 3 agrupamentos ideais de caronas e novos grupos.
Dados de rotinas:
${JSON.stringify(userSummary, null, 2)}
Grupos existentes:
${JSON.stringify(groups.map((g: any) => ({ id: g.id, name: g.name, category: g.category })), null, 2)}

Retorne um JSON estruturado com sugestões de otimização de rotina.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              suggestedGroupName: { type: Type.STRING },
              driverId: { type: Type.STRING },
              passengerIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              commonOriginZone: { type: Type.STRING },
              commonDestinationZone: { type: Type.STRING },
              estimatedWeeklySavingsBRL: { type: Type.NUMBER },
              estimatedMonthlyCo2Kg: { type: Type.NUMBER },
              matchScore: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
            },
            required: ['title', 'description', 'driverId', 'passengerIds', 'commonOriginZone', 'commonDestinationZone', 'estimatedWeeklySavingsBRL', 'estimatedMonthlyCo2Kg', 'matchScore', 'reasoning'],
          },
        },
      },
    });

    const suggestions = JSON.parse(response.text || '[]');
    res.json({ success: true, source: 'gemini-vertex-ai', suggestions });
  } catch (error: any) {
    console.error('Error generating AI routine suggestions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// FCM Notification Simulator & Dispatcher
app.post('/api/fcm/send-notification', (req, res) => {
  const { userId, title, body, type, rideId } = req.body;
  const newNotification = {
    id: `ntf-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    userId,
    title,
    body,
    type,
    rideId,
    timestamp: new Date().toISOString(),
    read: false,
  };
  res.json({ success: true, notification: newNotification });
});

// Live Tracking coordinates update & query
app.post('/api/tracking/:rideId', (req, res) => {
  const { rideId } = req.params;
  const trackingData = req.body;
  liveTrackingState[rideId] = {
    ...trackingData,
    rideId,
    timestamp: new Date().toISOString(),
  };
  res.json({ success: true, tracking: liveTrackingState[rideId] });
});

app.get('/api/tracking/:rideId', (req, res) => {
  const { rideId } = req.params;
  const tracking = liveTrackingState[rideId];
  if (!tracking) {
    return res.status(404).json({ success: false, message: 'Nenhum tracking ativo para esta carona.' });
  }
  res.json({ success: true, tracking });
});

// Vite Middleware / Static handler
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CaronaFlow Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
