import { buildHtmlEmailTemplate } from './email';

export interface ConfirmationPayload {
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

export function generateEmailForAction(payload: ConfirmationPayload): { subject: string; html: string } {
  const { type, recipientName, rideData } = payload;
  const appUrl = process.env.APP_URL || 'https://caronasflow.apponline.ia.br';

  switch (type) {
    case 'RIDE_CREATED': {
      const subject = `🚗 Carona Agendada com Sucesso - ${rideData?.originAddress?.split(',')[0]} ➔ ${rideData?.destinationAddress?.split(',')[0]}`;
      const contentHtml = `
        <p>Sua carona foi cadastrada e disponibilizada no CaronaFlow para seus grupos e comunidade.</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            📋 Resumo do Itinerário
          </div>
          <div class="route-box">
            <div class="route-step">
              <span class="route-step-icon">📍</span>
              <div><strong>Origem:</strong> ${rideData?.originAddress || 'Não informado'}</div>
            </div>
            <div class="route-step">
              <span class="route-step-icon">🎯</span>
              <div><strong>Destino:</strong> ${rideData?.destinationAddress || 'Não informado'}</div>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Data de Saída:</span>
            <span class="info-value">${rideData?.departureDate || 'Hoje'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Horário Previsto:</span>
            <span class="info-value">${rideData?.departureTime || '--:--'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Valor de Rateio por Vaga:</span>
            <span class="info-value" style="color: #059669;">R$ ${(rideData?.price ?? 0).toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Vagas Disponibilizadas:</span>
            <span class="info-value">${rideData?.totalSeats || 4} vagas</span>
          </div>
          ${rideData?.vehicleModel ? `
          <div class="info-row">
            <span class="info-label">Veículo:</span>
            <span class="info-value">${rideData.vehicleModel} ${rideData.vehiclePlate ? `(${rideData.vehiclePlate})` : ''}</span>
          </div>
          ` : ''}
          ${rideData?.groupName ? `
          <div class="info-row">
            <span class="info-label">Grupo / Comunidade:</span>
            <span class="info-value">${rideData.groupName}</span>
          </div>
          ` : ''}
        </div>

        <p style="font-size: 13px; color: #475569;">
          Você receberá um e-mail a cada nova solicitação de passageiro para aprovar ou gerenciar.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Carona Confirmada',
          headline: 'Sua carona foi agendada!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Ver Minha Carona no App',
            url: appUrl,
          },
          footerNote: 'Dica: Você pode iniciar a viagem pelo app para ativar a telemetria em tempo real para os passageiros.',
        }),
      };
    }

    case 'NEW_RIDE_GROUP': {
      const groupDisplayName = rideData?.groupName ? `no Grupo "${rideData.groupName}"` : 'no seu Grupo';
      const origShort = rideData?.originAddress?.split(',')[0] || 'Origem';
      const destShort = rideData?.destinationAddress?.split(',')[0] || 'Destino';
      const subject = `🚗 Nova Viagem ${groupDisplayName}: ${origShort} ➔ ${destShort}`;
      const contentHtml = `
        <p>Olá, <strong>${recipientName}</strong>!</p>
        <p>Uma nova viagem foi disponibilizada por <strong>${rideData?.driverName || 'um membro'}</strong> ${groupDisplayName} no CaronaFlow.</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            📋 Detalhes da Viagem
          </div>
          <div class="route-box">
            <div class="route-step">
              <span class="route-step-icon">📍</span>
              <div><strong>Origem:</strong> ${rideData?.originAddress || 'Não informado'}</div>
            </div>
            <div class="route-step">
              <span class="route-step-icon">🎯</span>
              <div><strong>Destino:</strong> ${rideData?.destinationAddress || 'Não informado'}</div>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Data de Saída:</span>
            <span class="info-value">${rideData?.departureDate || 'Hoje'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Horário de Saída:</span>
            <span class="info-value">${rideData?.departureTime || '--:--'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Valor de Rateio:</span>
            <span class="info-value" style="color: #059669;">R$ ${(rideData?.price ?? 0).toFixed(2)} / vaga</span>
          </div>
          <div class="info-row">
            <span class="info-label">Vagas Disponíveis:</span>
            <span class="info-value">${rideData?.totalSeats || 4} vagas</span>
          </div>
          ${rideData?.driverName ? `
          <div class="info-row">
            <span class="info-label">Motorista:</span>
            <span class="info-value">${rideData.driverName}</span>
          </div>
          ` : ''}
          ${rideData?.vehicleModel ? `
          <div class="info-row">
            <span class="info-label">Veículo:</span>
            <span class="info-value">${rideData.vehicleModel} ${rideData.vehiclePlate ? `(${rideData.vehiclePlate})` : ''}</span>
          </div>
          ` : ''}
          ${rideData?.groupName ? `
          <div class="info-row">
            <span class="info-label">Grupo:</span>
            <span class="info-value">${rideData.groupName}</span>
          </div>
          ` : ''}
          ${rideData?.notes ? `
          <div class="info-row">
            <span class="info-label">Observações:</span>
            <span class="info-value">${rideData.notes}</span>
          </div>
          ` : ''}
        </div>

        <p style="font-size: 13px; color: #475569;">
          Garanta seu assento com antecedência pelo aplicativo.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Nova Viagem no Grupo',
          headline: 'Nova Carona Disponível',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Ver Viagem e Reservar Vaga',
            url: appUrl,
          },
          footerNote: 'Você recebeu esta mensagem porque é membro do grupo no CaronaFlow.',
        }),
      };
    }

