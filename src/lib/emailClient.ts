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
    | 'WELCOME';
  recipientEmail: string;
  recipientName: string;
  recipientEmailVerified?: boolean;
  rideId?: string;
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
    carbonSavingKg?: number;
  };
}

/**
 * Dispatches an email confirmation to the backend API
 */
export async function sendEmailConfirmation(payload: EmailConfirmationRequest): Promise<{ success: boolean; simulated?: boolean; messageId?: string; error?: string }> {
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
