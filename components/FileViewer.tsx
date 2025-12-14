import React from 'react';
import { Attachment } from '../types';

interface FileViewerProps {
  file: Attachment | null;
  onClose: () => void;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, onClose }) => {
  if (!file) return null;

  const isPDF = file.mimeType === 'application/pdf';
  const isHTML = file.mimeType === 'text/html';
  // Check for image but exclude svg+xml if it's being handled as text/code, 
  // though usually image/ tag handles data-uri SVGs. 
  // If data is raw SVG code, it might fail in <img src>, so HTML viewer is safer for raw code.
  const isImage = file.mimeType.startsWith('image/') && file.mimeType !== 'image/svg+xml';
  const isSVG = file.mimeType === 'image/svg+xml';
  const isText = file.isText && !isHTML && !isSVG; 

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col">
       {/* Header */}
       <div className="h-16 border-b border-neon-cyan/20 flex items-center justify-between px-4 md:px-6 bg-space-light/80 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
             <div className="w-2 h-6 bg-neon-cyan shrink-0"></div>
             <div className="overflow-hidden">
                <h3 className="text-neon-cyan font-display tracking-widest text-base md:text-lg">NEURAL VISUALIZER</h3>
                <p className="text-[10px] text-gray-400 font-mono truncate">{file.name} // {file.mimeType.toUpperCase()}</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-red-500/20 rounded-full group transition-all border border-transparent hover:border-red-500/50 shrink-0">
             <svg className="w-6 h-6 text-gray-400 group-hover:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
       </div>

       {/* Content */}
       <div className="flex-1 p-4 md:p-8 overflow-hidden flex items-center justify-center relative">
          
          {/* Background Grid */}
          <div className="absolute inset-0 holo-grid opacity-10 pointer-events-none"></div>

          {isPDF && (
             <object 
                data={file.data} 
                type="application/pdf" 
                className="w-full h-full max-w-6xl border border-neon-cyan/30 rounded shadow-[0_0_50px_rgba(0,243,255,0.1)] bg-white/5"
             >
                <div className="flex flex-col items-center justify-center text-gray-400 h-full p-4 text-center">
                    <p className="font-mono mb-2">PDF RENDERER OFFLINE OR BLOCKED</p>
                    <a href={file.data} download={file.name} className="px-6 py-2 bg-neon-cyan/20 border border-neon-cyan text-neon-cyan rounded hover:bg-neon-cyan hover:text-black transition-all font-mono text-xs">
                        DOWNLOAD DATA PACKET
                    </a>
                </div>
             </object>
          )}

          {/* HTML / Canvas / SVG Code Renderer */}
          {(isHTML || isSVG) && (
              <div className="w-full h-full max-w-6xl bg-white rounded-lg shadow-[0_0_50px_rgba(0,243,255,0.1)] overflow-hidden">
                <iframe 
                    srcDoc={file.data}
                    title={file.name}
                    className="w-full h-full border-none"
                    sandbox="allow-scripts" // Allow scripts for canvas drawing
                />
              </div>
          )}

          {isImage && (
             <img 
                src={file.data} 
                alt={file.name} 
                className="max-w-full max-h-full object-contain border border-neon-cyan/20 rounded-lg shadow-[0_0_100px_rgba(0,243,255,0.1)]"
             />
          )}

          {isText && (
              <div className="w-full max-w-4xl h-full overflow-auto cyber-glass-strong p-4 md:p-6 rounded-xl border border-white/10 relative">
                 <div className="absolute top-0 right-0 p-2 text-[10px] text-gray-500 font-mono">TEXT_MODE</div>
                 <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap">
                    {file.data}
                 </pre>
              </div>
          )}
          
          {!isPDF && !isImage && !isText && !isHTML && !isSVG && (
             <div className="text-center text-neon-pink font-display border border-neon-pink/50 p-6 md:p-10 rounded bg-neon-pink/5 mx-4">
                UNSUPPORTED FORMAT FOR VISUALIZATION
             </div>
          )}
       </div>
    </div>
  );
};

export default FileViewer;