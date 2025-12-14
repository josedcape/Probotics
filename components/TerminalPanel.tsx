import React, { useEffect, useRef } from 'react';
import { TerminalLog } from '../types';

interface TerminalPanelProps {
  logs: TerminalLog[];
  isVisible: boolean;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ logs, isVisible }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!isVisible && logs.length === 0) return null;

  return (
    <div className={`fixed bottom-24 right-4 md:right-8 w-[90vw] md:w-[400px] bg-black/90 border border-neon-cyan/30 rounded-lg overflow-hidden backdrop-blur-md shadow-[0_0_20px_rgba(0,243,255,0.15)] transition-all duration-500 z-30 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
      
      {/* Terminal Header */}
      <div className="bg-neon-cyan/10 border-b border-neon-cyan/20 px-3 py-1 flex justify-between items-center">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-neon-cyan rounded-full animate-pulse"></div>
            <span className="text-[10px] font-mono text-neon-cyan font-bold tracking-widest">KERNEL_EXECUTION_LOG</span>
        </div>
        <div className="text-[9px] text-gray-500 font-mono">PID: {Math.floor(Math.random() * 9999)}</div>
      </div>

      {/* Terminal Content */}
      <div className="p-3 h-48 overflow-y-auto font-mono text-xs space-y-1.5 scrollbar-hide bg-black/50">
         {logs.map((log) => (
             <div key={log.id} className="flex gap-2 animate-scan">
                 <span className="text-gray-600 shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span>
                 <span className={`${
                     log.type === 'error' ? 'text-red-500 font-bold' : 
                     log.type === 'success' ? 'text-green-400' : 
                     log.type === 'process' ? 'text-neon-purple animate-pulse' : 
                     log.type === 'warning' ? 'text-yellow-400' :
                     'text-neon-cyan'
                 }`}>
                     {log.type === 'process' && '> '}
                     {log.message}
                 </span>
             </div>
         ))}
         <div ref={endRef} />
         
         {/* Blinking Cursor */}
         <div className="flex items-center gap-2 mt-2">
            <span className="text-neon-cyan">{'>'}</span>
            <span className="w-2 h-4 bg-neon-cyan animate-pulse"></span>
         </div>
      </div>
      
      {/* Decorative Footer */}
      <div className="h-1 bg-gradient-to-r from-transparent via-neon-cyan/50 to-transparent w-full"></div>
    </div>
  );
};

export default TerminalPanel;