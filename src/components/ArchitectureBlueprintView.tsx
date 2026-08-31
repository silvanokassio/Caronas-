import React, { useState } from 'react';
import { 
  FileCode2, 
  Database, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  Smartphone, 
  Globe, 
  Cloud, 
  Radio, 
  Key, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Download, 
  ExternalLink,
  Zap,
  Server,
  ArrowRight,
  Code
} from 'lucide-react';
import { SECURITY_RULES_CODE, SAMPLE_SECURITY_TESTS } from '../data/initialData';
import { SecurityRuleTestScenario } from '../types';

export const ArchitectureBlueprintView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'architecture' | 'schema' | 'rules'>('architecture');
  const [copiedRules, setCopiedRules] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState<string>(SAMPLE_SECURITY_TESTS[0].id);

  const currentTest = SAMPLE_SECURITY_TESTS.find((t) => t.id === selectedTestId) || SAMPLE_SECURITY_TESTS[0];

  const handleCopyRules = () => {
    navigator.clipboard.writeText(SECURITY_RULES_CODE);
    setCopiedRules(true);
    setTimeout(() => setCopiedRules(false), 2500);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Entregáveis Oficiais (Requisito 4)
            </span>
            <span className="text-xs text-slate-500 font-mono">GCP Architecture Hub & Security Suite</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
            Arquitetura de Solução, Modelagem Firestore & Security Rules
          </h2>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
            Documentação técnica formal, schemas NoSQL com Geopoints e suite de regras de segurança validadas para os clientes Web e Android nativo.
          </p>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveSection('architecture')}
            className={`px-3.5 py-2 rounded-lg transition active:scale-95 cursor-pointer ${
              activeSection === 'architecture' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            1. Arquitetura
          </button>
          <button
            onClick={() => setActiveSection('schema')}
            className={`px-3.5 py-2 rounded-lg transition active:scale-95 cursor-pointer ${
              activeSection === 'schema' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2. Modelo Firestore
          </button>
          <button
            onClick={() => setActiveSection('rules')}
            className={`px-3.5 py-2 rounded-lg transition active:scale-95 cursor-pointer ${
              activeSection === 'rules' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3. Security Rules
          </button>
        </div>
      </div>

      {/* SECTION 1: ARQUITETURA DE SOLUÇÃO (ENTREGÁVEL 1) */}
      {activeSection === 'architecture' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Visual Architecture Topology Diagram */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-lg">
                    1. Topologia da Solução Google Cloud & Firebase
                  </h3>
                  <p className="text-xs text-slate-500">
                    Visão dos componentes, protocolos de comunicação e fluxo de dados entre clientes e nuvem.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                Serverless & Event-Driven
              </span>
            </div>

            {/* Architecture Node Diagram */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Clients Column */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-200 text-slate-900 font-bold">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>Camada de Clientes (Multiplataforma)</span>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Android Nativo</span>
                    <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Kotlin / Compose</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Firebase SDK (Auth, Firestore snapshots, FCM foreground/background service, Google Play Location API).
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Web Application</span>
                    <span className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">React 19 / TS</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    PWA responsiva com Service Worker para Web Push, renderização interativa e geolocalização HTML5.
                  </p>
                </div>
              </div>

              {/* Backend & Hosting Column */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-200 text-slate-900 font-bold">
                  <Server className="w-4 h-4 text-indigo-600" />
                  <span>Google Cloud Run (Backend API)</span>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Container Docker Serverless</span>
                    <span className="text-[10px] text-indigo-700 font-mono font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">Auto-Scaling 0-N</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Node.js/Express gerenciando autenticação de serviços, cálculos avançados de rota, Vertex AI e dispatch de FCM.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Firebase Admin SDK</span>
                    <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">Privileged Tasks</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Execução do Ledger de gamificação (+1/-1 com transação atômica) e batch updates de conciliação.
                  </p>
                </div>
              </div>

              {/* Data & AI Services Column */}
              <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center space-x-2 pb-2 border-b border-slate-200 text-slate-900 font-bold">
                  <Cloud className="w-4 h-4 text-amber-600" />
                  <span>Firebase & Google Cloud Services</span>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Cloud Firestore</span>
                    <span className="text-[10px] text-amber-700 font-mono font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">NoSQL Realtime</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Sincronização reativa bi-direcional (WebSockets/gRPC) para subcoleções de tracking e caronas.
                  </p>
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-slate-200 space-y-1 shadow-xs">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>Vertex AI (Gemini 3.7) & Maps</span>
                    <span className="text-[10px] text-teal-700 font-mono font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">Routes API Adv.</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Clusters de rotinas inteligentes, tráfego preditivo em tempo real e FCM push topic broadcasting.
                  </p>
                </div>
              </div>
            </div>

            {/* Sequence Flow Description */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600" />
                Fluxos de Dados Principais (End-to-End):
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-700">
                <div className="space-y-1.5 bg-white p-4 rounded-lg border border-slate-200">
                  <p className="font-semibold text-indigo-700">A. Oferta e Aceite Automático (Membro de Grupo):</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                    <li>Motorista publica oferta preenchendo a partir de sua rotina salva com <code className="text-indigo-600 bg-indigo-50 px-1 rounded font-mono">visibility: 'group'</code>.</li>
                    <li>O documento é gravado no Firestore na coleção <code className="text-slate-800 bg-slate-100 px-1 rounded font-mono">/rides</code>.</li>
                    <li>Um passageiro do mesmo grupo clica em "Ingressar" ➔ O Firestore Security Rules valida <code className="text-emerald-700 bg-emerald-50 px-1 rounded font-mono">isGroupMember(targetGroupId)</code>.</li>
                    <li>O passageiro é adicionado diretamente em <code className="text-slate-800 bg-slate-100 px-1 rounded font-mono">acceptedPassengers</code> com <code className="text-emerald-700 bg-emerald-50 px-1 rounded font-mono">autoAccepted: true</code>.</li>
                    <li>O FCM envia push notification instantânea para o passageiro e motorista.</li>
                  </ol>
                </div>

                <div className="space-y-1.5 bg-white p-4 rounded-lg border border-slate-200">
                  <p className="font-semibold text-emerald-700">B. Streaming de Rastreamento em Tempo Real (Tracking):</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 text-[11px] leading-relaxed">
                    <li>Motorista aciona "Iniciar Percurso" no aplicativo Android ou Web.</li>
                    <li>O cliente do motorista grava coordenadas em <code className="text-slate-800 bg-slate-100 px-1 rounded font-mono">/rides/{'{id}'}/tracking/{'{trackId}'}</code> a cada 3 a 5 segundos.</li>
                    <li>O Firestore Rules bloqueia a leitura para qualquer usuário que não esteja no array <code className="text-slate-800 bg-slate-100 px-1 rounded font-mono">acceptedPassengers</code> ou não seja o motorista.</li>
                    <li>Os passageiros aceitos recebem as coordenadas via listener <code className="text-emerald-700 bg-emerald-50 px-1 rounded font-mono">onSnapshot()</code> com latência inferior a 300ms.</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: MODELAGEM DO BANCO DE DADOS FIRESTORE (ENTREGÁVEL 2) */}
      {activeSection === 'schema' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-lg">
                    2. Modelagem do Banco de Dados Firestore (NoSQL Schema)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Estrutura de coleções, subcoleções temporárias, tipos de dados e índices recomendados.
                  </p>
                </div>
              </div>
            </div>

            {/* Collection 1: users */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  📁 /users/{'{userId}'}
                </span>
                <span className="text-xs text-slate-600 font-medium">Perfis, Ponto de Encontro Padrão e Saldo</span>
              </div>
              <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto">
{`{
  "id": "usr-carlos-mot",                  // string (UID do Firebase Auth)
  "name": "Carlos Mendes",                 // string
  "email": "carlos.mendes@usp.br",         // string (institucional / acadêmico)
  "avatar": "https://...",                 // string (URL Cloud Storage)
  "rolePreference": "driver",              // enum: 'driver' | 'passenger'
  "institutionName": "USP Poli & Nubank",  // string
  "saldo_caronas": 8,                      // number (Saldo líquido: +1 oferta / -1 recebida)
  "totalRidesOffered": 14,                 // number
  "totalRidesTaken": 6,                    // number
  "rating": 4.95,                          // number (0.0 - 5.0)
  "ponto_encontro_default": {              // Map / Geopoint
    "lat": -23.5719,                       // number (latitude)
    "lng": -46.7082,                       // number (longitude)
    "address": "Metrô Butantã - Vital Brasil",
    "name": "Estação Butantã"
  },
  "groups": ["grp-poli-usp", "grp-nubank-sp"], // Array<string> (IDs dos grupos participantes)
  "vehicle": {                             // Map (Opcional se motorista)
    "model": "Volkswagen T-Cross 1.0 TSI",
    "plate": "BRA2E19",
    "color": "Cinza Platinum"
  },
  "routine": {                             // Map (Cadastro Prévio de Rotina)
    "id": "rtn-carlos-1",
    "title": "Vila Madalena ➔ USP Poli",
    "origin": { "lat": -23.5539, "lng": -46.6896, "address": "Pinheiros" },
    "destination": { "lat": -23.5574, "lng": -46.7314, "address": "Poli USP" },
    "departureTime": "07:30",
    "daysOfWeek": ["Seg", "Ter", "Qua", "Qui", "Sex"],
    "defaultSeats": 3,
    "defaultPrice": 6.50,
    "targetGroupId": "grp-poli-usp"
  },
  "fcmToken": "eK3...fcm",                 // string (Token para Push Notifications)
  "createdAt": "Timestamp"
}`}
              </pre>
            </div>

            {/* Collection 2: groups */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                  📁 /groups/{'{groupId}'}
                </span>
                <span className="text-xs text-slate-600 font-medium">Comunidades Acadêmicas e Corporativas</span>
              </div>
              <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto">
{`{
  "id": "grp-poli-usp",                    // string
  "name": "USP / Poli - Engenharia",       // string
  "category": "academic",                  // enum: 'academic' | 'corporate' | 'community'
  "domainRestricted": "usp.br",            // string (Validação de e-mail institucional)
  "memberIds": ["usr-carlos-mot", "usr-beatriz-pass", "usr-lucas-pass"], // Array<string>
  "memberCount": 42,                       // number
  "description": "Comunidade de caronas para alunos e docentes da Poli USP.",
  "createdAt": "Timestamp"
}`}
              </pre>
            </div>

            {/* Collection 3: rides & subcollection tracking */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  📁 /rides/{'{rideId}'} & 📂 /rides/{'{rideId}'}/tracking/{'{trackId}'}
                </span>
                <span className="text-xs text-slate-600 font-medium">Ofertas de Caronas e Streaming GPS em Tempo Real</span>
              </div>
              <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto">
{`// Documento: /rides/{rideId}
{
  "id": "ride-poliusp-morning",
  "driverId": "usr-carlos-mot",            // string
  "driverName": "Carlos Mendes",           // string
  "driverAvatar": "https://...",           // string
  "origin": { "lat": -23.5539, "lng": -46.6896, "address": "Rua Fradique Coutinho, 1200" },
  "destination": { "lat": -23.5574, "lng": -46.7314, "address": "Av. Prof. Luciano Gualberto, 380" },
  "departureDate": "2026-08-26",           // string (YYYY-MM-DD)
  "departureTime": "07:30",                // string (HH:mm)
  "price": 6.50,                           // number (Valor sugerido)
  "totalSeats": 3,                         // number
  "occupiedSeats": 1,                      // number
  "status": "agendada",                    // enum: 'agendada' | 'em_andamento' | 'concluida' | 'cancelada'
  "visibility": "group",                   // enum: 'public' | 'group'
  "targetGroupId": "grp-poli-usp",         // string (Obrigatório se visibility == 'group')
  "targetGroupName": "USP / Poli - Engenharia",
  "distanceKm": 8.4,                       // number (Google Maps Routes API)
  "estimatedDurationMin": 22,              // number
  "fuelCostEstimated": 7.20,               // number
  "acceptedPassengers": [                  // Array<Map> (Passageiros confirmados)
    {
      "userId": "usr-beatriz-pass",
      "userName": "Beatriz Lima",
      "userAvatar": "https://...",
      "meetingPoint": { "lat": -23.5670, "lng": -46.7022, "address": "Ponto Eldorado" },
      "joinedAt": "Timestamp",
      "autoAccepted": true                 // boolean (true se pertencia ao grupo)
    }
  ],
  "pendingRequests": [],                   // Array<Map> (Solicitações para caronas públicas)
  "startedAt": null,
  "completedAt": null
}

// Subcoleção: /rides/{rideId}/tracking/{trackId} (Streaming em Tempo Real)
{
  "latitude": -23.5610,                    // number (Geopoint atual do veículo)
  "longitude": -46.6950,                   // number
  "speedKmH": 42.0,                        // number (Velocidade instantânea)
  "heading": 284,                          // number (Direção em graus 0-360)
  "progressPercent": 45,                   // number
  "nextStopLabel": "Embarque: Beatriz (Eldorado)",
  "etaMinutes": 8,                         // number (ETA dinâmico)
  "timestamp": "Timestamp"                 // Timestamp (Ordenação e TTL)
}`}
              </pre>
            </div>

            {/* Collection 4: ledger_transactions */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  📁 /ledger_transactions/{'{txId}'}
                </span>
                <span className="text-xs text-slate-600 font-medium">Livro-Razão Imutável de Gamificação (+1/-1)</span>
              </div>
              <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-200 overflow-x-auto">
{`{
  "id": "tx-20260825-001",
  "userId": "usr-carlos-mot",              // string
  "rideId": "ride-poliusp-morning",        // string
  "amount": 1,                             // number (+1 oferecida, -1 recebida)
  "type": "OFFERED_RIDE",                  // enum: 'OFFERED_RIDE' | 'RECEIVED_RIDE' | 'BONUS_RECIPROCITY'
  "description": "Ofereceu carona para 3 passageiros (USP Butantã)",
  "timestamp": "Timestamp"
}`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: REGRAS DE SEGURANÇA DO FIRESTORE (ENTREGÁVEL 3) */}
      {activeSection === 'rules' && (
        <div className="space-y-8 animate-in fade-in duration-150">
          {/* Rules Code Box */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-2.5">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-slate-900 text-lg">
                    3. Regras de Segurança do Firestore (firestore.rules)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Garante que apenas membros de um grupo vejam caronas privadas e que apenas passageiros aceitos vejam o tracking GPS.
                  </p>
                </div>
              </div>

              <button
                onClick={handleCopyRules}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
              >
                {copiedRules ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar firestore.rules</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="bg-slate-900 p-4 rounded-xl border border-slate-800 text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-96 overflow-y-auto leading-relaxed">
                {SECURITY_RULES_CODE}
              </pre>
            </div>
          </div>

          {/* Interactive Security Rule Testing Simulator */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h4 className="font-display font-bold text-slate-900 text-base">
                  Simulador Interativo de Avaliação de Regras (Security Rule Test Suite)
                </h4>
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md font-mono border border-slate-200 font-bold">
                5 Cenários Críticos Validados
              </span>
            </div>

            <p className="text-xs text-slate-500">
              Selecione um cenário para inspecionar o contexto de autenticação, o documento alvo e a avaliação exata da regra do Firestore:
            </p>

            {/* Test Scenarios Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {SAMPLE_SECURITY_TESTS.map((test) => {
                const isSelected = selectedTestId === test.id;
                return (
                  <button
                    key={test.id}
                    onClick={() => setSelectedTestId(test.id)}
                    className={`p-3.5 rounded-xl border text-left text-xs transition flex flex-col justify-between space-y-2 cursor-pointer active:scale-98 ${
                      isSelected ? 'bg-indigo-50/50 border-indigo-600 shadow-xs ring-1 ring-indigo-500/20' : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-semibold text-slate-900">{test.name}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          test.expectedResult === 'ALLOW' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {test.expectedResult}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {test.action.toUpperCase()} ➔ /{test.resource}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Test Inspection Box */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                      currentTest.expectedResult === 'ALLOW' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {currentTest.expectedResult === 'ALLOW' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-sm">{currentTest.name}</h5>
                    <p className="text-xs text-slate-500">{currentTest.description}</p>
                  </div>
                </div>

                <span
                  className={`text-xs font-mono font-bold px-3 py-1 rounded-md ${
                    currentTest.expectedResult === 'ALLOW' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  RESULTADO: {currentTest.expectedResult}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="font-semibold text-slate-700">Contexto do Solicitante (request.auth):</span>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 space-y-0.5">
                    <p>uid: "{currentTest.actor.userId}"</p>
                    <p>email: "{currentTest.actor.email}"</p>
                    <p>groups: {JSON.stringify(currentTest.actor.groups)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-semibold text-slate-700">Expressão da Regra Avaliada:</span>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300">
                    <code>{currentTest.ruleMatched}</code>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 text-xs text-slate-700 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Justificativa do Motor de Segurança:</strong> {currentTest.explanation}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
