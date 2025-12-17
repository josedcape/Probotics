import React, { useState, useEffect, useCallback, useRef } from 'react';
import AvatarView from './components/AvatarView';
import ChatInterface from './components/ChatInterface';
import ControlBar from './components/ControlBar';
import SettingsModal from './components/SettingsModal';
import FileViewer from './components/FileViewer';
import TerminalPanel from './components/TerminalPanel';
import HelpAssistant from './components/HelpAssistant';
import CanvasPanel from './components/CanvasPanel'; // NEW
import { Message, Role, Attachment, AgentConfig, SavedAgent, TerminalLog, ChatSession } from './types';
import { DEFAULT_CONFIG } from './constants';
import { generateResponse, synthesizeSpeech } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScreenShareActive, setIsScreenShareActive] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  
  const [isChatOpen, setIsChatOpen] = useState(false); // Default closed on mobile
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false); // Default hidden
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  
  // Terminal State
  const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);
  
  // Canvas State (NEW)
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [canvasContent, setCanvasContent] = useState<Attachment | null>(null);

  // Agent & Session Management State
  const [savedAgents, setSavedAgents] = useState<SavedAgent[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // New state for viewing files (Modal Viewer - Legacy/Backup)
  const [viewingFile, setViewingFile] = useState<Attachment | null>(null);

  // Set initial chat state based on screen width
  useEffect(() => {
    if (window.innerWidth >= 768) {
      setIsChatOpen(true);
    }
  }, []);

  // Load persistence (Agents & Sessions)
  useEffect(() => {
    const loadedAgents = localStorage.getItem('probotics_agents');
    if (loadedAgents) setSavedAgents(JSON.parse(loadedAgents));

    const loadedSessions = localStorage.getItem('probotics_sessions');
    if (loadedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(loadedSessions);
        setSessions(parsedSessions);
        
        // Restore last session if available
        const lastId = localStorage.getItem('probotics_last_session_id');
        if (lastId) {
            const lastSession = parsedSessions.find(s => s.id === lastId);
            if (lastSession) {
                setCurrentSessionId(lastSession.id);
                setMessages(lastSession.messages);
            }
        }
    } else {
        // Init first session if none
        handleCreateSession();
    }
  }, []);

  // Save Agents
  useEffect(() => {
    localStorage.setItem('probotics_agents', JSON.stringify(savedAgents));
  }, [savedAgents]);

  // Save Sessions (Auto-save current session)
  useEffect(() => {
     if (currentSessionId && messages.length > 0) {
         setSessions(prev => {
             const existingIndex = prev.findIndex(s => s.id === currentSessionId);
             // Generate a title based on first user message if Untitled
             const firstUserMsg = messages.find(m => m.role === Role.USER)?.content.substring(0, 30);
             const title = firstUserMsg ? firstUserMsg + (firstUserMsg.length === 30 ? '...' : '') : 'New Session';

             const updatedSession: ChatSession = {
                 id: currentSessionId,
                 title: prev[existingIndex]?.title === 'New Session' ? title : prev[existingIndex]?.title || title,
                 messages: messages,
                 lastModified: Date.now(),
                 preview: messages[messages.length - 1].content.substring(0, 50)
             };

             let newSessions = [...prev];
             if (existingIndex >= 0) {
                 newSessions[existingIndex] = updatedSession;
             } else {
                 newSessions.push(updatedSession);
             }
             
             localStorage.setItem('probotics_sessions', JSON.stringify(newSessions));
             return newSessions;
         });
     }
  }, [messages, currentSessionId]);

  // Save Last Session ID
  useEffect(() => {
      if (currentSessionId) localStorage.setItem('probotics_last_session_id', currentSessionId);
  }, [currentSessionId]);

  // Terminal Helpers
  const addTerminalLog = (message: string, type: 'info' | 'process' | 'success' | 'warning' | 'error' = 'info') => {
      setTerminalLogs(prev => [...prev, {
          id: Date.now().toString() + Math.random(),
          message,
          type,
          timestamp: Date.now()
      }]);
  };

  // Session Handlers
  const handleCreateSession = () => {
      const newId = Date.now().toString();
      const newSession: ChatSession = {
          id: newId,
          title: 'New Session',
          messages: [],
          lastModified: Date.now(),
          preview: 'Empty'
      };
      setSessions(prev => [...prev, newSession]);
      setCurrentSessionId(newId);
      setMessages([]);
      addTerminalLog("New Session Initialized", 'info');
  };

  const handleLoadSession = (session: ChatSession) => {
      setCurrentSessionId(session.id);
      setMessages(session.messages);
      addTerminalLog(`Session Loaded: ${session.title}`, 'success');
  };

  const handleDeleteSession = (id: string) => {
      setSessions(prev => {
          const filtered = prev.filter(s => s.id !== id);
          localStorage.setItem('probotics_sessions', JSON.stringify(filtered));
          return filtered;
      });
      if (currentSessionId === id) {
          handleCreateSession(); // Reset if deleted active
      }
  };

  // Agent Management Handlers
  const handleSaveAgent = (name: string) => {
    const newAgent: SavedAgent = {
      id: Date.now().toString(),
      name,
      config: { ...config }, // Clone current config
      createdAt: Date.now()
    };
    setSavedAgents(prev => [...prev, newAgent]);
    addTerminalLog(`Identity Saved: ${name}`, 'success');
  };

  const handleLoadAgent = (agent: SavedAgent) => {
    setConfig(agent.config);
    // When loading an agent, we add a system note but don't clear chat unless user starts new session
    const sysMsg: Message = {
        id: Date.now().toString(),
        role: Role.SYSTEM,
        content: `System Kernel Rebooted. Identity loaded: ${agent.name}`,
        timestamp: Date.now()
    };
    setMessages(prev => [...prev, sysMsg]);
    addTerminalLog(`Identity Loaded: ${agent.name}`, 'info');
  };

  const handleDeleteAgent = (id: string) => {
    setSavedAgents(prev => prev.filter(a => a.id !== id));
    addTerminalLog(`Identity Deleted.`, 'warning');
  };

  // Handle Screen Share Toggle
  const handleToggleScreenShare = async () => {
    // Safety check for browser support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        addTerminalLog("Screen sharing not supported on this device/browser.", "error");
        return;
    }

    if (isScreenShareActive) {
        // Stop sharing
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
        }
        setScreenStream(null);
        setIsScreenShareActive(false);
    } else {
        // Start sharing
        try {
            // If camera is active, turn it off to avoid conflicts in visual hierarchy
            if (isCameraActive) setIsCameraActive(false);

            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: true,
                audio: false 
            });
            
            setScreenStream(stream);
            setIsScreenShareActive(true);

            // Handle user clicking "Stop sharing" on browser native UI
            stream.getVideoTracks()[0].onended = () => {
                setScreenStream(null);
                setIsScreenShareActive(false);
            };

        } catch (err) {
            console.error("Error starting screen share:", err);
            setIsScreenShareActive(false);
            addTerminalLog("Screen share failed or cancelled.", "warning");
        }
    }
  };

  // Wrapper for Camera Toggle to ensure mutual exclusivity
  const handleToggleCamera = () => {
      if (!isCameraActive && isScreenShareActive) {
          // If turning camera on, stop screen share
          handleToggleScreenShare();
      }
      setIsCameraActive(!isCameraActive);
  };

  // Handle capturing frame (Camera OR Screen)
  const captureFrame = async (): Promise<Attachment | null> => {
    if (!isCameraActive && !isScreenShareActive) return null;
    
    try {
      // Determine which video element to capture
      const selector = isScreenShareActive ? '#screen-feed' : '#camera-feed';
      const videoElement = document.querySelector(selector) as HTMLVideoElement;
      
      // Strict check to ensure video is ready
      if (!videoElement || videoElement.readyState < 2) { 
        console.warn("Frame capture skipped: Video not ready");
        return null;
      }
        
      // PERFORMANCE FIX: Significantly reduce resolution for AI analysis
      // This prevents the "Black Screen / Freeze" issue caused by memory overload
      const MAX_WIDTH = 800; 
      let width = videoElement.videoWidth;
      let height = videoElement.videoHeight;

      if (width > MAX_WIDTH) {
          const scale = MAX_WIDTH / width;
          width = MAX_WIDTH;
          height = height * scale;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency
      
      if (ctx) {
        // Draw image scaled
        ctx.drawImage(videoElement, 0, 0, width, height);
        
        // Use lower quality (0.6) to speed up Base64 generation and upload
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        
        // Explicitly clear canvas to help Garbage Collector
        canvas.width = 0;
        canvas.height = 0;
        
        return {
          name: isScreenShareActive ? 'screen_capture.jpg' : 'camera_snapshot.jpg',
          mimeType: 'image/jpeg',
          data: dataUrl,
          isText: false
        };
      }
    } catch (e) {
      console.error("Frame capture failed:", e);
      addTerminalLog("Visual capture failed (Resource Locked)", 'error');
    }
    return null;
  };

  const handleSendMessage = async (text: string, attachments: Attachment[]) => {
    // Clear previous execution logs for clarity on new request
    setTerminalLogs([]);

    // 1. Capture visual context if active
    let currentAttachments = [...attachments];
    
    // NOTE: We capture frame BEFORE setting loading state to ensure UI hasn't locked up yet
    if (isCameraActive || isScreenShareActive) {
      const frame = await captureFrame();
      if (frame) {
        currentAttachments.push(frame);
      }
    }

    // 2. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      content: text,
      timestamp: Date.now(),
      attachments: currentAttachments
    };
    
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    
    // 3. Call Gemini
    try {
      const response = await generateResponse(
        text, 
        messages, 
        currentAttachments, 
        config,
        addTerminalLog // Pass logging callback
      );

      // Handle generated attachments
      const botAttachments = response.generatedAttachments || [];

      // --- 3D MODEL HANDLER ---
      if (response.toolResult?.type === '3d_model') {
          const threeCode = response.toolResult.data.code;
          const htmlWrapper = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>body { margin: 0; overflow: hidden; background: #050a14; }</style>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="canvas-container" style="width: 100vw; height: 100vh;"></div>
  <script>
    try {
      const container = document.getElementById('canvas-container');
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050a14);
      
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 5;
      
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      container.appendChild(renderer.domElement);

      // Lights (Default setup)
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(5, 5, 5);
      scene.add(directionalLight);

      // Resize Handler
      window.addEventListener('resize', () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // --- AI GENERATED CODE START ---
      ${threeCode}
      // --- AI GENERATED CODE END ---

      function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
      }
      animate();
    } catch (e) {
      document.body.innerHTML = '<div style="color:red; padding:20px; font-family:monospace;">Runtime Error: ' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
          
          botAttachments.push({
              name: '3d_model.html',
              mimeType: 'text/html',
              data: htmlWrapper,
              isText: true
          });
      }

      const botMsgId = (Date.now() + 1).toString();

      // --- SYNC DELAY LOGIC (5 SECONDS) ---
      let audioData: string | null = null;
      
      if (config.enableTTS && response.text && response.text !== "Standing by.") {
          addTerminalLog("Buffering audio stream...", 'process');
          const [audioResult] = await Promise.all([
             synthesizeSpeech(response.text, config.voiceName),
             new Promise(resolve => setTimeout(resolve, 3000)) // Reduced latency slightly
          ]);
          audioData = audioResult;
          if (audioData) addTerminalLog("Audio synced. Stream active.", 'success');
      } else {
          // If silent response or visual only, shorter delay
          await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const botMsg: Message = {
        id: botMsgId,
        role: Role.MODEL,
        content: response.text,
        timestamp: Date.now(),
        groundingUrls: response.groundingUrls,
        attachments: botAttachments,
        audioData: audioData || undefined,
        toolResult: response.toolResult 
      };

      setMessages(prev => [...prev, botMsg]);

      // --- CANVAS INTEGRATION LOGIC ---
      if (botAttachments.length > 0) {
          const contentToShow = botAttachments.find(att => att.name.includes('3d_model') || att.mimeType.startsWith('image/')) || botAttachments[0];
          setCanvasContent(contentToShow);
          setIsCanvasOpen(true);
          addTerminalLog("Canvas Module: Visual data rendering...", 'success');
      }

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.SYSTEM,
        content: "CRITICAL SYSTEM ERROR: Connection to neural core failed.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearMemory = () => {
    setMessages([]);
    setIsSettingsOpen(false);
    addTerminalLog("Current Session Cleared.", 'warning');
  };

  const handleAvatarUpload = (file: File | null) => {
    if (customAvatar) {
      URL.revokeObjectURL(customAvatar);
    }
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomAvatar(url);
    } else {
      setCustomAvatar(null);
    }
  };

  // Helper para reabrir canvas desde Chat
  const handleViewAttachment = (att: Attachment) => {
      setCanvasContent(att);
      setIsCanvasOpen(true);
  };

  return (
    <div className="relative w-screen h-[100dvh] bg-black text-white overflow-hidden font-sans selection:bg-neon-cyan selection:text-black">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black z-0"></div>

      {/* Main Content Layer */}
      <div className="relative z-10 w-full h-full flex flex-col md:flex-row">
        
        {/* Chat Sidebar */}
        <ChatInterface 
          messages={messages} 
          isOpen={isChatOpen} 
          onViewAttachment={handleViewAttachment}
          onClose={() => setIsChatOpen(false)}
          onAudioPlaybackChange={setIsSpeaking} 
        />

        {/* Central Viewport (Avatar/Camera) */}
        <main className={`flex-1 relative w-full h-full transition-all duration-300 ${isChatOpen ? 'md:ml-[450px]' : ''}`}>
           {/* Top Info Bar */}
           <div className="absolute top-0 left-0 right-0 p-4 flex justify-between md:justify-end z-30 pointer-events-none">
              <div className="glass-panel px-4 py-1 rounded-full text-[10px] md:text-xs font-mono text-neon-cyan border border-neon-cyan/20 truncate max-w-[200px] md:max-w-none">
                PROBOTICS v3.0 // {isCameraActive ? 'VISUAL_CORE_ACTIVE' : (isScreenShareActive ? 'SCREEN_DATA_LINK' : 'STANDBY')}
              </div>
           </div>

           <AvatarView 
             isCameraActive={isCameraActive} 
             isScreenShareActive={isScreenShareActive}
             screenStream={screenStream}
             isLoading={isLoading} 
             isSpeaking={isSpeaking}
             scale={config.avatarScale}
             customAvatarVideo={customAvatar}
           />
        </main>
      </div>

      {/* Execution Terminal */}
      <TerminalPanel 
          logs={terminalLogs}
          isVisible={isTerminalOpen} 
      />

      {/* Canvas Panel (Side Drawer) */}
      <CanvasPanel 
          isOpen={isCanvasOpen}
          content={canvasContent}
          onClose={() => setIsCanvasOpen(false)}
      />

      {/* Controls */}
      <ControlBar 
        onSendMessage={handleSendMessage}
        onToggleCamera={handleToggleCamera}
        onToggleScreenShare={handleToggleScreenShare}
        onToggleChat={() => setIsChatOpen(!isChatOpen)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleTerminal={() => setIsTerminalOpen(!isTerminalOpen)}
        onPreviewFile={handleViewAttachment}
        isCameraActive={isCameraActive}
        isScreenShareActive={isScreenShareActive}
        isChatOpen={isChatOpen}
        isTerminalOpen={isTerminalOpen}
        isLoading={isLoading}
        config={config}
        onConfigChange={setConfig}
      />

      {/* SUPPORT ASSISTANT */}
      <HelpAssistant />

      {/* FLOATING CANVAS TOGGLE BUTTON */}
      <button 
          onClick={() => setIsCanvasOpen(!isCanvasOpen)}
          className={`fixed bottom-10 right-4 md:right-8 z-[70] group flex items-center justify-center transition-all duration-300 ${isCanvasOpen ? 'w-10 h-10 bg-neon-cyan text-black' : 'w-12 h-12 bg-black/80 border border-neon-cyan/50 text-neon-cyan hover:scale-110 hover:shadow-[0_0_20px_rgba(0,243,255,0.5)]' } rounded-full backdrop-blur-md shadow-lg`}
          title="Abrir Canvas Visual"
      >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
      </button>

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onConfigChange={setConfig}
        onClearMemory={handleClearMemory}
        onUploadAvatar={handleAvatarUpload}
        savedAgents={savedAgents}
        onSaveAgent={handleSaveAgent}
        onLoadAgent={handleLoadAgent}
        onDeleteAgent={handleDeleteAgent}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onLoadSession={handleLoadSession}
        onDeleteSession={handleDeleteSession}
        onCreateSession={handleCreateSession}
      />

      {/* Legacy File Viewer (Backup) */}
      <FileViewer 
        file={viewingFile} 
        onClose={() => setViewingFile(null)} 
      />

    </div>
  );
};

export default App;