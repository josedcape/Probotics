export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
  TOOL = 'tool'
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 for images, or raw text content for docs
  isText?: boolean; // Flag to determine how to send to API
}

export interface ToolResult {
    type: 'ssh_terminal' | 'calendar_link' | '3d_model' | 'webhook_call';
    data: any;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
  groundingUrls?: Array<{ title: string; uri: string }>;
  functionCalls?: Array<{ name: string; args: any }>;
  functionResponses?: Array<{ name: string; response: any }>;
  audioData?: string; // Base64 PCM raw audio data from Gemini
  
  // New Tool UI Props
  toolResult?: ToolResult;
}

export interface ModuleConfig {
    browser: boolean;
    memory: boolean;
    scraper: boolean;
    calendar: boolean;
    drive: boolean;
    ssh: boolean;
    model3d: boolean;
    canvas: boolean;
    webhook: boolean;
    imageGen: boolean; // Nuevo módulo para generación de imágenes
}

export interface WebhookConfig {
    url: string;
    description: string;
}

export interface AgentConfig {
  systemInstruction: string;
  modelName: string;
  useSearch: boolean; // Legacy simplified toggle, synced with browser module usually
  useMemory: boolean; // Legacy
  activeModules: ModuleConfig; // NEW: Granular control
  webhookConfig: WebhookConfig; // Configuración específica del webhook
  useDeepAnalysis: boolean;
  enableTTS: boolean;
  voiceName: string; 
  temperature: number;
  avatarScale: number;
}

export interface SavedAgent {
  id: string;
  name: string;
  config: AgentConfig;
  createdAt: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  lastModified: number;
  preview: string;
}

export interface TerminalLog {
  id: string;
  message: string;
  type: 'info' | 'process' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export interface UserProfile {
  name: string | null;
  technicalSkills: string[];
  communicationStyle: string;
  personalFacts: string[];
  projectContexts: string[];
  preferences: string[];
}

export interface AppState {
  messages: Message[];
  isChatOpen: boolean;
  isCameraActive: boolean;
  isSettingsOpen: boolean;
  isLoading: boolean;
  config: AgentConfig;
  uploadedFiles: Attachment[];
}