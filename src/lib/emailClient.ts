export interface EmailConfirmationRequest {
  type: 
    | 'RIDE_CREATED'
    | 'RIDE_REQUEST_SENT'
    | 'NEW_PASSENGER_REQUEST'
    | 'REQUEST_ACCEPTED'
    | 'REQUEST_REJECTED'
    | 'PROPOSAL_OFFERED'
    | 'PROPOSAL_ACCEPTED'
    | 'RIDE_STARTED'
    | 'RIDE_COMPLETED'
    | 'RIDE_CANCELLED'
    | 'PASSENGER_REMOVED'
    | 'NEW_RIDE_GROUP'
    | 'WELCOME';
  recipientEmail: string;
  recipientName: string;
  recipientUserId?: string;
  recipientEmailVerified?: boolean;
  rideId?: string;
  cancellationReason?: string;
  rideData?: {
    originAddress?: string;
    destinationAddress?: string;
    departureDate?: string;
    departureTime?: string;
    price?: number;
    totalSeats?: number;
    availableSeats?: number;
    vehicleModel?: string;
    vehiclePlate?: string;
    driverName?: string;
    passengerName?: string;
    meetingPointAddress?: string;
    groupName?: string;
    notes?: string;
    cancellationReason?: string;
    carbonSavingKg?: number;
  };
}

export interface EmailDeliveryRecord {
  id: string;
  timestamp: string;
  recipientEmail: string;
  recipientName?: string;
  recipientUserId?: string;
  type: string;
  subject: string;
  success: boolean;
  simulated: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
  reason?: string;
}

export interface EmailDeliveryLogsResponse {
  success: boolean;
  logs: EmailDeliveryRecord[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    deliveryRate: number;
  };
}

/**
 * Dispatches an email confirmation to the backend API
 */
export async function sendEmailConfirmation(payload: EmailConfirmationRequest): Promise<{
  success: boolean;
  simulated?: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
  recipient?: string;
  logId?: string;
}> {
  if (!payload.recipientEmail || !payload.recipientEmail.includes('@')) {
    console.warn('[EmailClient] E-mail de destinatário inválido ou não informado:', payload.recipientEmail);
    return { success: false, error: 'E-mail inválido ou não informado' };
  }

  try {
    const res = await fetch('/api/email/send-confirmation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return data;
    } else {
      const text = await res.text();
      console.warn('[EmailClient] Servidor retornou resposta não-JSON:', text.substring(0, 150));
      if (res.ok) {
        return { success: true, simulated: true };
      }
      return { success: false, error: `Servidor retornou status ${res.status}` };
    }
  } catch (err: any) {
    console.error('[EmailClient Error] Falha ao enviar requisição de e-mail:', err);
    return { success: false, error: err.message || 'Erro de rede ao conectar com o serviço de e-mail' };
  }
}

/**
 * Fetches recent email delivery audit logs for monitoring
 */
export async function fetchEmailDeliveryLogs(email?: string): Promise<EmailDeliveryLogsResponse> {
  try {
    const url = email ? `/api/email/delivery-logs?email=${encodeURIComponent(email)}` : '/api/email/delivery-logs';
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, logs: [], summary: { total: 0, successful: 0, failed: 0, deliveryRate: 100 } };
  } catch {
    return { success: false, logs: [], summary: { total: 0, successful: 0, failed: 0, deliveryRate: 100 } };
  }
}

/**
 * Triggers a real-time diagnostic test email to verify delivery
 */
export async function testEmailDelivery(params: {
  email: string;
  userName?: string;
}): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string; validated?: boolean; recipient?: string; logId?: string }> {
  try {
    const res = await fetch('/api/email/test-delivery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(params),
    });
    return await res.json();
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao conectar ao serviço de teste de e-mail' };
  }
}

/**
 * Fetches failed email delivery logs for a given recipient email or userId
 */
export async function fetchEmailFailures(params?: { email?: string; userId?: string }): Promise<{
  success: boolean;
  failures: EmailDeliveryRecord[];
  hasFailures: boolean;
  count: number;
}> {
  try {
    const query = new URLSearchParams();
    if (params?.email) query.set('email', params.email);
    if (params?.userId) query.set('userId', params.userId);
    const res = await fetch(`/api/email/failures?${query.toString()}`, { headers: { 'Accept': 'application/json' } });
    if (res.ok) {
      return await res.json();
    }
    return { success: false, failures: [], hasFailures: false, count: 0 };
  } catch {
    return { success: false, failures: [], hasFailures: false, count: 0 };
  }
}

/**
 * Returns human-friendly label for email notification type
 */
export function getHumanReadableEmailType(type: string): string {
  switch (type) {
    case 'RIDE_CREATED': return 'Publicação de Nova Carona';
    case 'RIDE_REQUEST_SENT': return 'Solicitação de Vaga Enviada';
    case 'NEW_PASSENGER_REQUEST': return 'Novo Pedido de Carona Recebido';
    case 'REQUEST_ACCEPTED': return 'Vaga Confirmada na Carona';
    case 'REQUEST_REJECTED': return 'Solicitação de Vaga Recusada';
    case 'PROPOSAL_OFFERED': return 'Nova Proposta de Acolhimento';
    case 'PROPOSAL_ACCEPTED': return 'Proposta de Carona Aceita';
    case 'RIDE_STARTED': return 'Início de Viagem & Trajeto GPS';
    case 'RIDE_COMPLETED': return 'Conclusão da Viagem & Recibo';
    case 'RIDE_CANCELLED': return 'Cancelamento de Carona';
    case 'PASSENGER_REMOVED': return 'Remoção de Passageiro da Viagem';
    case 'NEW_RIDE_GROUP': return 'Nova Viagem Anunciada no Grupo';
    case 'WELCOME': return 'Boas-vindas ao CaronaFlow';
    default: return 'Notificação de Viagem';
  }
}

export interface MonitoredDispatchOptions {
  payload: EmailConfirmationRequest;
  recipientUser?: { id: string; email?: string; name?: string; emailVerified?: boolean } | null;
  onDeliveryFailure?: (details: {
    recipientEmail: string;
    recipientUserId?: string;
    recipientName?: string;
    actionDescription: string;
    reason: string;
    type: string;
    rideId?: string;
  }) => void | Promise<void>;
}

/**
 * Sends confirmation email with automated delivery monitoring.
 * If the delivery fails or is skipped (e.g. unverified email, SMTP fault), triggers failure callback
 * to alert the recipient user.
 */
export async function sendMonitoredEmailConfirmation(options: MonitoredDispatchOptions): Promise<{
  success: boolean;
  simulated?: boolean;
  messageId?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
  recipient?: string;
  logId?: string;
}> {
  const { payload, recipientUser, onDeliveryFailure } = options;

  if (recipientUser) {
    if (!payload.recipientUserId && recipientUser.id) {
      payload.recipientUserId = recipientUser.id;
    }
    if (recipientUser.emailVerified !== undefined && payload.recipientEmailVerified === undefined) {
      payload.recipientEmailVerified = recipientUser.emailVerified;
    }
  }

  const result = await sendEmailConfirmation(payload);

  if (!result.success || result.skipped) {
    const actionLabel = getHumanReadableEmailType(payload.type);
    const failureReason = result.skipped
      ? 'E-mail não validado no sistema (notificações automáticas suspensas até validação de segurança com PIN de 6 dígitos).'
      : (result.error || result.reason || 'Falha no serviço de entrega SMTP ou servidor de e-mail.');

    console.warn(`[Email Monitor] ⚠️ Falha na entrega de e-mail para ${payload.recipientEmail}: ${failureReason}`);

    if (onDeliveryFailure) {
      try {
        await onDeliveryFailure({
          recipientEmail: payload.recipientEmail,
          recipientUserId: payload.recipientUserId || recipientUser?.id,
          recipientName: payload.recipientName || recipientUser?.name,
          actionDescription: actionLabel,
          reason: failureReason,
          type: payload.type,
          rideId: payload.rideId,
        });
      } catch (err) {
        console.warn('[Email Monitor] Erro ao disparar callback onDeliveryFailure:', err);
      }
    }
  }

  return result;
}

/**
 * Checks backend SMTP status
 */
export async function checkEmailServiceStatus(): Promise<{ success: boolean; isConfigured: boolean; host?: string; port?: number; user?: string; smtp?: { configured: boolean; host?: string; user?: string } }> {
  try {
    const res = await fetch('/api/email/status', {
      headers: {
        'Accept': 'application/json',
      },
    });

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return {
        ...data,
        smtp: {
          configured: data.isConfigured,
          host: data.host,
          user: data.user,
        },
      };
    }
    return { success: false, isConfigured: false, smtp: { configured: false } };
  } catch (err: any) {
    return { success: false, isConfigured: false, smtp: { configured: false } };
  }
}

export const checkEmailHealth = checkEmailServiceStatus;

/**
 * Requests a 6-digit email validation code sent from contato@apponline.ia.br
 */
export async function requestEmailVerificationCode(params: {
  email: string;
  userName?: string;
}): Promise<{ success: boolean; simulated?: boolean; messageId?: string; devVerificationCode?: string; error?: string }> {
  try {
    const res = await fetch('/api/email/send-verification-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[EmailClient Error] Falha ao solicitar código de validação:', err);
    return { success: false, error: err.message || 'Erro ao conectar com o serviço de validação' };
  }
}

/**
 * Validates the 6-digit email code against the backend
 */
export async function verifyEmailCode(params: {
  email: string;
  code: string;
}): Promise<{ success: boolean; verified?: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/email/verify-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[EmailClient Error] Falha ao verificar código:', err);
    return { success: false, error: err.message || 'Erro ao conectar com o servidor' };
  }
}

/**
 * Checks if an email is marked as validated on the server
 */
export async function checkEmailValidationStatus(email: string): Promise<{ isValidated: boolean }> {
  try {
    const res = await fetch(`/api/email/validation-status?email=${encodeURIComponent(email)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return { isValidated: Boolean(data.isValidated) };
    }
    return { isValidated: false };
  } catch {
    return { isValidated: false };
  }
}

/**
 * Requests a 6-digit password reset PIN sent to user's registered email
 */
export async function requestPasswordResetCode(params: {
  email: string;
  userName?: string;
}): Promise<{ success: boolean; simulated?: boolean; messageId?: string; devResetCode?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/send-password-reset-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[EmailClient Error] Falha ao solicitar código de recuperação:', err);
    return { success: false, error: err.message || 'Erro ao conectar com o serviço de segurança' };
  }
}

/**
 * Validates the 6-digit password reset PIN
 */
export async function verifyPasswordResetCode(params: {
  email: string;
  code: string;
}): Promise<{ success: boolean; verified?: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/auth/verify-password-reset-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error('[EmailClient Error] Falha ao verificar código de recuperação:', err);
    return { success: false, error: err.message || 'Erro ao validar código' };
  }
}

/**
 * Consumes the password reset code
 */
export async function consumePasswordResetCode(email: string): Promise<void> {
  try {
    await fetch('/api/auth/consume-password-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
  } catch (e) {
    // ignore
  }
}

