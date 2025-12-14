import React, { useEffect, useRef, useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Role, Attachment } from '../types';

declare global {
    interface Window {
        THREE: any;
    }
}

interface ChatInterfaceProps {
  messages: Message[];
  isOpen: boolean;
  onViewAttachment: (file: Attachment) => void;
  onClose?: () => void;
  onAudioPlaybackChange?: (isPlaying: boolean) => void;
}

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

// --- AUDIO PLAYER COMPONENT ---
const AudioPlayer: React.FC<{ 
  base64Data: string; 
  autoPlay: boolean; 
  onPlaybackChange?: (isPlaying: boolean) => void 
}> = ({ base64Data, autoPlay, onPlaybackChange }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = pcmToWav(base64Data);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [base64Data]);

  useEffect(() => {
      if (!audioRef.current) return;
      const audio = audioRef.current;
      const handlePlay = () => { setIsPlaying(true); onPlaybackChange?.(true); };
      const handlePause = () => { setIsPlaying(false); onPlaybackChange?.(false); };
      const handleEnded = () => { setIsPlaying(false); setProgress(0); onPlaybackChange?.(false); };
      const handleTimeUpdate = () => { if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100); };

      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('timeupdate', handleTimeUpdate);

      if (autoPlay && blobUrl) audio.play().catch(e => console.warn("Auto-play blocked", e));

      return () => {
          audio.removeEventListener('play', handlePlay);
          audio.removeEventListener('pause', handlePause);
          audio.removeEventListener('ended', handleEnded);
          audio.removeEventListener('timeupdate', handleTimeUpdate);
      };
  }, [blobUrl, autoPlay, onPlaybackChange]);

  const togglePlay = () => {
      if (audioRef.current) {
          if (isPlaying) audioRef.current.pause();
          else audioRef.current.play();
      }
  };

  if (!blobUrl) return null;

  return (
      <div className="mt-3 bg-black/40 border border-neon-cyan/20 rounded-lg p-2 flex items-center gap-3 w-full max-w-[250px]">
          <audio ref={audioRef} src={blobUrl} />
          <button onClick={togglePlay} className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all ${isPlaying ? 'bg-neon-cyan text-black border-neon-cyan' : 'bg-transparent text-neon-cyan border-neon-cyan/50 hover:bg-neon-cyan/10'}`}>
              {isPlaying ? <div className="w-2 h-2 bg-black"></div> : <div className="w-0 h-0 border-t-[4px] border-t-transparent border-l-[6px] border-l-neon-cyan border-b-[4px] border-b-transparent ml-0.5"></div>}
          </button>
          <div className="flex-1 h-8 flex items-center relative overflow-hidden group cursor-pointer" 
               onClick={(e) => {
                   if(audioRef.current && audioRef.current.duration) {
                       const rect = e.currentTarget.getBoundingClientRect();
                       const x = e.clientX - rect.left;
                       audioRef.current.currentTime = (x / rect.width) * audioRef.current.duration;
                   }
               }}>
              <div className="absolute inset-0 flex items-center justify-between gap-0.5 opacity-30">
                  {Array.from({ length: 20 }).map((_, i) => (
                      <div key={i} className="w-1 bg-neon-cyan rounded-full" style={{ height: `${30 + Math.random() * 70}%` }}></div>
                  ))}
              </div>
              <div className="absolute inset-0 bg-neon-cyan/20 transition-all duration-100 ease-linear" style={{ width: `${progress}%` }}></div>
          </div>
      </div>
  );
};

// --- MESSAGE BUBBLE ---
const MessageBubble: React.FC<{ 
  msg: Message; 
  onViewAttachment: (file: Attachment) => void;
  onAudioPlaybackChange?: (isPlaying: boolean) => void;
  isLatest: boolean;
}> = ({ msg, onViewAttachment, onAudioPlaybackChange, isLatest }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  return (
    <div className={`relative z-10 flex flex-col ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
      
      <div className={`max-w-[95%] md:max-w-[90%] tech-border-corner p-3 md:p-4 border backdrop-blur-md shadow-lg relative group/bubble ${
        msg.role === Role.USER 
          ? 'bg-neon-blue/10 border-neon-blue/40 text-blue-50 shadow-[0_0_15px_-5px_rgba(0,102,255,0.3)]' 
          : 'bg-space-light/90 border-neon-cyan/30 text-gray-100 shadow-[0_0_15px_-5px_rgba(0,243,255,0.2)]'
      }`}>
        
        <button
          onClick={handleCopy}
          className={`absolute top-2 right-2 p-1.5 rounded bg-black/40 border border-white/10 transition-all opacity-0 group-hover/bubble:opacity-100 ${isCopied ? 'text-green-400 border-green-400/50' : 'text-gray-400 hover:text-neon-cyan hover:border-neon-cyan/50'}`}
        >
          {isCopied ? "✓" : "📋"}
        </button>

        {/* Attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2 pr-8">
            {msg.attachments.map((att, idx) => (
              <button 
                key={idx} 
                onClick={() => onViewAttachment(att)}
                className="flex items-center gap-2 text-xs bg-black/60 px-3 py-1.5 rounded border border-neon-cyan/20 text-neon-cyan font-mono hover:bg-neon-cyan/20 hover:border-neon-cyan hover:shadow-[0_0_10px_rgba(0,243,255,0.2)] transition-all cursor-pointer group"
              >
                <span className="group-hover:text-white transition-colors">{att.mimeType.startsWith('image') ? 'IMG' : 'DAT'}</span>
                <span className="opacity-50">|</span>
                <span className="truncate max-w-[120px] group-hover:text-white transition-colors">{att.name || 'Unnamed Asset'}</span>
              </button>
            ))}
          </div>
        )}

        {/* Text Content */}
        <div className="probotics-markdown font-sans text-sm leading-relaxed tracking-wide pr-6">
           <ReactMarkdown remarkPlugins={[remarkGfm]}>
             {msg.content}
           </ReactMarkdown>
        </div>

        {/* --- TOOL UI RESULTS --- */}
        {msg.toolResult && (
            <div className="mt-4 pt-4 border-t border-neon-cyan/10">
                {/* CALENDAR / DRIVE LINK */}
                {msg.toolResult.type === 'calendar_link' && (
                    <a 
                        href={msg.toolResult.data.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-3 bg-neon-purple/10 border border-neon-purple/50 p-3 rounded hover:bg-neon-purple/20 transition-all group"
                    >
                        <div className="bg-neon-purple/20 p-2 rounded-full text-neon-purple group-hover:scale-110 transition-transform">
                            📅
                        </div>
                        <div>
                            <div className="text-xs font-mono text-neon-purple font-bold">INTENT LINK READY</div>
                            <div className="text-sm font-bold text-white group-hover:text-neon-cyan transition-colors">
                                {msg.toolResult.data.title}
                            </div>
                        </div>
                        <div className="ml-auto text-neon-purple opacity-50 group-hover:opacity-100">➜</div>
                    </a>
                )}

                {/* SSH TERMINAL */}
                {msg.toolResult.type === 'ssh_terminal' && (
                    <div className="bg-black border border-gray-700 rounded font-mono text-xs overflow-hidden">
                        <div className="bg-gray-800 px-3 py-1 text-gray-400 flex gap-2">
                             <div className="w-2 h-2 rounded-full bg-red-500"></div>
                             <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                             <div className="w-2 h-2 rounded-full bg-green-500"></div>
                             <span className="ml-2">ssh probotics@aura-server</span>
                        </div>
                        <div className="p-3">
                            <div className="text-green-400">$ {msg.toolResult.data.command}</div>
                            <div className="text-gray-300 whitespace-pre-wrap mt-1">{msg.toolResult.data.output}</div>
                        </div>
                    </div>
                )}

                {/* 3D MODEL - BUTTON ONLY */}
                {msg.toolResult.type === '3d_model' && (
                    <button 
                        onClick={() => {
                            // Find the generated html attachment for this message
                            const att = msg.attachments?.find(a => a.name === '3d_model.html');
                            if (att) onViewAttachment(att);
                        }}
                        className="w-full flex items-center justify-center gap-3 bg-neon-cyan/5 border border-neon-cyan/30 hover:bg-neon-cyan/20 p-4 rounded-lg transition-all group"
                    >
                        <div className="relative">
                            <div className="w-8 h-8 border-2 border-neon-cyan rounded flex items-center justify-center animate-spin-slow group-hover:animate-spin">
                                <div className="w-4 h-4 bg-neon-cyan/50"></div>
                            </div>
                        </div>
                        <span className="text-neon-cyan font-display tracking-widest text-xs">ABRIR MODELO EN CANVAS</span>
                    </button>
                )}

                {/* WEBHOOK RESULT */}
                {msg.toolResult.type === 'webhook_call' && (
                    <div className="bg-space-dark border border-neon-cyan/30 rounded p-3">
                         <div className="flex items-center gap-2 mb-2 pb-2 border-b border-white/5">
                             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                             <span className="text-xs font-mono text-green-400">DATA TRANSMITTED TO WEBHOOK</span>
                         </div>
                         <div className="text-[10px] text-gray-500 font-mono mb-2 truncate">{msg.toolResult.data.url}</div>
                         
                         <div className="grid grid-cols-2 gap-2 text-xs">
                             <div className="bg-black/30 p-2 rounded border border-white/5">
                                 <span className="block text-gray-500 text-[9px] mb-1">PAYLOAD (SENT)</span>
                                 <pre className="text-neon-cyan overflow-hidden whitespace-pre-wrap font-mono text-[10px]">
                                     {JSON.stringify(msg.toolResult.data.payload, null, 2)}
                                 </pre>
                             </div>
                             <div className="bg-black/30 p-2 rounded border border-white/5">
                                 <span className="block text-gray-500 text-[9px] mb-1">RESPONSE (RECEIVED)</span>
                                 <pre className="text-green-300 overflow-hidden whitespace-pre-wrap font-mono text-[10px]">
                                     {typeof msg.toolResult.data.response === 'string' ? msg.toolResult.data.response : JSON.stringify(msg.toolResult.data.response, null, 2)}
                                 </pre>
                             </div>
                         </div>
                    </div>
                )}
            </div>
        )}

        {/* Audio Player */}
        {msg.audioData && (
            <AudioPlayer 
                base64Data={msg.audioData} 
                autoPlay={isLatest} 
                onPlaybackChange={onAudioPlaybackChange} 
            />
        )}

        {/* Grounding */}
        {msg.groundingUrls && msg.groundingUrls.length > 0 && (
          <div className="mt-4 pt-3 border-t border-neon-cyan/10 text-xs">
            <p className="text-neon-cyan/50 mb-2 font-mono uppercase text-[10px]">Verified Nodes</p>
            <ul className="grid grid-cols-1 gap-1">
              {msg.groundingUrls.map((source, idx) => (
                <li key={idx}>
                  <a href={source.uri} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-400 hover:text-neon-cyan truncate p-1 hover:bg-neon-cyan/5 rounded">
                    <span className="font-mono text-[10px]">[{idx + 1}]</span>
                    <span className="truncate">{source.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 mt-1 px-1">
         <span className={`w-1.5 h-1.5 rounded-full ${msg.role === Role.USER ? 'bg-neon-blue' : 'bg-neon-purple'}`}></span>
         <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
            {msg.role === Role.USER ? 'COMMAND' : 'RESPONSE'}
         </span>
      </div>
    </div>
  );
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, isOpen, onViewAttachment, onClose, onAudioPlaybackChange }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  return (
    <div className={`cyber-glass-strong w-[90vw] md:w-[450px] h-full flex flex-col border-r border-neon-cyan/20 absolute left-0 top-0 z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0 shadow-[0_0_50px_rgba(0,0,0,0.5)]' : '-translate-x-full'}`}>
      
      <div className="p-4 md:p-5 border-b border-neon-cyan/10 flex justify-between items-center bg-gradient-to-r from-space-light to-transparent relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan/50 shadow-[0_0_10px_#00f3ff]"></div>
        <div>
          {/* BOTIDINAMIX HEADER WITH GOLDEN SHIMMER */}
          <h2 
            className="font-display font-bold tracking-widest text-lg bg-gradient-to-r from-yellow-600 via-yellow-100 to-yellow-600 bg-[length:200%_auto] bg-clip-text text-transparent animate-laser-sweep drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]"
            style={{ animationDuration: '5s' }}
          >
            BOTIDINAMIX
          </h2>
          <div className="text-[10px] text-neon-blue font-mono tracking-wide mt-1">AGENTES AVANZADOS MULTITAREA MULTIMODALES</div>
        </div>
        
        <div className="flex items-center gap-3">
            <div className="hidden md:block text-xs text-gray-500 font-mono border border-neon-cyan/20 px-2 py-1 rounded bg-black/40">
                REC: {messages.length.toString().padStart(3, '0')}
            </div>
            <button onClick={onClose} className="md:hidden p-2 text-gray-400 hover:text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 relative pb-28 md:pb-4">
        <div className="absolute inset-0 pointer-events-none holo-grid opacity-30 fixed"></div>

        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-3/4 opacity-50">
            <div className="w-16 h-16 border border-neon-cyan/30 rounded-full flex items-center justify-center animate-pulse-fast mb-4">
               <div className="w-12 h-12 bg-neon-cyan/10 rounded-full"></div>
            </div>
            <div className="text-center text-neon-cyan/60 font-mono text-xs space-y-1">
              <p className="uppercase tracking-[0.2em] border-b border-neon-cyan/20 pb-1 mb-2 inline-block">System Idle</p>
              <p>WAITING FOR NEURAL INPUT...</p>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <MessageBubble 
            key={msg.id} 
            msg={msg} 
            onViewAttachment={onViewAttachment} 
            onAudioPlaybackChange={onAudioPlaybackChange}
            isLatest={index === messages.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

export default ChatInterface;