    case 'RIDE_REQUEST_SENT': {
      const subject = `⏳ Solicitação de Vaga Enviada - Carona de ${rideData?.driverName || 'Motorista'}`;
      const contentHtml = `
        <p>Recebemos sua solicitação de embarque na carona de <strong>${rideData?.driverName || 'Motorista'}</strong>.</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            🚗 Dados da Carona Solicitada
          </div>
          <div class="route-box">
            <div class="route-step">
              <span class="route-step-icon">📍</span>
              <div><strong>Origem:</strong> ${rideData?.originAddress || 'Não informado'}</div>
            </div>
            <div class="route-step">
              <span class="route-step-icon">🎯</span>
              <div><strong>Destino:</strong> ${rideData?.destinationAddress || 'Não informado'}</div>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Motorista:</span>
            <span class="info-value">${rideData?.driverName || 'Não informado'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Horário de Saída:</span>
            <span class="info-value">${rideData?.departureDate || ''} às ${rideData?.departureTime || '--:--'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ponto de Encontro Escolhido:</span>
            <span class="info-value">${rideData?.meetingPointAddress || rideData?.originAddress || 'A combinar'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contribuição / Rateio:</span>
            <span class="info-value" style="color: #059669;">R$ ${(rideData?.price ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #475569;">
          O motorista foi notificado. Assim que ele aprovar seu pedido, você receberá um e-mail de confirmação com os dados completos de embarque.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Aguardando Aprovação',
          headline: 'Solicitação de vaga enviada!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Acompanhar no CaronaFlow',
            url: appUrl,
          },
        }),
      };
    }

    case 'NEW_PASSENGER_REQUEST': {
      const subject = `🙋 Novo Pedido de Vaga - ${rideData?.passengerName || 'Passageiro'} quer carona com você`;
      const contentHtml = `
        <p><strong>${rideData?.passengerName || 'Um passageiro'}</strong> solicitou uma vaga na sua carona.</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            👤 Detalhes da Solicitação
          </div>
          <div class="info-row">
            <span class="info-label">Passageiro:</span>
            <span class="info-value">${rideData?.passengerName || 'Passageiro'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Ponto de Embarque Sugerido:</span>
            <span class="info-value">${rideData?.meetingPointAddress || 'Ponto padrão'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Data e Hora:</span>
            <span class="info-value">${rideData?.departureDate || ''} às ${rideData?.departureTime || ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Vagas Restantes:</span>
            <span class="info-value">${rideData?.availableSeats ?? 1} vaga(s)</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #475569;">
          Acesse o painel do CaronaFlow para aprovar ou recusar este passageiro.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Novo Passageiro',
          headline: 'Você recebeu um pedido de vaga!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Aprovar Pedido no App',
            url: appUrl,
          },
        }),
      };
    }

    case 'REQUEST_ACCEPTED': {
      const subject = `✅ Vaga Aprovada! Sua carona com ${rideData?.driverName || 'o Motorista'} está confirmada`;
      const contentHtml = `
        <p style="color: #059669; font-weight: 700; font-size: 16px;">
          Boas notícias! Sua vaga foi aprovada pelo motorista.
        </p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            🚘 Detalhes do Embarque
          </div>
          <div class="route-box">
            <div class="route-step">
              <span class="route-step-icon">📍</span>
              <div><strong>Ponto de Encontro:</strong> ${rideData?.meetingPointAddress || rideData?.originAddress || 'Não informado'}</div>
            </div>
            <div class="route-step">
              <span class="route-step-icon">🎯</span>
              <div><strong>Destino:</strong> ${rideData?.destinationAddress || 'Não informado'}</div>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Motorista:</span>
            <span class="info-value">${rideData?.driverName || 'Não informado'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Veículo:</span>
            <span class="info-value">${rideData?.vehicleModel || 'Carro do Motorista'} ${rideData?.vehiclePlate ? `• Placa: ${rideData.vehiclePlate}` : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Horário de Saída:</span>
            <span class="info-value">${rideData?.departureDate || ''} às ${rideData?.departureTime || '--:--'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Valor da Contribuição:</span>
            <span class="info-value" style="color: #059669; font-size: 15px;">R$ ${(rideData?.price ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #475569;">
          Por favor, esteja no ponto de encontro com 5 minutos de antecedência. Você poderá acompanhar a localização do motorista em tempo real no app.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Vaga Confirmada',
          headline: 'Você está confirmado na carona!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Ver Detalhes da Viagem',
            url: appUrl,
          },
          footerNote: 'Segurança em primeiro lugar: confira sempre a placa do veículo antes de embarcar.',
        }),
      };
    }

    case 'REQUEST_REJECTED': {
      const subject = `⚠️ Atualização sobre sua solicitação de carona com ${rideData?.driverName || 'o Motorista'}`;
      const contentHtml = `
        <p>Infelizmente sua solicitação de vaga para a carona com <strong>${rideData?.driverName || 'o motorista'}</strong> não pôde ser aceita desta vez (as vagas podem ter sido preenchidas ou o trajeto teve alterações).</p>
        
        <p>Não se preocupe! Existem outras opções de carona disponíveis na sua comunidade e você também pode cadastrar um <strong>Pedido de Carona Solidário</strong> para que outros motoristas possam te acolher.</p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Status da Solicitação',
          headline: 'Solicitação não aceita',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Buscar Outras Caronas',
            url: appUrl,
          },
        }),
      };
    }

    case 'PROPOSAL_OFFERED': {
      const subject = `✨ Uma proposta de acolhimento foi enviada para seu pedido de carona!`;
      const contentHtml = `
        <p>O motorista <strong>${rideData?.driverName || 'Um motorista'}</strong> enviou uma proposta para acolher seu pedido de carona.</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            🤝 Detalhes da Proposta de Acolhimento
          </div>
          <div class="info-row">
            <span class="info-label">Motorista:</span>
            <span class="info-value">${rideData?.driverName || 'Motorista'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Veículo:</span>
            <span class="info-value">${rideData?.vehicleModel || 'Veículo cadastrado'} ${rideData?.vehiclePlate ? `(${rideData.vehiclePlate})` : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Horário Sugerido:</span>
            <span class="info-value">${rideData?.departureTime || '--:--'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Valor do Rateio Proposto:</span>
            <span class="info-value" style="color: #059669; font-size: 15px;">R$ ${(rideData?.price ?? 0).toFixed(2)}</span>
          </div>
          ${rideData?.notes ? `
          <div style="margin-top: 10px; font-size: 12px; color: #475569; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;">
            <strong>Mensagem do Motorista:</strong> "${rideData.notes}"
          </div>
          ` : ''}
        </div>

        <p style="font-size: 13px; color: #475569;">
          Para confirmar seu embarque, acesse o app e clique em <strong>"Aprovar & Entrar na Carona"</strong>.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Proposta Recebida',
          headline: 'Um motorista quer te dar carona!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Avaliar e Aprovar Proposta',
            url: appUrl,
          },
        }),
      };
    }

    case 'PROPOSAL_ACCEPTED': {
      const subject = `🎉 Proposta de Acolhimento Aceita - Carona Confirmada`;
      const contentHtml = `
        <p>A proposta de acolhimento foi aprovada e confirmada com sucesso!</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            📋 Dados da Carona Confirmada
          </div>
          <div class="route-box">
            <div class="route-step">
              <span class="route-step-icon">📍</span>
              <div><strong>Origem:</strong> ${rideData?.originAddress || 'Ponto de encontro'}</div>
            </div>
            <div class="route-step">
              <span class="route-step-icon">🎯</span>
              <div><strong>Destino:</strong> ${rideData?.destinationAddress || 'Destino combinado'}</div>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Horário:</span>
            <span class="info-value">${rideData?.departureTime || '--:--'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Valor de Rateio:</span>
            <span class="info-value" style="color: #059669;">R$ ${(rideData?.price ?? 0).toFixed(2)}</span>
          </div>
        </div>

        <p style="font-size: 13px; color: #475569;">
          Todos os participantes já estão vinculados à viagem. Bom trajeto!
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Acolhimento Concluído',
          headline: 'Carona oficialmente confirmada!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Abrir no CaronaFlow',
            url: appUrl,
          },
        }),
      };
    }

    case 'RIDE_STARTED': {
      const driverName = rideData?.driverName || 'Seu motorista';
      const subject = `🚗 ${driverName} iniciou a viagem! Acompanhe o trajeto em tempo real`;
      const contentHtml = `
        <p>Olá <strong>${recipientName}</strong>,</p>
        <p>O motorista <strong>${driverName}</strong> acabou de iniciar a viagem no CaronaFlow!</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            🛰️ Detalhes da Viagem & Telemetria em Tempo Real
          </div>
          <div class="info-row">
            <span class="info-label">Motorista:</span>
            <span class="info-value">${driverName}</span>
          </div>
          ${rideData?.vehicleModel ? `
          <div class="info-row">
            <span class="info-label">Veículo:</span>
            <span class="info-value">${rideData.vehicleModel} ${rideData.vehiclePlate ? `(${rideData.vehiclePlate})` : ''}</span>
          </div>
          ` : ''}
          ${rideData?.originAddress ? `
          <div class="info-row">
            <span class="info-label">Origem:</span>
            <span class="info-value">${rideData.originAddress}</span>
          </div>
          ` : ''}
          <div class="info-row">
            <span class="info-label">Destino:</span>
            <span class="info-value">${rideData?.destinationAddress || 'Não informado'}</span>
          </div>
          ${rideData?.departureDate ? `
          <div class="info-row">
            <span class="info-label">Data:</span>
            <span class="info-value">${rideData.departureDate}</span>
          </div>
          ` : ''}
        </div>

        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px; margin: 16px 0;">
          <p style="margin: 0; font-size: 13px; color: #065f46; font-weight: 600;">
            📍 Dica importante: Dirija-se ao seu ponto de encontro combinado com antecedência para garantir um embarque rápido e seguro.
          </p>
        </div>

        <p style="font-size: 13px; color: #475569;">
          Abra o CaronaFlow para acompanhar a rota ao vivo, o deslocamento do veículo no mapa e a estimativa de chegada (ETA).
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Viagem Iniciada',
          headline: 'Motorista a caminho!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Acompanhar Trajeto ao Vivo no App',
            url: appUrl,
          },
          footerNote: 'Aviso prioritário em tempo real emitido pelo CaronaFlow através do canal oficial contato@apponline.ia.br.',
        }),
      };
    }

    case 'RIDE_COMPLETED': {
      const subject = `🏁 Carona Concluída - Recibo de Rateio & Sustentabilidade`;
      const contentHtml = `
        <p>A carona foi finalizada com sucesso. Obrigado por contribuir para um trânsito mais sustentável e econômico!</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            🧾 Recibo da Viagem
          </div>
          <div class="info-row">
            <span class="info-label">Trajeto:</span>
            <span class="info-value">${rideData?.originAddress?.split(',')[0] || 'Origem'} ➔ ${rideData?.destinationAddress?.split(',')[0] || 'Destino'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contribuição / Rateio:</span>
            <span class="info-value" style="color: #059669; font-size: 15px;">R$ ${(rideData?.price ?? 0).toFixed(2)}</span>
          </div>
          ${rideData?.carbonSavingKg ? `
          <div class="info-row">
            <span class="info-label">🌱 CO₂ Economizado:</span>
            <span class="info-value" style="color: #047857;">${rideData.carbonSavingKg.toFixed(1)} kg de CO₂</span>
          </div>
          ` : ''}
        </div>

        <p style="font-size: 13px; color: #475569;">
          Não se esqueça de avaliar a carona no aplicativo para manter a confiança e segurança da comunidade.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Viagem Concluída',
          headline: 'Obrigado por viajar junto!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Avaliar Carona no App',
            url: appUrl,
          },
        }),
      };
    }

    case 'RIDE_CANCELLED': {
      const originShort = rideData?.originAddress?.split(',')[0] || 'Origem';
      const destShort = rideData?.destinationAddress?.split(',')[0] || 'Destino';
      const dateFormatted = rideData?.departureDate || 'Hoje';
      const reason = rideData?.cancellationReason || rideData?.notes;
      const subject = `❌ Viagem Cancelada: ${originShort} ➔ ${destShort} (${dateFormatted})`;
      
      const contentHtml = `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 16px 18px; margin-bottom: 18px;">
          <div style="font-weight: 800; font-size: 14px; color: #991b1b; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            ⚠️ Aviso Importante: Viagem Cancelada pelo Motorista
          </div>
          <p style="margin: 0; font-size: 13px; color: #b91c1c; line-height: 1.6;">
            Olá, <strong>${recipientName}</strong>. Informamos que a viagem programada na qual você estava cadastrado(a) como passageiro(a) foi <strong>cancelada ou excluída</strong> pelo motorista responsável.
          </p>
        </div>

        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 14px; color: #0f172a;">
            📋 Resumo da Viagem Cancelada
          </div>
          <div class="route-box" style="border-left-color: #ef4444;">
            <div class="route-step">
              <span class="route-step-icon">📍</span>
              <div><strong>Origem:</strong> ${rideData?.originAddress || 'Não informado'}</div>
            </div>
            <div class="route-step">
              <span class="route-step-icon">🎯</span>
              <div><strong>Destino:</strong> ${rideData?.destinationAddress || 'Não informado'}</div>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Motorista:</span>
            <span class="info-value"><strong>${rideData?.driverName || 'Motorista'}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">Data e Horário:</span>
            <span class="info-value">${rideData?.departureDate || 'Data programada'} às ${rideData?.departureTime || '--:--'}</span>
          </div>
          ${rideData?.vehicleModel ? `
          <div class="info-row">
            <span class="info-label">Veículo:</span>
            <span class="info-value">${rideData.vehicleModel} ${rideData.vehiclePlate ? `• Placa: ${rideData.vehiclePlate}` : ''}</span>
          </div>
          ` : ''}
          ${rideData?.groupName ? `
          <div class="info-row">
            <span class="info-label">Grupo / Comunidade:</span>
            <span class="info-value">${rideData.groupName}</span>
          </div>
          ` : ''}
          ${reason ? `
          <div class="info-row" style="background: #fff1f2; padding: 10px 14px; border-radius: 10px; margin-top: 10px; border: 1px solid #ffe4e6;">
            <span class="info-label" style="color: #9f1239; font-weight: 700;">Motivo informado:</span>
            <span class="info-value" style="color: #881337; font-style: italic;">"${reason}"</span>
          </div>
          ` : ''}
        </div>

        <div class="card" style="background: #f0fdf4; border: 1px solid #bbf7d0; margin-top: 14px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; color: #166534;">
            🛡️ Sua Segurança e Vaga
          </div>
          <p style="margin: 0; font-size: 12px; color: #15803d; line-height: 1.6;">
            • Sua vaga foi cancelada no sistema e <strong>nenhum valor de rateio ou débito foi efetuado</strong> em sua conta.<br />
            • A sua solicitação de vaga foi liberada e você já pode pesquisar e solicitar carona em outros veículos disponíveis na mesma rota e horário.
          </p>
        </div>

        <p style="font-size: 13px; color: #475569; margin-top: 16px; line-height: 1.5;">
          Abra o CaronaFlow para encontrar outras vagas compatíveis com a sua rotina ou publicar um pedido direto para seus colegas de grupo.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Viagem Cancelada',
          headline: 'Aviso de Cancelamento de Viagem',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Buscar Outra Carona no CaronaFlow',
            url: appUrl,
          },
          footerNote: 'CaronaFlow • Notificações em tempo real para passageiros e motoristas.',
        }),
      };
    }

    case 'PASSENGER_REMOVED': {
      const originShort = rideData?.originAddress?.split(',')[0] || 'Origem';
      const destShort = rideData?.destinationAddress?.split(',')[0] || 'Destino';
      const dateFormatted = rideData?.departureDate || 'Hoje';
      const reason = payload.cancellationReason || rideData?.cancellationReason || rideData?.notes || 'Não informado pelo motorista';
      const subject = `⚠️ Vaga Cancelada: Exclusão da Carona para ${destShort} (${dateFormatted})`;

      const contentHtml = `
        <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 14px; padding: 16px 18px; margin-bottom: 18px;">
          <div style="font-weight: 800; font-size: 14px; color: #c2410c; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            ⚠️ Aviso de Exclusão de Vaga pelo Motorista
          </div>
          <p style="margin: 0; font-size: 13px; color: #9a3412; line-height: 1.6;">
            Olá, <strong>${recipientName}</strong>. Informamos que o motorista <strong>${rideData?.driverName || 'Motorista'}</strong> excluiu a sua reserva na carona com destino a <strong>${destShort}</strong>.
          </p>
        </div>

        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 14px; color: #0f172a;">
            📋 Detalhes do Itinerário
          </div>
          <div class="route-box" style="border-left-color: #f97316;">
            <div class="route-step">
              <span class="route-step-icon">📍</span>
              <div><strong>Origem:</strong> ${rideData?.originAddress || 'Não informado'}</div>
            </div>
            <div class="route-step">
              <span class="route-step-icon">🎯</span>
              <div><strong>Destino:</strong> ${rideData?.destinationAddress || 'Não informado'}</div>
            </div>
          </div>
          
          <div class="info-row">
            <span class="info-label">Motorista:</span>
            <span class="info-value"><strong>${rideData?.driverName || 'Motorista'}</strong></span>
          </div>
          <div class="info-row">
            <span class="info-label">Data e Horário:</span>
            <span class="info-value">${rideData?.departureDate || 'Data programada'} às ${rideData?.departureTime || '--:--'}</span>
          </div>
          ${rideData?.vehicleModel ? `
          <div class="info-row">
            <span class="info-label">Veículo:</span>
            <span class="info-value">${rideData.vehicleModel} ${rideData.vehiclePlate ? `• Placa: ${rideData.vehiclePlate}` : ''}</span>
          </div>
          ` : ''}
          ${rideData?.groupName ? `
          <div class="info-row">
            <span class="info-label">Grupo:</span>
            <span class="info-value">${rideData.groupName}</span>
          </div>
          ` : ''}

          <div class="info-row" style="background: #fff7ed; padding: 12px 14px; border-radius: 10px; margin-top: 12px; border: 1px solid #ffedd5;">
            <span class="info-label" style="color: #c2410c; font-weight: 800; display: block; margin-bottom: 4px;">Justificativa Informada pelo Motorista:</span>
            <span class="info-value" style="color: #9a3412; font-style: italic; font-weight: 600; font-size: 13.5px; display: block;">"${reason}"</span>
          </div>
        </div>

        <div class="card" style="background: #f0fdf4; border: 1px solid #bbf7d0; margin-top: 14px;">
          <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; color: #166534;">
            🛡️ Sua Segurança e Finanças
          </div>
          <p style="margin: 0; font-size: 12px; color: #15803d; line-height: 1.6;">
            • Sua vaga foi liberada e <strong>nenhum valor de rateio ou débito foi efetuado</strong> em sua conta.<br />
            • Você já pode pesquisar e reservar novas vagas em outras caronas convergentes diretamente no CaronaFlow.
          </p>
        </div>

        <p style="font-size: 13px; color: #475569; margin-top: 16px; line-height: 1.5;">
          Acesse o aplicativo para explorar rotas alternativas de colegas de grupo com trajetos e horários semelhantes.
        </p>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Vaga Cancelada',
          headline: 'Aviso de Exclusão de Passageiro',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Buscar Outras Caronas no CaronaFlow',
            url: appUrl,
          },
          footerNote: 'CaronaFlow • Notificações em tempo real para passageiros e motoristas.',
        }),
      };
    }

    case 'WELCOME': {
      const subject = `👋 Bem-vindo(a) ao CaronaFlow! Sua rede de mobilidade inteligente`;
      const contentHtml = `
        <p>Estamos muito felizes em ter você conosco na comunidade do <strong>CaronaFlow</strong>!</p>
        
        <div class="card">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 12px; color: #0f172a;">
            🚀 O que você pode fazer agora:
          </div>
          <div style="margin-bottom: 10px; font-size: 13px;">
            <strong>🚗 Oferecer Caronas:</strong> Compartilhe seus trajetos de rotina e divida os custos de combustível.
          </div>
          <div style="margin-bottom: 10px; font-size: 13px;">
            <strong>🙋 Pedir Caronas:</strong> Encontre vagas convenientes para a faculdade, trabalho ou eventos.
          </div>
          <div style="margin-bottom: 10px; font-size: 13px;">
            <strong>👥 Participar de Grupos:</strong> Conecte-se com colegas da sua empresa ou universidade.
          </div>
          <div style="font-size: 13px;">
            <strong>🌱 Reduzir Emissões:</strong> Acumule pontos de sustentabilidade e acompanhe seu impacto verde.
          </div>
        </div>
      `;

      return {
        subject,
        html: buildHtmlEmailTemplate({
          title: subject,
          badgeText: 'Conta Criada',
          headline: 'Bem-vindo(a) ao CaronaFlow!',
          recipientName,
          contentHtml,
          actionButton: {
            label: 'Explorar Caronas Agora',
            url: appUrl,
          },
        }),
      };
    }

    default:
      return {
        subject: `Notificação do CaronaFlow`,
        html: buildHtmlEmailTemplate({
          title: 'Notificação do CaronaFlow',
          headline: 'Atualização na sua conta',
          recipientName,
          contentHtml: '<p>Você possui uma nova atualização em sua conta no CaronaFlow.</p>',
          actionButton: {
            label: 'Abrir Aplicativo',
            url: appUrl,
          },
        }),
      };
  }
}

