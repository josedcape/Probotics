import React, { useRef, useState } from 'react';
import { AgentConfig, SavedAgent, ChatSession } from '../types';
import { enhanceUserPrompt } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentConfig;
  onConfigChange: (newConfig: AgentConfig) => void;
  onClearMemory: () => void;
  onUploadAvatar: (file: File | null) => void;
  
  // Agent Management Props
  savedAgents: SavedAgent[];
  onSaveAgent: (name: string) => void;
  onLoadAgent: (agent: SavedAgent) => void;
  onDeleteAgent: (id: string) => void;

  // Session Management Props
  sessions: ChatSession[];
  currentSessionId: string | null;
  onLoadSession: (session: ChatSession) => void;
  onDeleteSession: (id: string) => void;
  onCreateSession: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  config, 
  onConfigChange, 
  onClearMemory,
  onUploadAvatar,
  savedAgents,
  onSaveAgent,
  onLoadAgent,
  onDeleteAgent,
  sessions,
  currentSessionId,
  onLoadSession,
  onDeleteSession,
  onCreateSession
}) => {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [newAgentName, setNewAgentName] = useState('');
  const [activeTab, setActiveTab] = useState<'config' | 'agents' | 'history'>('config');
  const [isEnhancingSystem, setIsEnhancingSystem] = useState(false);

  if (!isOpen) return null;

  const voices = [
      { id: 'Puck', label: 'Puck (Soft/Male)' },
      { id: 'Charon', label: 'Charon (Deep/Male)' },
      { id: 'Kore', label: 'Kore (Calm/Female)' },
      { id: 'Fenrir', label: 'Fenrir (Intense/Male)' },
      { id: 'Zephyr', label: 'Zephyr (Gentle/Female)' }
  ];

  const handleEnhanceSystemPrompt = async () => {
    if (!config.systemInstruction.trim()) return;
    setIsEnhancingSystem(true);
    try {
        const enhanced = await enhanceUserPrompt(config.systemInstruction);
        if (enhanced) {
            onConfigChange({ ...config, systemInstruction: enhanced });
        }
    } catch (error) {
        console.error("Enhance failed", error);
    } finally {
        setIsEnhancingSystem(false);
    }
  };

  const Toggle = ({ label, description, checked, onChange, color = 'neon-cyan', children }: any) => (
    <div className={`p-3 border border-white/10 rounded-lg bg-white/5 transition-all group hover:border-${color}/50 hover:bg-${color}/5`}>
        <label className="flex items-center gap-4 cursor-pointer mb-2">
            <div className="relative shrink-0">
                <input 
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange(e.target.checked)}
                className="peer sr-only"
                />
                <div className={`w-10 h-6 bg-gray-700 rounded-full peer-checked:bg-${color}/20 peer-checked:border peer-checked:border-${color} transition-all`}></div>
                <div className={`absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full peer-checked:bg-${color} peer-checked:translate-x-4 transition-all`}></div>
            </div>
            <div>
            <div className={`text-sm font-bold text-gray-200 group-hover:text-${color} transition-colors`}>{label}</div>
            <div className="text-xs text-gray-500 leading-tight mt-0.5">{description}</div>
            </div>
        </label>
        {children && checked && (
            <div className="mt-2 pl-14 animate-scan opacity-100">
                {children}
            </div>
        )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-0 md:p-4">
      
      {/* Glow Effect behind modal */}
      <div className="absolute w-[500px] h-[500px] bg-neon-cyan/10 rounded-full blur-[100px] pointer-events-none animate-pulse hidden md:block"></div>

      <div className="cyber-glass-strong w-full h-full md:h-[90vh] md:w-[90%] md:max-w-2xl rounded-none md:rounded-2xl relative shadow-[0_0_50px_rgba(0,243,255,0.15)] overflow-hidden flex flex-col">
        
        {/* Holographic Border Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-neon-cyan/20 to-transparent pointer-events-none opacity-50"></div>
        
        {/* Header with Tabs */}
        <div className="bg-space-dark/95 flex-shrink-0 border-b border-white/5 p-6 pb-0 relative z-20">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-xl font-display text-white tracking-widest">SYSTEM CONTROL</h3>
                    <p className="text-[10px] text-neon-cyan font-mono mt-1">KERNEL LEVEL ACCESS</p>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            
            <div className="flex gap-4 md:gap-6 text-sm font-mono tracking-wide overflow-x-auto scrollbar-hide">
                <button 
                  onClick={() => setActiveTab('config')}
                  className={`pb-3 px-1 border-b-2 transition-all whitespace-nowrap ${activeTab === 'config' ? 'border-neon-cyan text-neon-cyan' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  CORE_CONFIG
                </button>
                <button 
                  onClick={() => setActiveTab('agents')}
                  className={`pb-3 px-1 border-b-2 transition-all whitespace-nowrap ${activeTab === 'agents' ? 'border-neon-purple text-neon-purple' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  IDENTITY_LIBRARY
                </button>
                <button 
                  onClick={() => setActiveTab('history')}
                  className={`pb-3 px-1 border-b-2 transition-all whitespace-nowrap ${activeTab === 'history' ? 'border-neon-pink text-neon-pink' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  HISTORICAL_LOGS
                </button>
            </div>
        </div>

        <div className="bg-space-dark/95 md:bg-space-dark/90 p-6 relative z-10 flex-1 overflow-y-auto">
            
            {activeTab === 'config' && (
                <div className="space-y-6 pb-6">
                    {/* System Instructions */}
                    <div className="group">
                        <label className="block text-xs font-mono text-neon-purple mb-2 uppercase flex items-center gap-2">
                        <span className="w-1 h-3 bg-neon-purple"></span>
                        Core Directive (System Prompt)
                        </label>
                        <div className="relative">
                            <textarea
                                value={config.systemInstruction}
                                onChange={(e) => onConfigChange({ ...config, systemInstruction: e.target.value })}
                                className="w-full h-40 bg-black/40 border border-white/10 rounded-lg p-3 text-sm text-gray-300 focus:border-neon-purple/80 focus:ring-1 focus:ring-neon-purple/50 outline-none font-mono transition-all resize-none"
                                placeholder="Define the agent's persona, context, and rules..."
                            />
                            
                            {/* ENHANCE SYSTEM PROMPT BUTTON */}
                            <button 
                                onClick={handleEnhanceSystemPrompt}
                                disabled={!config.systemInstruction.trim() || isEnhancingSystem}
                                className={`absolute bottom-3 right-3 p-1.5 rounded-full transition-all z-10 bg-black/50 border border-white/10 ${
                                    config.systemInstruction.trim()
                                        ? 'text-neon-purple hover:bg-neon-purple/20 hover:scale-110 hover:border-neon-purple/50' 
                                        : 'text-gray-600 cursor-not-allowed opacity-50'
                                }`}
                                title="Enhance System Prompt (AI)"
                            >
                                {isEnhancingSystem ? (
                                    <div className="w-4 h-4 border-2 border-neon-purple border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"></path></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Webhook Configuration - Only visible if module active in ControlBar, but here we can force settings or let user config */}
                    <div className="group border border-neon-cyan/30 rounded-lg p-3 bg-neon-cyan/5">
                         <label className="block text-xs font-mono text-neon-cyan mb-2 uppercase flex items-center gap-2">
                           <span className="w-1 h-3 bg-neon-cyan"></span>
                           Conector Webhook (n8n / Make)
                        </label>
                        <div className="space-y-3">
                             <div>
                                 <label className="text-[10px] text-gray-400 font-mono block mb-1">ENDPOINT URL</label>
                                 <input 
                                     type="text"
                                     value={config.webhookConfig.url}
                                     onChange={(e) => onConfigChange({ 
                                         ...config, 
                                         webhookConfig: { ...config.webhookConfig, url: e.target.value }
                                     })}
                                     placeholder="https://hook.us1.make.com/..."
                                     className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-neon-cyan font-mono focus:border-neon-cyan outline-none"
                                 />
                             </div>
                             <div>
                                 <label className="text-[10px] text-gray-400 font-mono block mb-1">DESCRIPCIÓN DE LA HERRAMIENTA</label>
                                 <textarea 
                                     value={config.webhookConfig.description}
                                     onChange={(e) => onConfigChange({ 
                                         ...config, 
                                         webhookConfig: { ...config.webhookConfig, description: e.target.value }
                                     })}
                                     placeholder="Ej: 'Envía el nombre del cliente y su pedido para guardarlo en Airtable.' (Instruye al agente sobre qué datos enviar)"
                                     className="w-full h-16 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-gray-300 resize-none outline-none focus:border-neon-cyan"
                                 />
                             </div>
                             <div className="flex items-center gap-2 text-[10px] font-mono">
                                 <span className={`w-2 h-2 rounded-full ${config.webhookConfig.url ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-red-500'}`}></span>
                                 <span className={config.webhookConfig.url ? 'text-green-400' : 'text-gray-500'}>
                                     {config.webhookConfig.url ? 'CONEXIÓN CONFIGURADA' : 'SIN CONFIGURACIÓN'}
                                 </span>
                             </div>
                        </div>
                    </div>

                    {/* Custom Avatar Upload */}
                    <div className="group">
                        <label className="block text-xs font-mono text-neon-blue mb-2 uppercase flex items-center gap-2">
                        <span className="w-1 h-3 bg-neon-blue"></span>
                        Visual Interface
                        </label>
                        
                        <div className="mb-3 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono">
                            <span>DIMENSIONS</span>
                            <span>{(config.avatarScale * 100).toFixed(0)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="2.0" 
                            step="0.1" 
                            value={config.avatarScale}
                            onChange={(e) => onConfigChange({ ...config, avatarScale: parseFloat(e.target.value) })}
                            className="w-full accent-neon-blue h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                        />
                        </div>

                        <div className="flex gap-2 flex-col md:flex-row">
                        <button 
                            onClick={() => avatarInputRef.current?.click()}
                            className="flex-1 p-3 border border-white/10 rounded-lg bg-white/5 hover:bg-neon-blue/10 hover:border-neon-blue/50 transition-all text-xs font-mono text-gray-300 flex items-center justify-center gap-2"
                        >
                            UPLOAD AVATAR VIDEO
                        </button>
                        <button 
                            onClick={() => {
                                onUploadAvatar(null);
                                if(avatarInputRef.current) avatarInputRef.current.value = '';
                            }}
                            className="p-3 border border-white/10 rounded-lg bg-white/5 hover:bg-red-500/10 hover:border-red-500/50 transition-all text-xs font-mono text-gray-400"
                        >
                            RESET
                        </button>
                        <input 
                            type="file" 
                            ref={avatarInputRef}
                            className="hidden" 
                            accept="video/mp4,video/webm"
                            onChange={(e) => {
                            if (e.target.files?.[0]) {
                                onUploadAvatar(e.target.files[0]);
                            }
                            }}
                        />
                        </div>
                    </div>

                    {/* Tools Grid */}
                    <div className="space-y-3">
                        <label className="block text-xs font-mono text-neon-cyan mb-2 uppercase flex items-center gap-2">
                        <span className="w-1 h-3 bg-neon-cyan"></span>
                        Neural Modules
                        </label>
                        
                        <div className="grid grid-cols-1 gap-3">
                            <Toggle 
                                label="Live Web Access"
                                description="Google Search & Jina Web Reader"
                                checked={config.useSearch}
                                onChange={(val: boolean) => onConfigChange({ ...config, useSearch: val })}
                            />
                            <Toggle 
                                label="Persistent Memory"
                                description="Store & retrieve conversation context"
                                checked={config.useMemory}
                                onChange={(val: boolean) => onConfigChange({ ...config, useMemory: val })}
                                color="neon-purple"
                            />
                            <Toggle 
                                label="Vocal Synthesis (TTS)"
                                description="Gemini Flash 2.5 Voice Output"
                                checked={config.enableTTS}
                                onChange={(val: boolean) => onConfigChange({ ...config, enableTTS: val })}
                                color="neon-blue"
                            >
                                <div className="flex flex-col gap-2 mt-1">
                                    <span className="text-[10px] font-mono text-gray-400 uppercase">Voice Selection</span>
                                    <select 
                                        value={config.voiceName || 'Kore'}
                                        onChange={(e) => onConfigChange({ ...config, voiceName: e.target.value })}
                                        className="bg-black/40 border border-white/10 rounded text-xs text-white p-2 outline-none focus:border-neon-blue font-mono"
                                    >
                                        {voices.map(v => (
                                            <option key={v.id} value={v.id} className="bg-gray-900">{v.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </Toggle>
                            <Toggle 
                                label="Deep Analysis"
                                description="High reasoning, low creativity (Logic Mode)"
                                checked={config.useDeepAnalysis}
                                onChange={(val: boolean) => onConfigChange({ ...config, useDeepAnalysis: val })}
                                color="neon-pink"
                            />
                        </div>
                    </div>

                    {/* Danger Zone */}
                    <div className="pt-6 mt-4 border-t border-white/5">
                         <label className="block text-xs font-mono text-red-500 mb-2 uppercase flex items-center gap-2">
                           <span className="w-1 h-3 bg-red-500"></span>
                           Danger Zone
                        </label>
                        <button 
                            onClick={onClearMemory}
                            className="w-full text-xs text-red-400 hover:text-red-300 font-mono flex items-center justify-center gap-2 px-3 py-3 border border-red-500/20 hover:border-red-500/50 rounded bg-red-900/10 transition-all"
                        >
                            PURGE ACTIVE SESSION MEMORY
                        </button>
                    </div>
                </div>
            )}

            {activeTab === 'agents' && (
                <div className="space-y-8">
                     {/* Create New */}
                     <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <h4 className="text-sm font-bold text-neon-purple mb-3 font-display">SAVE CURRENT IDENTITY</h4>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newAgentName}
                                onChange={(e) => setNewAgentName(e.target.value)}
                                placeholder="Agent Designation (e.g. 'Coding Assistant')"
                                className="flex-1 bg-black/50 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-neon-purple outline-none"
                            />
                            <button 
                                onClick={() => {
                                    if(newAgentName.trim()) {
                                        onSaveAgent(newAgentName);
                                        setNewAgentName('');
                                    }
                                }}
                                disabled={!newAgentName.trim()}
                                className="bg-neon-purple/20 border border-neon-purple text-neon-purple px-4 rounded text-xs font-bold hover:bg-neon-purple hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                SAVE
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 font-mono">
                            Saves the current System Directive, Model Config, and Voice Settings as a reusable template.
                        </p>
                     </div>

                     {/* List */}
                     <div>
                        <h4 className="text-sm font-bold text-gray-400 mb-3 font-display uppercase tracking-wider">Available Identities</h4>
                        
                        {savedAgents.length === 0 ? (
                            <div className="text-center py-8 text-gray-600 font-mono text-xs border border-dashed border-white/10 rounded-xl">
                                NO IDENTITIES FOUND IN LOCAL STORAGE
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {savedAgents.map(agent => (
                                    <div key={agent.id} className="group relative flex items-center justify-between p-4 bg-black/40 border border-white/10 hover:border-neon-cyan/50 rounded-lg transition-all">
                                        <div>
                                            <div className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors">{agent.name}</div>
                                            <div className="text-[10px] text-gray-500 font-mono mt-1">
                                                CREATED: {new Date(agent.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    onLoadAgent(agent);
                                                    onClose();
                                                }}
                                                className="px-3 py-1.5 bg-neon-cyan/10 border border-neon-cyan/30 text-neon-cyan rounded text-xs hover:bg-neon-cyan hover:text-black transition-all font-mono"
                                            >
                                                LOAD
                                            </button>
                                            <button 
                                                onClick={() => onDeleteAgent(agent.id)}
                                                className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded transition-all"
                                                title="Delete Identity"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                     </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-4">
                    <button 
                        onClick={() => {
                            onCreateSession();
                            onClose();
                        }}
                        className="w-full py-3 bg-neon-pink/10 border border-neon-pink/30 text-neon-pink rounded-lg font-bold hover:bg-neon-pink hover:text-black transition-all font-display tracking-wide"
                    >
                        + START NEW SESSION
                    </button>

                    <div className="space-y-2 mt-4">
                        <h4 className="text-xs font-mono text-gray-500 uppercase">Past Logs</h4>
                        {sessions.length === 0 ? (
                             <div className="text-center py-8 text-gray-600 font-mono text-xs border border-dashed border-white/10 rounded-xl">
                                NO HISTORY FOUND
                            </div>
                        ) : (
                            sessions.sort((a,b) => b.lastModified - a.lastModified).map(session => (
                                <div key={session.id} className={`p-3 rounded-lg border flex justify-between items-center transition-all ${session.id === currentSessionId ? 'bg-neon-pink/5 border-neon-pink/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                                    <div className="flex-1 min-w-0 mr-4 cursor-pointer" onClick={() => { onLoadSession(session); onClose(); }}>
                                        <div className={`text-sm font-bold truncate ${session.id === currentSessionId ? 'text-neon-pink' : 'text-gray-300'}`}>
                                            {session.title || 'Untitled Session'}
                                        </div>
                                        <div className="text-[10px] text-gray-500 font-mono mt-1 flex gap-2">
                                            <span>{new Date(session.lastModified).toLocaleDateString()} {new Date(session.lastModified).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            <span>•</span>
                                            <span>{session.messages.length} msgs</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteSession(session.id); }}
                                        className="p-2 text-gray-600 hover:text-red-500 transition-colors"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
        
        {/* Footer Actions */}
        <div className="bg-space-dark border-t border-white/5 p-4 flex justify-end">
            <button 
            onClick={onClose}
            className="w-full md:w-auto bg-white text-black px-8 py-3 md:py-2.5 rounded font-bold hover:bg-neon-cyan hover:shadow-[0_0_15px_rgba(0,243,255,0.5)] transition-all text-sm tracking-wide text-center"
            >
            EXIT CONFIG
            </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsModal;