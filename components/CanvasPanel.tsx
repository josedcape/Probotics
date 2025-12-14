import React, { useEffect, useRef, useState } from 'react';
import { Attachment } from '../types';

interface CanvasPanelProps {
  isOpen: boolean;
  content: Attachment | null;
  onClose: () => void;
}

const CanvasPanel: React.FC<CanvasPanelProps> = ({ isOpen, content, onClose }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoom, setZoom] = useState(100);

  // Auto-inject content into iframe when it changes
  useEffect(() => {
    if (content && (content.mimeType === 'text/html' || content.mimeType === 'image/svg+xml') && iframeRef.current) {
       const doc = iframeRef.current.contentDocument;
       if (doc) {
           doc.open();
           
           // WRAPPER FIX: If the content is raw SVG or partial HTML, wrap it in a proper document structure
           // This ensures styles work and avoids "white screen" issues with direct SVGs in iframes
           let finalHtml = content.data;
           const cleanContent = finalHtml.trim().toLowerCase();
           
           if (!cleanContent.startsWith('<!doctype html') && !cleanContent.startsWith('<html')) {
               finalHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { 
                            margin: 0; 
                            padding: 20px; 
                            display: flex; 
                            justify-content: center; 
                            align-items: center; 
                            min-height: 100vh; 
                            background: transparent; 
                            color: #fff;
                            font-family: sans-serif;
                            overflow: auto;
                        }
                        /* Center and fit SVG/Images */
                        svg, img { 
                            max-width: 100%; 
                            max-height: 90vh; 
                            width: auto; 
                            height: auto; 
                            object-fit: contain;
                        }
                        #canvas-container { width: 100%; height: 100%; }
                    </style>
                </head>
                <body>${finalHtml}</body>
                </html>
               `;
           }
           
           doc.write(finalHtml);
           doc.close();
       }
    }
  }, [content]);

  const isPDF = content?.mimeType === 'application/pdf';
  const isImage = content?.mimeType.startsWith('image/') && content?.mimeType !== 'image/svg+xml';
  const isCode = content?.mimeType === 'text/html' || content?.mimeType === 'image/svg+xml';

  return (
    <div className={`fixed top-0 right-0 h-full w-[90vw] md:w-[50vw] bg-space-dark/95 border-l border-neon-cyan/30 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] z-[60] transform transition-transform duration-500 ease-in-out backdrop-blur-xl flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Header */}
      <div className="h-14 border-b border-neon-cyan/20 flex items-center justify-between px-4 bg-black/40 shrink-0">
         <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded bg-neon-cyan/10 border border-neon-cyan/30 flex items-center justify-center text-neon-cyan">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
             </div>
             <div>
                <h3 className="text-neon-cyan font-display tracking-widest text-sm">CANVAS VISUALIZER</h3>
                <p className="text-[10px] text-gray-400 font-mono truncate max-w-[200px]">{content?.name || 'IDLE_MODE'}</p>
             </div>
         </div>
         
         <div className="flex items-center gap-2">
             <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="p-2 text-gray-500 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
             <span className="text-xs font-mono text-gray-400 w-8 text-center">{zoom}%</span>
             <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="p-2 text-gray-500 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg></button>
             <div className="w-px h-6 bg-white/10 mx-2"></div>
             <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
             </button>
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]">
         <div className="absolute inset-0 holo-grid opacity-10 pointer-events-none"></div>
         
         {!content ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 opacity-50">
                 <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                 <p className="font-mono text-xs tracking-widest">AWAITING VISUAL DATA STREAM</p>
             </div>
         ) : (
             <div 
                className="w-full h-full flex items-center justify-center overflow-hidden transition-transform duration-200"
                style={{ transform: `scale(${zoom / 100})` }}
             >
                 {isCode && (
                     <iframe 
                        ref={iframeRef}
                        className="w-full h-full border-none bg-white/5 shadow-2xl"
                        title="Canvas Render"
                        sandbox="allow-scripts"
                     />
                 )}

                 {isImage && (
                     <img 
                        src={content.data} 
                        alt="Canvas Content" 
                        className="max-w-full max-h-full object-contain shadow-[0_0_30px_rgba(0,243,255,0.15)] rounded border border-white/10"
                     />
                 )}

                 {isPDF && (
                     <object 
                        data={content.data} 
                        type="application/pdf" 
                        className="w-full h-full rounded shadow-2xl bg-white"
                     >
                         <p className="text-white text-center">PDF cannot be displayed natively.</p>
                     </object>
                 )}
                 
                 {!isCode && !isImage && !isPDF && (
                     <div className="text-neon-pink font-mono text-xs border border-neon-pink p-4 rounded bg-neon-pink/10">
                         FORMATO NO SOPORTADO PARA PREVISUALIZACIÓN EN CANVAS
                     </div>
                 )}
             </div>
         )}
      </div>

      {/* Footer / Console Log */}
      <div className="h-8 bg-black border-t border-neon-cyan/20 flex items-center px-4 text-[10px] font-mono text-neon-cyan/60">
          <span className="mr-4">CANVAS_CORE: ONLINE</span>
          <span>RENDER_ENGINE: {(isCode ? 'HTML5_WEBKIT' : isImage ? 'IMAGE_PROCESSOR' : 'GENERIC')}</span>
      </div>

    </div>
  );
};

export default CanvasPanel;