/**
 * Generates password reset code email sent from contato@apponline.ia.br
 */
export function generatePasswordResetCodeTemplate({
  code,
  recipientName,
  expiresInMinutes = 15,
}: {
  code: string;
  recipientName?: string;
  expiresInMinutes?: number;
}): { subject: string; html: string } {
  const subject = `🔑 Recuperação de Senha: ${code} - CaronaFlow`;
  const appUrl = process.env.APP_URL || 'https://caronasflow.apponline.ia.br';

  const contentHtml = `
    <p>Recebemos uma solicitação para <strong>redefinir a senha</strong> da sua conta no <strong>CaronaFlow</strong>.</p>
    <p>Para prosseguir e cadastrar uma nova senha com segurança, utilize o código PIN de 6 dígitos abaixo no aplicativo:</p>

    <div style="background: #f8fafc; border: 2px dashed #4f46e5; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
      <span style="display: block; font-size: 12px; font-weight: 700; color: #4338ca; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
        Código de Recuperação
      </span>
      <span style="display: inline-block; font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #1e1b4b; font-family: monospace; background: #ffffff; padding: 12px 28px; border-radius: 12px; border: 1px solid #c7d2fe; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.08);">
        ${code}
      </span>
      <span style="display: block; font-size: 12px; color: #64748b; margin-top: 14px;">
        ⏱️ Este código de segurança expira em <strong>${expiresInMinutes} minutos</strong>.
      </span>
    </div>

    <div class="card" style="background: #fffbeb; border: 1px solid #fde68a;">
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; color: #92400e;">
        ⚠️ Não solicitou a recuperação de senha?
      </div>
      <p style="margin: 0; font-size: 12px; color: #78350f; line-height: 1.5;">
        Se você não fez essa solicitação, sua senha atual permanece inalterada e segura. Você pode desconsiderar este e-mail tranquilamente.
      </p>
    </div>

    <div class="card" style="margin-top: 12px;">
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px; color: #0f172a;">
        🛡️ Recomendações de Segurança:
      </div>
      <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
        • Enviado oficialmente por <strong>contato@apponline.ia.br</strong>.<br />
        • Crie senhas fortes com no mínimo 6 caracteres, mesclando letras e números.<br />
        • Nunca informe este código para outra pessoa.
      </p>
    </div>
  `;

  return {
    subject,
    html: buildHtmlEmailTemplate({
      title: subject,
      badgeText: 'Recuperação de Acesso',
      headline: 'Redefinição de Senha',
      recipientName,
      contentHtml,
      actionButton: {
        label: 'Abrir Tela de Login',
        url: appUrl,
      },
      footerNote: 'CaronaFlow • Segurança e Transparência na Rede de Caronas',
    }),
  };
}

