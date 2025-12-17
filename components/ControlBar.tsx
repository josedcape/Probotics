import React, { useState, useRef, useEffect } from 'react';
import { Attachment, AgentConfig } from '../types';
import { enhanceUserPrompt } from '../services/geminiService';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ControlBarProps {
  onSendMessage: (text: string, attachments: Attachment[]) => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onOpenSettings: () => void;
  onToggleTerminal: () => void;
  onPreviewFile: (file: Attachment) => void;
  isCameraActive: boolean;
  isScreenShareActive: boolean;
  isChatOpen: boolean;
  isTerminalOpen: boolean;
  isLoading: boolean;
  
  // New props for Agents Menu
  config?: AgentConfig;
  onConfigChange?: (config: AgentConfig) => void;
}

const ControlBar: React.FC<ControlBarProps> = (props) => {
  const {
    onSendMessage,
    onToggleCamera,
    onToggleScreenShare,
    onToggleChat,
    onOpenSettings,
    onToggleTerminal,
    onPreviewFile,
    isCameraActive,
    isScreenShareActive,
    isChatOpen,
    isTerminalOpen,
    isLoading,
    config,
    onConfigChange
  } = props;

  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isAgentsMenuOpen, setIsAgentsMenuOpen] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // State for expanded info in modules menu
  const [expandedInfo, setExpandedInfo] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  
  // CORE VOICE REFS
  const silenceTimerRef = useRef<any>(null);
  const isSendingRef = useRef(false); 
  const shouldKeepListening = useRef(false); // CRITICAL: Controls the infinite loop
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const agentsMenuRef = useRef<HTMLDivElement>(null);
  const agentsButtonRef = useRef<HTMLButtonElement>(null);

  // Keep track of latest props/state to avoid stale closures in callbacks
  const propsRef = useRef(props);
  const inputTextRef = useRef(inputText); 
  
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

  // Click outside listener for Agents Menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
          agentsMenuRef.current && 
          !agentsMenuRef.current.contains(event.target as Node) &&
          agentsButtonRef.current &&
          !agentsButtonRef.current.contains(event.target as Node)
      ) {
        setIsAgentsMenuOpen(false);
        setExpandedInfo(null);
      }
    };
    if (isAgentsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isAgentsMenuOpen]);

  // --- START RECOGNITION INSTANCE ---
  const startRecognition = () => {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      // Cleanup previous instance if exists to prevent leaks
      if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch(e) {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true; 
      recognition.interimResults = true;
      recognition.lang = 'es-ES';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        // FIX: FREEZE PREVENTION & CONTINUOUS LOOP
        // We use a timeout to break the synchronous loop. This prevents the browser from hanging.
        if (shouldKeepListening.current) {
            console.log("Voice loop: Restarting...");
            setTimeout(() => {
                // Check flag again in case user cancelled during timeout
                if (shouldKeepListening.current) {
                    try {
                        recognition.start();
                    } catch (e) {
                        // Ignore specific error if already started, otherwise log
                        console.warn("Voice restart info:", e);
                    }
                }
            }, 150); // 150ms delay is critical for performance/stability
        } else {
            setIsListening(false);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        }
      };

      recognition.onerror = (event: any) => {
        // console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            shouldKeepListening.current = false;
            setIsListening(false);
        }
        // For 'no-speech' or 'network', the onend loop will handle the restart
      };

      recognition.onresult = (event: any) => {
        // FIX: INPUT CLEARING ISSUE
        // If we are currently sending or just sent a message, IGNORE any incoming speech
        // This prevents the "ghost text" from reappearing after clearing the input.
        if (isSendingRef.current || propsRef.current.isLoading) {
             if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
             return; 
        }

        // 1. Clear any pending auto-send timer immediately
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        let finalChunk = '';
        let hasFinal = false;
        
        // Loop specifically through the NEW results
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalChunk += event.results[i][0].transcript;
            hasFinal = true;
          }
        }

        const trimmedChunk = finalChunk.trim();

        if (hasFinal && trimmedChunk) {
            // 2. Process Commands (Voice)
            const executed = processDynamicCommands(trimmedChunk, 'voice');

            if (!executed) {
                // 3. Append text to input state
                setInputText(prev => {
                    if (isSendingRef.current) return ''; 
                    
                    if (prev.endsWith(trimmedChunk)) return prev;
                    const separator = prev.length > 0 ? ' ' : '';
                    return prev + separator + trimmedChunk;
                });
            }
        }

        // 4. Set NEW Silence Timer (The "Auto-Send" Logic)
        silenceTimerRef.current = setTimeout(() => {
            triggerAutoSend();
        }, 2000); 
      };

      recognitionRef.current = recognition;
      try {
          recognition.start();
      } catch (e) {
          console.error("Start error", e);
      }
  };

  // --- DYNAMIC COMMAND PROCESSOR ---
  const processDynamicCommands = (input: string, source: 'text' | 'voice'): boolean => {
      const command = input.toLowerCase().trim().replace(/[.,!]/g, '');
      const currentProps = propsRef.current;

      // COMANDO 1: "iniciar" -> Activa reconocimiento de voz CONTINUO (Solo Texto)
      // This command forces the loop to stay open.
      if (source === 'text' && (command === 'iniciar' || command === 'activar voz' || command === 'modo continuo')) {
          console.log("Comando 'iniciar' recibido. Activando Modo Continuo.");
          shouldKeepListening.current = true; // FORCE CONTINUOUS
          if (!isListening) {
              startRecognition();
          }
          return true;
      }

      // COMANDO 2: "cámara"
      if (['cámara', 'camara', 'activar cámara', 'prender cámara'].includes(command)) {
          if (!currentProps.isCameraActive) currentProps.onToggleCamera();
          return true; 
      }

      // Comandos Adicionales
      if (['apagar cámara', 'detener cámara'].includes(command)) {
          if (currentProps.isCameraActive) currentProps.onToggleCamera();
          return true;
      }

      if (['pantalla', 'compartir pantalla'].includes(command)) {
          if (!currentProps.isScreenShareActive) currentProps.onToggleScreenShare();
          return true;
      }
      
      if (['terminal', 'abrir terminal'].includes(command)) {
          if (!currentProps.isTerminalOpen) currentProps.onToggleTerminal();
          return true;
      }

      // Explicit Send Command (Voice override)
      if (command === 'enviar' || command === 'enviar mensaje') {
          triggerAutoSend();
          return true;
      }

      return false;
  };

  // --- TRIGGER AUTO SEND LOGIC (ROBUST) ---
  const triggerAutoSend = () => {
      // 1. Safety Lock: Prevent double firing OR firing while loading
      // isLoading check prevents piling up requests that crash memory
      if (isSendingRef.current || propsRef.current.isLoading) {
          return;
      }
      
      const textToSend = inputTextRef.current.trim();
      
      // 2. Prevent sending empty messages
      if (!textToSend && attachments.length === 0) return;

      isSendingRef.current = true;
      
      // 3. Execute Send
      propsRef.current.onSendMessage(textToSend, attachments);
      
      // 4. Atomic Cleanup (Strictly clear inputs)
      setInputText('');
      setAttachments([]);
      
      // 5. Unlock after a safe delay to prevent "echo" from lingering speech buffers
      setTimeout(() => {
          isSendingRef.current = false;
      }, 800); 
  };

  // --- MAIN TOGGLE HANDLER ---
  const toggleVoiceInput = () => {
    if (isListening) {
      // User explicitly stops (Manual Toggle OFF)
      shouldKeepListening.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    } else {
      // User explicitly starts (Manual Toggle ON)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Voice recognition module not found in this browser environment.");
        return;
      }
      
      shouldKeepListening.current = true;
      startRecognition();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if ((!inputText.trim() && attachments.length === 0) || isLoading) return;
    
    // Lock voice input briefly to prevent race conditions during manual send
    isSendingRef.current = true;

    // Check text commands first
    const executed = processDynamicCommands(inputText, 'text');
    if (executed) {
        setInputText('');
        setTimeout(() => isSendingRef.current = false, 500);
        return;
    }

    onSendMessage(inputText, attachments);
    setInputText('');
    setAttachments([]);
    
    setTimeout(() => {
        isSendingRef.current = false;
    }, 500);
  };

  const handleEnhance = async () => {
      if (!inputText.trim()) return;
      setIsEnhancing(true);
      try {
          const enhanced = await enhanceUserPrompt(inputText);
          if (enhanced) {
              setInputText(enhanced);
          }
      } catch (error) {
          console.error("Enhance failed", error);
      } finally {
          setIsEnhancing(false);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        const base64 = evt.target?.result as string;
        const newAtt: Attachment = {
          name: file.name,
          mimeType: file.type,
          data: base64,
          isText: file.type.includes('text') || file.type.includes('json') || file.type.includes('javascript')
        };
        setAttachments(prev => [...prev, newAtt]);
      };
      if (file.type.includes('text') || file.type.includes('json') || file.type.includes('javascript')) {
          reader.readAsText(file);
      } else {
          reader.readAsDataURL(file);
      }
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleModule = (moduleKey: string) => {
      if (config && onConfigChange) {
          onConfigChange({
              ...config,
              activeModules: {
                  ...config.activeModules,
                  [moduleKey]: !config.activeModules[moduleKey as keyof typeof config.activeModules]
              }
          });
      }
  };

  const hasText = inputText.trim().length > 0;

  const modulesList = [
      { key: 'imageGen', label: 'Imagen IA', icon: '🖼️', description: 'Genera imágenes artísticas usando Imagen-3/Gemini.' },
      { key: 'ssh', label: 'Terminal SSH AURA', icon: '💻', description: 'Simula una terminal remota para ejecutar comandos.' },
      { key: 'model3d', label: 'Motor Geometría 3D', icon: '🧊', description: 'Genera código Three.js para visualizar objetos 3D.' },
      { key: 'canvas', label: 'Renderizador Canvas', icon: '🎨', description: 'Crea visualizaciones gráficas HTML/SVG.' },
      { key: 'calendar', label: 'Google Calendar', icon: '📅', description: 'Crea enlaces para agendar eventos.' },
      { key: 'drive', label: 'Google Drive', icon: '📁', description: 'Genera nuevos documentos y hojas de cálculo.' },
      { key: 'scraper', label: 'Web Scraper', icon: '🕸️', description: 'Extrae datos de sitios web para análisis.' },
      { key: 'browser', label: 'Navegador Web', icon: '🌐', description: 'Lee contenido de URLs en tiempo real.' },
      { key: 'memory', label: 'Memoria Persistente', icon: '🧠', description: 'Recuerda datos del usuario entre sesiones.' },
      { key: 'webhook', label: 'Conector Webhook', icon: '🔗', description: 'Envía datos a n8n/Make para flujos de automatización.' },
  ];

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[95%] md:w-full md:max-w-4xl z-50 flex flex-col items-center gap-4 pointer-events-none">
      
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="pointer-events-auto flex gap-2 overflow-x-auto max-w-full p-2 bg-black/60 rounded-lg border border-neon-cyan/20 backdrop-blur-sm">
          {attachments.map((att, idx) => (
            <div key={idx} className="relative group shrink-0">
               <button 
                  onClick={() => removeAttachment(idx)}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
               >
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </button>
               <button onClick={() => onPreviewFile(att)} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded border border-white/10 text-xs font-mono text-neon-cyan hover:bg-neon-cyan/20 transition-all">
                  <span className="truncate max-w-[100px]">{att.name}</span>
               </button>
            </div>
          ))}
        </div>
      )}

      {/* Agents Menu (Popup) */}
      {isAgentsMenuOpen && config && (
          <div 
             ref={agentsMenuRef} 
             className="pointer-events-auto absolute bottom-[calc(100%+16px)] left-0 md:left-auto md:right-0 bg-black/95 cyber-glass-strong border border-neon-cyan/30 rounded-xl p-4 w-[280px] backdrop-blur-2xl shadow-[0_0_50px_rgba(0,0,0,0.9)] z-[100] overflow-hidden"
          >
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <h4 className="text-neon-cyan font-display tracking-widest text-xs">MÓDULOS NEURONALES</h4>
                  <div className="w-2 h-2 bg-neon-cyan rounded-full animate-pulse"></div>
              </div>
              <div className="space-y-1 max-h-[300px] overflow-y-auto scrollbar-hide">
                  {modulesList.map((mod) => (
                      <div key={mod.key} className="flex flex-col gap-1">
                          <div className={`flex items-center justify-between p-2 rounded transition-all border ${config.activeModules[mod.key as keyof typeof config.activeModules] ? 'bg-neon-cyan/10 border-neon-cyan/30' : 'bg-transparent border-transparent hover:bg-white/5'}`}>
                              <div 
                                  className="flex items-center gap-3 flex-1 cursor-pointer"
                                  onClick={() => toggleModule(mod.key)}
                              >
                                  <span className="text-sm">{mod.icon}</span>
                                  <span className={`text-xs font-mono ${config.activeModules[mod.key as keyof typeof config.activeModules] ? 'text-white' : 'text-gray-500'}`}>{mod.label}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                  <button 
                                     onClick={(e) => {
                                         e.stopPropagation();
                                         setExpandedInfo(expandedInfo === mod.key ? null : mod.key);
                                     }}
                                     className={`p-1 rounded-full hover:bg-white/10 transition-colors ${expandedInfo === mod.key ? 'text-neon-cyan bg-neon-cyan/20' : 'text-gray-600'}`}
                                     title="Info"
                                  >
                                     <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                                  </button>
                                  <div 
                                      onClick={() => toggleModule(mod.key)}
                                      className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${config.activeModules[mod.key as keyof typeof config.activeModules] ? 'bg-neon-cyan/50' : 'bg-gray-700'}`}
                                  >
                                      <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.activeModules[mod.key as keyof typeof config.activeModules] ? 'left-4' : 'left-0.5'}`}></div>
                                  </div>
                              </div>
                          </div>
                          {expandedInfo === mod.key && (
                              <div className="mx-2 mb-2 p-2 bg-black/40 border-l-2 border-neon-cyan/30 text-[10px] text-gray-400 font-mono animate-scan">
                                  {mod.description}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
              <div className="mt-3 pt-2 border-t border-white/10 text-[9px] text-gray-500 font-mono text-center">
                  MÓDULOS ACTIVOS: {Object.values(config.activeModules).filter(Boolean).length} / {Object.keys(config.activeModules).length}
              </div>
          </div>
      )}

      {/* Main Control Deck */}
      <div className="pointer-events-auto w-full flex items-end gap-2 md:gap-3 p-2 md:p-3 rounded-2xl md:rounded-full bg-black/80 cyber-glass border border-neon-cyan/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
         
         {/* Tools Block (Left) */}
         <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <button 
              onClick={onToggleChat} 
              className={`p-3 rounded-full transition-all ${isChatOpen ? 'text-neon-cyan bg-neon-cyan/10' : 'text-gray-400 hover:text-white'}`}
              title="Toggle Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </button>
            
            <div className="w-px h-6 bg-white/10 mx-1 hidden md:block"></div>

            <button 
              onClick={onToggleCamera}
              className={`p-3 rounded-full transition-all ${isCameraActive ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-white'}`}
              title="Toggle Camera"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            </button>
            
            <button 
              onClick={onToggleScreenShare}
              className={`p-3 rounded-full transition-all ${isScreenShareActive ? 'text-neon-cyan bg-neon-cyan/10 animate-pulse' : 'text-gray-400 hover:text-white'}`}
              title="Share Screen"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            </button>

             <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-full text-gray-400 hover:text-white transition-all"
              title="Upload File"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" multiple />
         </div>

         {/* Input Block (Center) */}
         <div className="flex-1 relative laser-input-wrapper group/input">
             <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Escuchando... (Haz silencio para enviar)" : "Escribe o usa comandos ('cámara')..."}
                className="input-universe w-full h-12 py-3 pl-4 pr-10 resize-none overflow-hidden"
                style={{ lineHeight: '1.5' }}
             />
             <button 
                onClick={handleEnhance}
                disabled={!hasText || isEnhancing}
                className={`absolute top-1/2 -translate-y-1/2 right-2 p-1.5 rounded-full transition-all z-10 ${hasText ? 'text-neon-purple hover:bg-neon-purple/20 hover:scale-110 hover:shadow-[0_0_10px_rgba(188,19,254,0.4)]' : 'text-gray-600 cursor-not-allowed opacity-50'}`}
                title="Enhance Prompt (AI)"
             >
                 {isEnhancing ? (
                     <div className="w-4 h-4 border-2 border-neon-purple border-t-transparent rounded-full animate-spin"></div>
                 ) : (
                     <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z"></path></svg>
                 )}
             </button>
         </div>

         {/* Actions Block (Right) */}
         <div className="flex items-center gap-1 md:gap-2 shrink-0">
            <button 
                ref={agentsButtonRef}
                onClick={() => setIsAgentsMenuOpen(!isAgentsMenuOpen)}
                className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-full transition-all border ${isAgentsMenuOpen ? 'border-neon-cyan bg-neon-cyan/20 text-neon-cyan' : 'border-transparent text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Agents & Modules"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M3 12h18"></path><path d="M12 3v18"></path><rect x="3" y="3" width="18" height="18" rx="4"></rect></svg>
                <span className="text-xs font-mono font-bold">AGENTES</span>
            </button>

             <button 
              onClick={toggleVoiceInput}
              className={`p-3 rounded-full transition-all border ${isListening ? 'border-red-500 bg-red-500/20 text-red-500 animate-pulse' : 'border-transparent text-gray-400 hover:text-white'}`}
              title="Voice Input"
            >
               {isListening ? (
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
               )}
            </button>

            <button 
              onClick={onToggleTerminal}
              className={`hidden md:block p-3 rounded-full transition-all ${isTerminalOpen ? 'text-neon-purple bg-neon-purple/10' : 'text-gray-400 hover:text-white'}`}
              title="System Terminal"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
            </button>

             <button 
              onClick={onOpenSettings}
              className="hidden md:block p-3 rounded-full text-gray-400 hover:text-white transition-all"
              title="Settings"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
            
            <button 
              onClick={handleSend}
              disabled={isLoading || (!inputText.trim() && attachments.length === 0)}
              className="p-3 md:px-6 md:py-3 rounded-full bg-neon-cyan/20 border border-neon-cyan/50 text-neon-cyan font-bold hover:bg-neon-cyan hover:text-black hover:shadow-[0_0_20px_#00f3ff] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
               {isLoading ? (
                   <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
               ) : (
                   <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
               )}
            </button>
         </div>
      </div>
    </div>
  );
};

export default ControlBar;