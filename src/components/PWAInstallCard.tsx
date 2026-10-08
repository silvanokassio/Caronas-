import React, { useState } from 'react';
import { 
  Smartphone, 
  Monitor, 
  Download, 
  CheckCircle2, 
  Share, 
  PlusSquare, 
  X, 
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  Info
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstalled?: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({
  isOpen,
  onClose,
  onInstalled,
}) => {
  const { isInstallable, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [installing, setInstalling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  const TARGET_APP_URL = 'https://caronasflow.apponline.ia.br/';

  const getCleanAppUrl = () => {
    return TARGET_APP_URL;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(TARGET_APP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenExternal = () => {
    window.open(TARGET_APP_URL, '_blank');
  };

  const handleDirectInstall = async () => {
    setInstalling(true);
    setFeedback(null);
    try {
      const res = await install();
      if (res.success) {
        setFeedback('Aplicativo instalado com sucesso no seu dispositivo!');
        onInstalled?.();
        setTimeout(() => onClose(), 1800);
      } else if (res.outcome === 'dismissed') {
        setFeedback('Instalação cancelada. Você pode seguir os passos abaixo a qualquer momento.');
      }
    } catch {
      setFeedback('Abertura manual necessária. Siga as instruções abaixo:');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between relative bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-0.5 flex items-center justify-center shrink-0">
              <img src="/icon.svg" alt="CaronaFlow" className="w-full h-full rounded-[14px]" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Criar Atalho do CaronaFlow</h3>
              <p className="text-[11px] text-slate-400">Instalação na tela inicial do seu celular ou PC</p>
            </div>
          </div>
          <button
            type="button"
            id="btn-close-pwa-modal"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {feedback && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-emerald-300" />
              <span>{feedback}</span>
            </div>
          )}

          {/* Iframe Warning with 1-click open external */}
          {isInIframe && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
              <div className="flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-200 text-xs">Atenção para Celulares</h4>
                  <p className="text-[11px] text-amber-300/80 leading-relaxed mt-0.5">
                    Você está na tela de visualização/teste. Por segurança, o Android e o iOS bloqueiam a criação de atalhos dentro de molduras. Para instalar, abra diretamente no <strong>Google Chrome</strong> ou <strong>Safari</strong>:
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  id="btn-pwa-open-external-browser"
                  onClick={handleOpenExternal}
                  className="flex-1 py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir no Navegador do Celular</span>
                </button>

                <button
                  type="button"
                  id="btn-pwa-copy-app-link"
                  onClick={handleCopyLink}
                  className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl flex items-center justify-center space-x-1.5 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Link Copiado!' : 'Copiar Link'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Direct 1-Click Install if prompt is ready & not in iframe */}
          {isInstallable && !isInIframe && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl space-y-2.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-emerald-200">Pronto para Instalar com 1 Toque!</span>
              </div>
              <p className="text-[11px] text-slate-300">
                Seu dispositivo suporta instalação imediata do atalho oficial:
              </p>
              <button
                type="button"
                id="btn-pwa-modal-direct-install"
                onClick={handleDirectInstall}
                disabled={installing}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-slate-950" />
                <span>Confirmar e Adicionar à Tela Inicial</span>
              </button>
            </div>
          )}

          {/* Step-by-step instructions based on OS */}
          {isIOS ? (
            /* Apple iOS (Safari) Steps */
            <div className="space-y-3">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                <span>Passo a Passo no iPhone ou iPad (Safari)</span>
              </h4>

              <div className="space-y-2.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="text-slate-200">
                    Na barra inferior do Safari, toque no botão <strong>Compartilhar</strong> (ícone quadrado com a seta para cima <Share className="w-3.5 h-3.5 inline mx-1 text-indigo-400" />).
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="text-slate-200">
                    Role as opções para baixo e toque em <strong>"Adicionar à Tela de Início"</strong> (<PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-400" />).
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="text-slate-200">
                    No canto superior direito, toque em <strong>"Adicionar"</strong>. O ícone do CaronaFlow aparecerá junto com seus outros aplicativos.
                  </div>
                </div>
              </div>
            </div>
          ) : isAndroid ? (
            /* Android (Chrome) Steps */
            <div className="space-y-3">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Passo a Passo no Celular Android (Google Chrome)</span>
              </h4>

              <div className="space-y-2.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="text-slate-200">
                    No canto superior direito do Google Chrome, toque nos <strong>3 pontinhos verticais (⋮)</strong> para abrir o menu do navegador.
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="text-slate-200">
                    Toque na opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-slate-950 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="text-slate-200">
                    Toque em <strong>"Instalar"</strong> para confirmar. O atalho será criado instantaneamente na sua tela de aplicativos.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Desktop (Chrome / Edge) Steps */
            <div className="space-y-3">
              <h4 className="font-bold text-slate-200 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-indigo-400" />
                <span>No Computador (Windows / Mac / Linux)</span>
              </h4>

              <div className="space-y-2.5 bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="text-slate-200">
                    Olhe para o canto direito da <strong>barra de endereços URL</strong> do Chrome ou Edge e clique no ícone de <strong>instalar (+)</strong> ou de monitor.
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="text-slate-200">
                    Ou clique nos 3 pontinhos do navegador &gt; <em>"Salvar e compartilhar"</em> &gt; <strong>"Instalar CaronaFlow como aplicativo"</strong>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Direct App Link for sharing / copying */}
          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-xl flex items-center justify-between gap-2">
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block">Link de Acesso Direto:</span>
              <span className="font-mono text-[11px] text-emerald-300 truncate block">
                {TARGET_APP_URL}
              </span>
            </div>
            <button
              type="button"
              id="btn-pwa-copy-app-link-secondary"
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            type="button"
            id="btn-pwa-modal-footer-close"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

interface PWAInstallCardProps {
  variant?: 'card' | 'compact' | 'button';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallCard: React.FC<PWAInstallCardProps> = ({
  variant = 'card',
  className = '',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isInIframe, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleInstallClick = async () => {
    setFeedback(null);

    // If we have direct browser prompt support and not blocked by iframe, trigger prompt
    if (isInstallable && !isInIframe) {
      setInstalling(true);
      try {
        const result = await install();
        if (result.success) {
          setFeedback('Aplicativo instalado com sucesso!');
          onInstalled?.();
          return;
        } else if (result.outcome === 'dismissed') {
          setShowModal(true);
          return;
        }
      } catch (err) {
        console.warn('Install prompt failed, opening visual guide:', err);
      } finally {
        setInstalling(false);
      }
    }

    // Always show modal for clear visual guidance
    setShowModal(true);
  };

  // 1. If already installed as Standalone App
  if (isInstalled) {
    if (variant === 'button' || variant === 'compact') {
      return (
        <div className={`flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 ${className}`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>App Instalado</span>
        </div>
      );
    }

    return (
      <div className={`bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 border border-emerald-500/40 rounded-3xl p-5 text-white shadow-md relative overflow-hidden ${className}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">CaronaFlow Instalado</h3>
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full">
                  Ativo no Dispositivo
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Você já está usando o CaronaFlow como aplicativo nativo. Seus atalhos estão configurados.
              </p>
            </div>
          </div>
          <img src="/icon.svg" alt="CaronaFlow" className="w-10 h-10 rounded-xl shadow-xs hidden sm:block shrink-0" />
        </div>
      </div>
    );
  }

  // 2. Compact / Button Variant
  if (variant === 'button' || variant === 'compact') {
    return (
      <>
        <button
          type="button"
          id="btn-pwa-install-compact"
          onClick={handleInstallClick}
          disabled={installing}
          className={`px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-black rounded-xl shadow-xs transition active:scale-95 flex items-center space-x-1.5 cursor-pointer ${className}`}
          title="Criar atalho na tela inicial do celular ou computador"
        >
          <Download className="w-3.5 h-3.5 text-slate-950" />
          <span>Instalar App</span>
        </button>

        <PWAInstallModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onInstalled={onInstalled}
        />
      </>
    );
  }

  // 3. Full Featured Card Variant (for UserAreaView)
  return (
    <div className={`bg-gradient-to-br from-slate-900 via-indigo-950/90 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden ${className}`}>
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-0.5 shadow-lg shrink-0 flex items-center justify-center">
            <img src="/icon.svg" alt="CaronaFlow Icon" className="w-full h-full rounded-[14px]" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-base text-white tracking-tight">
                Atalho na Tela Inicial do Celular & PC
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                PWA Oficial
              </span>
            </div>
            <p className="text-xs text-indigo-200/80 max-w-xl leading-relaxed">
              Abra o CaronaFlow em 1 toque na sua tela inicial, com inicialização instantânea, notificações prioritárias e tela cheia sem barra de navegador.
            </p>

            <div className="flex items-center gap-3 pt-1 text-[11px] text-slate-300">
              <span className="flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Android & iPhone</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                <span>Windows, Mac & Linux</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row md:flex-col items-stretch sm:items-center md:items-end gap-2 shrink-0">
          <button
            type="button"
            id="btn-pwa-install-main"
            onClick={handleInstallClick}
            disabled={installing}
            className="px-5 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-2xl shadow-lg shadow-emerald-950/40 transition active:scale-95 flex items-center justify-center space-x-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>Instalar / Adicionar Atalho</span>
          </button>

          <span className="text-[10px] text-slate-400 text-center md:text-right">
            Sem download pesado na loja de apps
          </span>
        </div>
      </div>

      {feedback && (
        <div className="mt-4 p-3 bg-white/10 rounded-xl text-xs text-emerald-200 border border-emerald-400/30 flex items-center space-x-2">
          <Info className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      <PWAInstallModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onInstalled={onInstalled}
      />
    </div>
  );
};
