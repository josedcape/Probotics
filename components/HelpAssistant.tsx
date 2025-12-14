import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Role, Attachment, AgentConfig } from '../types';
import { generateResponse, synthesizeSpeech } from '../services/geminiService';
import { HELP_SYSTEM_INSTRUCTION } from '../constants';

// --- UTILS: PCM TO WAV CONVERTER ---
const pcmToWav = (base64PCM: string, sampleRate: number = 24000): string => {
  const binaryString = atob(base64PCM);
  const len = binaryString.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i++) {
    view[i] = binaryString.charCodeAt(i);
  }

  const wavHeader = new ArrayBuffer(44);
  const headerView = new DataView(wavHeader);
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(headerView, 0, 'RIFF');
  headerView.setUint32(4, 36 + len, true);
  writeString(headerView, 8, 'WAVE');
  writeString(headerView, 12, 'fmt ');
  headerView.setUint32(16, 16, true);
  headerView.setUint16(20, 1, true);
  headerView.setUint16(22, 1, true);
  headerView.setUint32(24, sampleRate, true);
  headerView.setUint32(28, sampleRate * 2, true);
  headerView.setUint16(32, 2, true);
  headerView.setUint16(34, 16, true);
  writeString(headerView, 36, 'data');
  headerView.setUint32(40, len, true);

  const blob = new Blob([headerView, view], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
};

const HelpAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpenedBefore, setHasOpenedBefore] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Configuración "fake" para el servicio de Gemini, específica para este agente de ayuda
  const helpConfig: AgentConfig = {
      systemInstruction: HELP_SYSTEM_INSTRUCTION,
      modelName: 'gemini-2.5-flash',
      useSearch: false,
      useMemory: false,
      activeModules: {
          browser: false, memory: false, scraper: false, calendar: false, 
          drive: false, ssh: false, model3d: false, canvas: false,
          webhook: false, imageGen: false
      },
      webhookConfig: {
          url: '',
          description: ''
      },
      useDeepAnalysis: false,
      enableTTS: false, // No usamos el TTS automático del servicio, lo manejamos manual aquí
      voiceName: 'Puck',
      temperature: 0.5,
      avatarScale: 1
  };

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  // Audio de Bienvenida
  useEffect(() => {
      if (isOpen && !hasOpenedBefore) {
          setHasOpenedBefore(true);
          const playWelcome = async () => {
              // Añadir mensaje de bienvenida visual
              setMessages([{
                  id: 'welcome',
                  role: Role.MODEL,
                  content: "Bienvenido, veo que necesitas mi ayuda con la aplicación. ¿En qué puedo orientarte hoy?",
                  timestamp: Date.now()
              }]);

              // Sintetizar Voz
              try {
                const audioBase64 = await synthesizeSpeech("Bienvenido, veo que necesitas mi ayuda con la aplicación.", "Puck");
                if (audioBase64) {
                    // Convert PCM to WAV URL
                    const wavUrl = pcmToWav(audioBase64);
                    const audio = new Audio(wavUrl);
                    audio.play();
                }
              } catch (e) {
                  console.error("Audio error", e);
              }
          };
          playWelcome();
      }
  }, [isOpen, hasOpenedBefore]);

  const handleSend = async (text: string = input) => {
      if ((!text.trim() && attachments.length === 0) || isProcessing) return;

      const userMsg: Message = {
          id: Date.now().toString(),
          role: Role.USER,
          content: text,
          timestamp: Date.now(),
          attachments: [...attachments]
      };

      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setAttachments([]);
      setIsProcessing(true);

      try {
          // Usamos el mismo servicio pero con la config de ayuda
          const response = await generateResponse(
              text,
              messages.concat(userMsg), // Pasamos historial + nuevo mensaje
              userMsg.attachments || [],
              helpConfig,
              () => {} // No logueamos a la terminal principal
          );

          const botMsg: Message = {
              id: (Date.now() + 1).toString(),
              role: Role.MODEL,
              content: response.text,
              timestamp: Date.now()
          };
          setMessages(prev => [...prev, botMsg]);

      } catch (error) {
          console.error(error);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (evt) => {
          const base64 = evt.target?.result as string;
          setAttachments(prev => [...prev, {
            name: file.name,
            mimeType: file.type,
            data: base64,
            isText: file.type.includes('text') || file.type.includes('json')
          }]);
        };
        reader.readAsDataURL(file);
      }
  };

  const quickActions = [
      "¿Cómo creo un agente nuevo?",
      "¿Qué herramientas tienes?",
      "Error con la cámara",
      "¿Cómo usar la memoria?"
  ];

  return (
    <>
        {/* Floating Toggle Button */}
        <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`fixed bottom-24 right-4 md:right-8 z-[70] group flex items-center justify-center transition-all duration-300 ${isOpen ? 'w-12 h-12 bg-amber-500 text-black rotate-90' : 'w-14 h-14 bg-black/80 border border-amber-500/50 text-amber-500 hover:scale-110 hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]' } rounded-full backdrop-blur-md shadow-lg`}
            title="Soporte PROBOTICS"
        >
            {isOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            ) : (
                <div className="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-ping"></span>
                </div>
            )}
        </button>

        {/* Chat Panel Overlay */}
        <div className={`fixed bottom-40 right-4 md:right-8 w-[90vw] md:w-[380px] h-[500px] bg-black/95 cyber-glass-strong border border-amber-500/30 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.15)] z-[70] transition-all duration-300 origin-bottom-right flex flex-col ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
            
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-900/40 to-black p-4 border-b border-amber-500/20 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5c0-5.523 4.477-10 10-10Z"></path><path d="m8.5 8.5 7 7"></path><path d="m8.5 15.5 7-7"></path></svg>
                </div>
                <div>
                    <h3 className="text-amber-500 font-display font-bold tracking-widest text-sm">SOPORTE PROBOTICS</h3>
                    <p className="text-[10px] text-gray-400 font-mono">GUIA_SISTEMA_V1.0</p>
                </div>
            </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/40">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-50 text-center p-4">
                        <div className="w-12 h-12 border border-dashed border-amber-500/50 rounded-full animate-spin-slow mb-2"></div>
                        <p className="text-xs text-amber-500/70 font-mono">INICIANDO PROTOCOLOS DE SOPORTE...</p>
                    </div>
                )}
                
                {messages.map(msg => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
                        <div className={`max-w-[85%] p-3 rounded-xl text-xs ${
                            msg.role === Role.USER 
                            ? 'bg-amber-500/10 border border-amber-500/30 text-amber-100 rounded-br-none' 
                            : 'bg-white/10 border border-white/10 text-gray-200 rounded-bl-none'
                        }`}>
                            {/* Attachments Preview in History */}
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mb-2 flex gap-1">
                                    {msg.attachments.map((att, i) => (
                                        <div key={i} className="text-[9px] bg-black/50 px-2 py-1 rounded border border-white/10 flex items-center gap-1">
                                            <span>📎</span> {att.name}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                    </div>
                ))}
                {isProcessing && (
                    <div className="flex items-start">
                         <div className="bg-white/5 border border-white/10 p-3 rounded-xl rounded-bl-none">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-100"></div>
                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce delay-200"></div>
                            </div>
                         </div>
                    </div>
                )}
            </div>

            {/* Quick Actions (Only if no messages or last was model) */}
            {(!messages.length || messages[messages.length - 1].role === Role.MODEL) && (
                <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-t border-white/5">
                    {quickActions.map((qa, i) => (
                        <button 
                            key={i}
                            onClick={() => handleSend(qa)}
                            className="whitespace-nowrap px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] hover:bg-amber-500 hover:text-black transition-all"
                        >
                            {qa}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-black/80 border-t border-amber-500/20">
                {/* Active Attachments */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 mb-2 overflow-x-auto">
                        {attachments.map((att, i) => (
                             <div key={i} className="relative group">
                                <div className="text-[10px] bg-amber-900/50 text-amber-200 px-2 py-1 rounded border border-amber-500/30 truncate max-w-[100px]">
                                    {att.name}
                                </div>
                                <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                             </div>
                        ))}
                    </div>
                )}
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-gray-500 hover:text-amber-500 transition-colors"
                        title="Subir Captura/Registro"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                    
                    <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Describe tu problema..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                    
                    <button 
                        onClick={() => handleSend()}
                        disabled={!input.trim() && attachments.length === 0}
                        className="p-2 bg-amber-500/20 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all disabled:opacity-50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </div>
            </div>
        </div>
    </>
  );
};

export default HelpAssistant;