export function generateEmailVerificationCodeTemplate({
  code,
  recipientName,
  expiresInMinutes = 15,
}: {
  code: string;
  recipientName?: string;
  expiresInMinutes?: number;
}): { subject: string; html: string } {
  const subject = `🔐 Código de Validação de E-mail: ${code} - CaronaFlow`;
  const appUrl = process.env.APP_URL || 'https://caronasflow.apponline.ia.br';

  const contentHtml = `
    <p>Você solicitou a validação do seu endereço de e-mail no <strong>CaronaFlow</strong>.</p>
    <p>Para ativar o recebimento de e-mails automáticos de caronas, confirmações de vagas e notificações de viagem, utilize o código de segurança abaixo:</p>

    <div style="background: #f1f5f9; border: 2px dashed #6366f1; border-radius: 16px; padding: 24px; text-align: center; margin: 24px 0;">
      <span style="display: block; font-size: 12px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">
        Código de Validação
      </span>
      <span style="display: inline-block; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #0f172a; font-family: monospace; background: #ffffff; padding: 10px 24px; border-radius: 12px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.05);">
        ${code}
      </span>
      <span style="display: block; font-size: 12px; color: #64748b; margin-top: 12px;">
        ⏱️ Este código expira em <strong>${expiresInMinutes} minutos</strong>.
      </span>
    </div>

    <div class="card">
      <div style="font-weight: 700; font-size: 13px; margin-bottom: 8px; color: #0f172a;">
        🛡️ Informações de Segurança:
      </div>
      <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
        • Enviado oficialmente pelo canal <strong>contato@apponline.ia.br</strong>.<br />
        • Nunca compartilhe este código com terceiros.<br />
        • Após a validação, sua conta estará autorizada a receber todos os alertas em tempo real.
      </p>
    </div>
  `;

  return {
    subject,
    html: buildHtmlEmailTemplate({
      title: subject,
      badgeText: 'Validação de E-mail',
      headline: 'Valide seu E-mail no CaronaFlow',
      recipientName,
      contentHtml,
      actionButton: {
        label: 'Acessar CaronaFlow',
        url: appUrl,
      },
      footerNote: 'Se você não solicitou esta validação, por favor desconsidere esta mensagem com segurança.',
    }),
  };
}

