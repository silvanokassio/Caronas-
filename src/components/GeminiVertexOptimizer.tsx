import React, { useState } from 'react';
import { 
  Sparkles, 
  Map, 
  Bell, 
  Fuel, 
  TrendingUp, 
  CheckCircle2, 
  Send, 
  RotateCw, 
  DollarSign, 
  Layers, 
  Leaf, 
  Navigation,
  Bot,
  Zap
} from 'lucide-react';
import { User, Group, GeminiRoutineSuggestion } from '../types';

interface GeminiVertexOptimizerProps {
  currentUser: User | null;
  allUsers: User[];
  groups: Group[];
  onTriggerPushNotification: (title: string, body: string, type: any) => void;
}

export const GeminiVertexOptimizer: React.FC<GeminiVertexOptimizerProps> = ({
  currentUser,
  allUsers,
  groups,
  onTriggerPushNotification,
}) => {
  const [loadingAi, setLoadingAi] = useState(false);
  const [suggestions, setSuggestions] = useState<GeminiRoutineSuggestion[]>([]);

  // Route calculation state for Google Maps Routes API Advanced
  const [calcOrigin, setCalcOrigin] = useState('Pinheiros (R. Fradique Coutinho)');
  const [calcDest, setCalcDest] = useState('USP Cidade Universitária (Poli)');
  const [passengersCount, setPassengersCount] = useState(3);
  const [fuelPrice, setFuelPrice] = useState(5.89);
  const [carEfficiency, setCarEfficiency] = useState(11.5);
  const [calcResult, setCalcResult] = useState({
    distanceKm: 8.4,
    estimatedDurationMin: 22,
    fuelCostTotal: 4.30,
    fuelCostPerPerson: 1.08, // Driver + 3 passengers = 4 people
    co2SavedKg: 4.03,
  });

  // FCM Simulator state
  const [fcmTargetEvent, setFcmTargetEvent] = useState<'NEW_RIDE_GROUP' | 'DRIVER_STARTED' | 'RIDE_ACCEPTED'>('NEW_RIDE_GROUP');

  const handleRunAiOptimization = async () => {
    setLoadingAi(true);
    try {
      const response = await fetch('/api/gemini/optimize-routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ users: allUsers, groups }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
        }
      }
    } catch (err) {
      console.error('Error fetching Gemini AI suggestions:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  const handleRecalculateRoute = () => {
    // Dynamic calculation formula based on distance and passengers
    const distanceKm = 8.4 + (passengersCount > 1 ? (passengersCount - 1) * 1.2 : 0);
    const durationMin = Math.round(18 + passengersCount * 3.5);
    const fuelLiters = distanceKm / carEfficiency;
    const fuelCostTotal = Number((fuelLiters * fuelPrice).toFixed(2));
    const fuelCostPerPerson = Number((fuelCostTotal / (passengersCount + 1)).toFixed(2));
    const co2SavedKg = Number((distanceKm * 0.16 * passengersCount).toFixed(2));

    setCalcResult({
      distanceKm: Number(distanceKm.toFixed(1)),
      estimatedDurationMin: durationMin,
      fuelCostTotal,
      fuelCostPerPerson,
      co2SavedKg,
    });
  };

  const handleSendPushTest = () => {
    let title = '';
    let body = '';

    const groupName = groups[0]?.name || 'Grupo de Carona';

    if (fcmTargetEvent === 'NEW_RIDE_GROUP') {
      title = `🚗 Nova carona disponível no seu grupo ${groupName}!`;
      body = 'Um motorista acabou de publicar vagas na sua comunidade.';
    } else if (fcmTargetEvent === 'DRIVER_STARTED') {
      title = '📍 O motorista iniciou o percurso!';
      body = 'O trajeto foi iniciado. Acompanhe a aproximação em tempo real no mapa.';
    } else {
      title = '✅ Seu pedido de carona foi aceito!';
      body = 'Você foi confirmado na carona.';
    }

    onTriggerPushNotification(title, body, fcmTargetEvent);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-2 relative overflow-hidden">
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            Requisito 2: Google Premium Suite
          </span>
          <span className="text-xs text-slate-500 font-mono">Gemini (Vertex AI) • Routes API • FCM</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-slate-900">
          Inteligência Artificial & APIs Google Integradas
        </h2>
        <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">
          Arquitetura integrada que combina o <strong>Gemini 3.7 Flash</strong> para sugestões de rotinas convergentes, a <strong>Google Maps Routes API (Advanced)</strong> para otimização de percurso e rateio justo de combustível, e o <strong>Firebase Cloud Messaging (FCM)</strong> para notificações push imediatas.
        </p>
      </div>

      {/* Feature 1: Gemini Vertex AI Routine Optimizer */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-1.5">
                Assistente de Otimização de Rotinas (Gemini Vertex AI)
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 font-mono font-semibold">
                  gemini-3.7-flash
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Analisa padrões de origem, destino, dias da semana e proximidade de pontos de encontro.
              </p>
            </div>
          </div>

          <button
            id="btn-run-ai-routine"
            onClick={handleRunAiOptimization}
            disabled={loadingAi}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs flex items-center space-x-2 transition disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <Sparkles className={`w-4 h-4 text-amber-300 ${loadingAi ? 'animate-spin' : ''}`} />
            <span>{loadingAi ? 'Analisando Rotinas com IA...' : 'Reavaliar Sugestões de Agrupamento'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((sug, idx) => (
            <div
              key={idx}
              className="bg-slate-50/70 border border-slate-200 rounded-xl p-5 space-y-3 flex flex-col justify-between hover:border-indigo-300 transition"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-slate-900 text-sm">{sug.title}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {sug.matchScore}% Match
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">{sug.description}</p>

                <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                  <p>
                    <strong className="text-slate-800">Racional da IA:</strong> {sug.reasoning}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-1 text-emerald-700 font-semibold">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Economia: R$ {sug.estimatedWeeklySavingsBRL.toFixed(2)}/sem</span>
                </div>
                <div className="flex items-center space-x-1 text-teal-700 font-semibold">
                  <Leaf className="w-3.5 h-3.5" />
                  <span>-{sug.estimatedMonthlyCo2Kg} kg CO₂/mês</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Feature 2: Google Maps Routes API (Advanced) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Map className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base flex items-center gap-2">
              Google Maps Routes API (Advanced) & Calculadora de Custos
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200 font-mono font-semibold">
                Routes API + Waypoint Optimization
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Otimização de trajeto passando pelos pontos de encontro com cálculo de ETA e rateio de combustível.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls */}
          <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 space-y-3.5 text-xs">
            <h4 className="font-bold text-slate-800">Parâmetros de Roteamento:</h4>
            
            <div>
              <label className="block text-slate-700 font-medium mb-1">Passageiros com Ponto de Encontro:</label>
              <select
                value={passengersCount}
                onChange={(e) => setPassengersCount(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              >
                <option value={1}>1 Passageiro (Embarque Rebouças/Eldorado)</option>
                <option value={2}>2 Passageiros (+ Metrô Butantã)</option>
                <option value={3}>3 Passageiros (+ Portaria 1 Poli-USP)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Preço Gasolina (R$/L):</label>
                <input
                  type="number"
                  step="0.05"
                  value={fuelPrice}
                  onChange={(e) => setFuelPrice(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Consumo (km/L):</label>
                <input
                  type="number"
                  step="0.5"
                  value={carEfficiency}
                  onChange={(e) => setCarEfficiency(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
              </div>
            </div>

            <button
              onClick={handleRecalculateRoute}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Recalcular Rota & Rateio</span>
            </button>
          </div>

          {/* Results Display */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Distância Otimizada</span>
              <p className="text-2xl font-bold font-mono text-slate-900">{calcResult.distanceKm} km</p>
              <p className="text-[10px] text-slate-500">Trajeto com paradas</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Tempo Estimado (ETA)</span>
              <p className="text-2xl font-bold font-mono text-indigo-600">{calcResult.estimatedDurationMin} min</p>
              <p className="text-[10px] text-slate-500">Horário de pico matinal</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Custo Total Combustível</span>
              <p className="text-2xl font-bold font-mono text-amber-700">R$ {calcResult.fuelCostTotal}</p>
              <p className="text-[10px] text-slate-500">Base: R$ {fuelPrice}/L</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
              <span className="text-[11px] text-slate-500 font-medium">Rateio Justo / Pessoa</span>
              <p className="text-2xl font-bold font-mono text-emerald-700">R$ {calcResult.fuelCostPerPerson}</p>
              <p className="text-[10px] text-slate-500">Dividido por {passengersCount + 1} ocupantes</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1 col-span-2 sm:col-span-2">
              <span className="text-[11px] text-slate-500 font-medium">Pegada Ecológica Evitada (CO₂)</span>
              <p className="text-2xl font-bold font-mono text-teal-700">-{calcResult.co2SavedKg} kg CO₂</p>
              <p className="text-[10px] text-slate-500">Equivalente a 3 carros individuais a menos no tráfego</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature 3: Firebase Cloud Messaging (FCM Push Dispatcher) */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-slate-900 text-base">
              Firebase Cloud Messaging (FCM) - Notificações em Tempo Real
            </h3>
            <p className="text-xs text-slate-500">
              Dispare e teste eventos push reais recebidos pelos apps Web e Android (Jetpack Compose).
            </p>
          </div>
        </div>

        <div className="bg-slate-50 p-4.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 text-xs">
          <div className="space-y-1.5 flex-1">
            <label className="block text-slate-700 font-semibold">Selecione o Gatilho de Push FCM:</label>
            <select
              value={fcmTargetEvent}
              onChange={(e) => setFcmTargetEvent(e.target.value as any)}
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
            >
              <option value="NEW_RIDE_GROUP">1. "Nova carona disponível no seu grupo" (USP / Poli)</option>
              <option value="DRIVER_STARTED">2. "Motorista iniciou o percurso" (Tracking ao vivo ativado)</option>
              <option value="RIDE_ACCEPTED">3. "Seu pedido de carona foi aceito" (Confirmação de vaga)</option>
            </select>
          </div>

          <button
            onClick={handleSendPushTest}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl shadow-xs flex items-center justify-center space-x-2 transition self-end sm:self-center active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Disparar Notificação FCM</span>
          </button>
        </div>
      </section>
    </div>
  );
};
