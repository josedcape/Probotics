import React, { useEffect, useRef } from 'react';

interface AvatarViewProps {
  isCameraActive: boolean;
  isScreenShareActive?: boolean;
  screenStream?: MediaStream | null;
  isLoading: boolean;
  isSpeaking: boolean;
  scale: number;
  customAvatarVideo: string | null;
  onFrameCapture?: (base64: string) => void;
}

const AvatarView: React.FC<AvatarViewProps> = ({ 
  isCameraActive, 
  isScreenShareActive = false,
  screenStream = null,
  isLoading, 
  isSpeaking, 
  scale,
  customAvatarVideo 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  const customVideoRef = useRef<HTMLVideoElement>(null);

  // Handle Camera Stream
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      if (isCameraActive && videoRef.current) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoRef.current.srcObject = stream;
        } catch (err) {
          console.error("Camera access denied:", err);
        }
      }
    };

    const stopCamera = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    if (isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isCameraActive]);

  // Handle Screen Share Stream
  useEffect(() => {
      if (isScreenShareActive && screenStream && screenRef.current) {
          screenRef.current.srcObject = screenStream;
      } else if (screenRef.current) {
          screenRef.current.srcObject = null;
      }
  }, [isScreenShareActive, screenStream]);

  // Handle Custom Avatar Video Playback (SYNC LOGIC)
  useEffect(() => {
    const vid = customVideoRef.current;
    
    // Safety check: if we switched to camera or screen, do nothing
    if (!vid || !customAvatarVideo || isCameraActive || isScreenShareActive) return;

    const syncVideo = async () => {
        try {
            if (isSpeaking) {
                // Si debe hablar y está pausado, reproducir.
                if (vid.paused) {
                    await vid.play();
                }
            } else {
                // Si no debe hablar, pausar y resetear al frame neutral (0).
                if (!vid.paused) {
                    vid.pause();
                }
                // Forzamos el regreso al inicio para que la boca se cierre (asumiendo que frame 0 es neutral)
                vid.currentTime = 0;
            }
        } catch (e) {
            console.warn("Avatar video sync interrupted:", e);
        }
    };

    syncVideo();

  }, [isSpeaking, customAvatarVideo, isCameraActive, isScreenShareActive]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-void">
      
      {/* VIOLET BORDER ANIMATION OVERLAY */}
      <div className="snake-border-container">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
      </div>

      {/* Holographic Grid Floor/Ceiling Effect */}
      <div className="absolute inset-0 z-0 pointer-events-none holo-grid opacity-20"></div>
      
      {/* Central glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-neon-blue/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Camera Feed - Priority 1 */}
      {isCameraActive && (
        <video
          id="camera-feed"
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover z-10 opacity-80 mix-blend-screen"
        />
      )}

      {/* Screen Share Feed - Priority 2 */}
      {!isCameraActive && isScreenShareActive && (
          <div className="absolute inset-0 z-10 p-4 md:p-8 flex items-center justify-center">
             <div className="relative w-full h-full max-w-6xl flex items-center justify-center border border-neon-cyan/20 rounded-lg bg-black/50 backdrop-blur-sm overflow-hidden shadow-[0_0_50px_rgba(0,243,255,0.1)]">
                 <video
                    id="screen-feed"
                    ref={screenRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 px-2 py-1 bg-neon-cyan/10 border border-neon-cyan/50 text-neon-cyan text-[10px] font-mono rounded">
                    SCREEN_LINK_ACTIVE
                </div>
             </div>
          </div>
      )}

      {/* Custom Avatar Video Container */}
      {!isCameraActive && !isScreenShareActive && customAvatarVideo && (
        <div 
          className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-sm bg-black/20 transition-transform duration-500 ease-out"
          style={{ transform: `scale(${scale})` }}
        >
            <video
                ref={customVideoRef}
                src={customAvatarVideo}
                loop
                muted
                playsInline
                preload="auto"
                className="max-w-full max-h-full object-contain opacity-90 drop-shadow-[0_0_15px_rgba(0,243,255,0.3)]"
            />
            {/* Overlay to blend the video with the theme */}
            <div className="absolute inset-0 bg-void/10 mix-blend-overlay pointer-events-none"></div>
        </div>
      )}

      {/* AI Visualizer (The Orb) - Only show if NO camera, NO screen, and NO custom avatar */}
      {!isCameraActive && !isScreenShareActive && !customAvatarVideo && (
        <div 
          className="relative z-20 flex flex-col items-center justify-center pointer-events-none animate-float transition-transform duration-300"
          style={{ transform: `scale(${scale})` }}
        >
            <div className={`relative transition-all duration-500 ${isLoading ? 'scale-125 drop-shadow-[0_0_30px_rgba(255,0,255,0.5)]' : 'scale-100'}`}>
            {/* Core */}
            <div className={`w-40 h-40 rounded-full blur-sm bg-black border border-neon-cyan/50 shadow-[0_0_50px_rgba(0,243,255,0.2),inset_0_0_20px_rgba(0,243,255,0.2)] flex items-center justify-center overflow-hidden relative`}>
                {/* Inner energy */}
                <div className={`absolute inset-0 bg-gradient-to-tr from-neon-blue/20 to-neon-purple/20 ${isSpeaking ? 'animate-pulse-fast' : 'animate-pulse'}`}></div>
                <div className={`w-32 h-32 rounded-full border border-neon-cyan/30 ${isLoading ? 'animate-spin border-t-neon-pink border-r-transparent' : (isSpeaking ? 'animate-pulse scale-110' : 'animate-pulse')}`}></div>
            </div>
            
            {/* Rings */}
            <div className={`absolute -inset-4 border border-neon-purple/30 rounded-full border-t-transparent border-l-transparent ${isSpeaking ? 'animate-[spin_1s_linear_infinite]' : 'animate-[spin_6s_linear_infinite]'}`}></div>
            <div className={`absolute -inset-8 border border-dashed border-neon-blue/20 rounded-full ${isSpeaking ? 'animate-[spin_3s_linear_infinite_reverse]' : 'animate-[spin_12s_linear_infinite_reverse]'}`}></div>
            </div>
        </div>
      )}

      {/* Status Text Overlay (Always visible on top of everything) */}
      <div className="absolute z-20 mt-12 flex flex-col items-center gap-2 top-1/2 pt-20 pointer-events-none">
          {!customAvatarVideo && !isCameraActive && !isScreenShareActive && (
              <div className={`font-display tracking-[0.3em] text-sm uppercase ${isLoading ? 'text-neon-pink animate-pulse' : 'text-neon-cyan'}`}>
                {isLoading ? 'SYNTHESIZING...' : (isSpeaking ? 'SPEAKING...' : 'PROBOTICS v2.5')}
              </div>
          )}
          <div className="text-[10px] text-gray-500 font-mono flex items-center gap-2 bg-black/40 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm">
             <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-red-500 animate-pulse' : (isScreenShareActive ? 'bg-neon-cyan animate-pulse' : (isSpeaking ? 'bg-neon-purple animate-pulse' : 'bg-green-500'))}`}></span>
             {isCameraActive ? 'VISUAL FEED ACTIVE' : (isScreenShareActive ? 'SCREEN DATA LINK' : (customAvatarVideo ? 'AVATAR LINKED' : (isSpeaking ? 'AUDIO OUTPUT' : 'SYSTEM OPTIMAL')))}
          </div>
      </div>
      
      {/* Scanning Line overlay when processing */}
      {isLoading && (
        <div className="absolute inset-0 z-30 pointer-events-none bg-gradient-to-b from-transparent via-neon-cyan/5 to-transparent h-[5%] w-full animate-scan"></div>
      )}
    </div>
  );
};

export default AvatarView;