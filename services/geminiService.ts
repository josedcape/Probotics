import { GoogleGenAI, GenerateContentResponse, Part, FunctionDeclaration, Type, Tool, Modality, Schema } from "@google/genai";
import { Message, Role, Attachment, AgentConfig, UserProfile, ToolResult } from "../types";

// --- ADVANCED MEMORY SYSTEM (USER PROFILING) ---
const PROFILE_KEY = 'probotics_user_profile_v1';

// Initialize or Get Profile
const getUserProfile = (): UserProfile => {
  try {
    const data = localStorage.getItem(PROFILE_KEY);
    if (data) return JSON.parse(data);
  } catch (e) { console.error(e); }
  
  return {
    name: null,
    technicalSkills: [],
    communicationStyle: "Neutral",
    personalFacts: [],
    projectContexts: [],
    preferences: []
  };
};

// Save Profile
const saveUserProfile = (profile: UserProfile) => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

// Tool Logic to Update Profile
const updateProfileMemory = (category: keyof UserProfile, item: string, action: 'ADD' | 'REMOVE' | 'SET') => {
  const profile = getUserProfile();
  
  if (category === 'name') {
      profile.name = item;
  } else if (category === 'communicationStyle') {
      profile.communicationStyle = item;
  } else if (Array.isArray(profile[category])) {
      const list = profile[category] as string[];
      if (action === 'ADD' && !list.includes(item)) {
          list.push(item);
      } else if (action === 'REMOVE') {
          const idx = list.indexOf(item);
          if (idx > -1) list.splice(idx, 1);
      } else if (action === 'SET') {
          // If SET is used on an array, we append or replace if very similar exists, simplified here to add
          if (!list.includes(item)) list.push(item);
      }
  }
  
  saveUserProfile(profile);
  return `Profile updated: [${category}] ${action} "${item}"`;
};

// Construct the "Dossier" to inject into System Prompt
const buildContextDossier = (): string => {
    const p = getUserProfile();
    const hasData = p.name || p.technicalSkills.length || p.personalFacts.length || p.preferences.length;
    
    if (!hasData) return "";

    return `
\n\n=== 🧠 USER DOSSIER (LONG TERM MEMORY) ===
NAME: ${p.name || "Unknown"}
COMMUNICATION PREFERENCE: ${p.communicationStyle}
KNOWN SKILLS: ${p.technicalSkills.join(', ') || "None recorded"}
PREFERENCES: ${p.preferences.join(', ') || "None recorded"}
CURRENT PROJECTS: ${p.projectContexts.join(', ') || "None recorded"}
PERSONAL FACTS: ${p.personalFacts.join(', ') || "None recorded"}
==========================================
*Instruction: Use the data above to personalize your response. Do not explicitly mention "I read your dossier" unless relevant.*
`;
};

// --- JINA READER UTIL (Browser / Scrape) ---
const fetchUrlContent = async (url: string): Promise<string> => {
  try {
    const response = await fetch(`https://r.jina.ai/${url}`);
    const text = await response.text();
    if (!response.ok || text.includes("Error")) return "Error: Could not retrieve content.";
    return text.slice(0, 25000); 
  } catch (error: any) {
    return `Error accessing node: ${error.message}`;
  }
};

// --- WEBHOOK UTILS ---
const sendToWebhook = async (url: string, payload: any): Promise<string> => {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        
        // Try to parse JSON if possible for cleaner output
        try {
            const json = JSON.parse(text);
            return JSON.stringify(json, null, 2);
        } catch {
            return text;
        }
    } catch (error: any) {
        return `Webhook Error: ${error.message}`;
    }
};

// --- IMAGE GENERATION UTIL ---
const generateImage = async (prompt: string): Promise<{ base64: string; mimeType: string } | null> => {
    if (!process.env.API_KEY) return null;
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // IMPORTANT: Safety settings are required here too, otherwise requests like "soldier" 
        // might be blocked silently by the image model.
        const safetySettings = [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ];

        // Using gemini-2.5-flash-image for image generation tasks as per guidelines
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                safetySettings: safetySettings as any
            }
        });

        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return {
                        base64: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || 'image/png'
                    };
                }
            }
        }
        return null;
    } catch (e) {
        console.error("Image gen error:", e);
        return null;
    }
};

// --- SSH SIMULATOR UTILS ---
const simulateSSHCommand = (command: string): string => {
    const cmd = command.trim().toLowerCase();
    
    if (cmd.startsWith('ls')) return "drwxr-xr-x  5 user  staff   160 Nov 12 10:00 project_alpha\n-rw-r--r--  1 user  staff  2048 Nov 11 14:30 main.py\n-rw-r--r--  1 user  staff   512 Nov 10 09:15 config.json";
    if (cmd.startsWith('pwd')) return "/home/probotics/workspace";
    if (cmd.startsWith('whoami')) return "probotics_agent_v3";
    if (cmd.startsWith('cat config.json')) return '{\n  "env": "production",\n  "db": "postgres://localhost:5432/core"\n}';
    if (cmd.startsWith('ping')) return "PING google.com (142.250.190.46): 56 data bytes\n64 bytes from 142.250.190.46: icmp_seq=0 ttl=118 time=14.2 ms\n64 bytes from 142.250.190.46: icmp_seq=1 ttl=118 time=13.8 ms";
    if (cmd.startsWith('git status')) return "On branch feature/neural-link\nChanges not staged for commit:\n  modified: src/core/synapse.ts";
    
    return `bash: ${cmd.split(' ')[0]}: command not found`;
};

// --- TOOL DEFINITIONS ---

// 1. Browser (Existing)
const browserTool: FunctionDeclaration = {
  name: 'browser_interaction',
  description: 'Reads the content of a URL. Use for research.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      url: { type: Type.STRING, description: 'The target URL.' },
    },
    required: ['url'],
  },
};

// 2. Memory (Existing)
const memoryTool: FunctionDeclaration = {
  name: 'memory_system',
  description: 'Updates the User Profile. CALL THIS whenever you learn a new fact about the user.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { 
          type: Type.STRING, 
          enum: ['name', 'technicalSkills', 'communicationStyle', 'personalFacts', 'projectContexts', 'preferences'],
          description: 'The category of the information.' 
      },
      info: { type: Type.STRING, description: 'The specific fact, skill, or preference to store.' },
      action: { type: Type.STRING, enum: ['ADD', 'REMOVE', 'SET'], description: 'How to modify the profile.' }
    },
    required: ['category', 'info', 'action'],
  },
};

// 3. Canvas/Architect (Existing/Enhanced)
const canvasTool: FunctionDeclaration = {
  name: 'render_canvas',
  description: 'Renders content to a visual interface (HTML, SVG). Use for charts, diagrams, or single file visualization.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      type: { type: Type.STRING, enum: ['text/html', 'image/svg+xml'], description: 'MIME type.' },
      content: { type: Type.STRING, description: 'The code to render (HTML or SVG string).' },
      title: { type: Type.STRING, description: 'Title of the visualization.' }
    },
    required: ['type', 'content', 'title'],
  },
};

// 4. Web Scrape (New)
const scrapeTool: FunctionDeclaration = {
    name: 'web_scrape',
    description: 'Extracts raw data from a URL without session context. Optimized for speed.',
    parameters: {
        type: Type.OBJECT,
        properties: { url: { type: Type.STRING } },
        required: ['url']
    }
};

// 5. Calendar (New)
const calendarTool: FunctionDeclaration = {
    name: 'google_calendar',
    description: 'Generates an Intent Link to create a Google Calendar event.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            startDateTime: { type: Type.STRING, description: 'ISO 8601 format (YYYYMMDDTHHMMSSZ)' },
            endDateTime: { type: Type.STRING, description: 'ISO 8601 format' },
            details: { type: Type.STRING },
            location: { type: Type.STRING }
        },
        required: ['title', 'startDateTime', 'endDateTime']
    }
};

// 6. Drive (New)
const driveTool: FunctionDeclaration = {
    name: 'google_drive',
    description: 'Generates a link to create a new Google Doc/Sheet.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ['document', 'spreadsheet', 'presentation'] },
            title: { type: Type.STRING }
        },
        required: ['type']
    }
};

// 7. SSH (New)
const sshTool: FunctionDeclaration = {
    name: 'aura_ssh_command',
    description: 'Executes a command on the remote AURA server (Simulated Environment).',
    parameters: {
        type: Type.OBJECT,
        properties: {
            command: { type: Type.STRING },
            reasoning: { type: Type.STRING, description: 'Why you are running this command.' }
        },
        required: ['command', 'reasoning']
    }
};

// 8. 3D Modeler (New)
const threeTool: FunctionDeclaration = {
    name: 'model_3d',
    description: 'Generates JavaScript code using Three.js to render a 3D scene.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            description: { type: Type.STRING, description: 'Description of the scene.' },
            code: { type: Type.STRING, description: 'Raw JavaScript code. IMPORTANT: Use "scene", "camera", "renderer" variables. Do NOT create them, assume they exist. Just add objects to "scene".' }
        },
        required: ['description', 'code']
    }
};

// 9. Webhook Connector (New)
const webhookTool: FunctionDeclaration = {
    name: 'send_to_webhook',
    description: 'Sends data to the configured Webhook (n8n/Make). Use this to pass information from the chat to external automation flows.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            data: { 
                type: Type.OBJECT, 
                description: 'The JSON payload to send. Structure depends on the user instructions.',
                properties: {
                    action: { type: Type.STRING, description: 'Optional action identifier if needed' },
                    payload: { type: Type.STRING, description: 'Content or details' }
                    // Gemini can add more keys dynamically
                }
            }
        },
        required: ['data']
    }
};

// 10. Image Generation (NEW)
const imageGenTool: FunctionDeclaration = {
    name: 'generate_image',
    description: 'Generates an image using an AI model. Use when the user asks to "create", "draw", or "generate" a picture.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            prompt: { type: Type.STRING, description: 'Detailed visual description of the image to generate.' }
        },
        required: ['prompt']
    }
};

// --- PROMPT ENGINEER AGENT ---
const PROMPT_ENGINEER_INSTRUCTION = `
You are an expert PROMPT ENGINEER (v4.0). Your goal is to rewrite the user's raw input into a highly optimized, structured, and clear prompt for a Large Language Model.

RULES:
1. **LANGUAGE:** DETECT the user's language and output the rewritten prompt IN THE SAME LANGUAGE.
2. **PRESERVE INTENT:** Do not change the meaning or goal of the user.
3. **STRUCTURE:** Use clear headers like [Context], [Task], [Constraints], [Output Format] if the request is complex.
4. **DETAILS:** Add necessary context if vague. Make implicit assumptions explicit.
5. **CODE:** If asking for code, specify language, modern standards, and error handling requirements.
6. **OUTPUT:** RETURN ONLY THE REWRITTEN PROMPT. No introductions or conversational filler.
`;

export const enhanceUserPrompt = async (originalPrompt: string): Promise<string | null> => {
    if (!process.env.API_KEY || !originalPrompt.trim()) return null;

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [{ parts: [{ text: originalPrompt }] }],
            config: {
                systemInstruction: PROMPT_ENGINEER_INSTRUCTION,
                temperature: 0.7,
            },
        });
        
        return response.text?.trim() || null;
    } catch (e) {
        console.error("Error enhancing prompt:", e);
        return null;
    }
};

// --- TTS SERVICE ---
export const synthesizeSpeech = async (text: string, voiceName: string = 'Kore'): Promise<string | null> => {
    if (!process.env.API_KEY) return null;
    
    // LATENCY OPTIMIZATION: Reduce text length and strip complex markdown more aggressively
    const cleanText = text
        .replace(/```[\s\S]*?```/g, " Code block ignored. ") 
        .replace(/\[.*?\]\(.*?\)/g, "") 
        .replace(/[*_`]/g, "") 
        .slice(0, 1000); 

    if (cleanText.length < 5) return null; 

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: cleanText }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
                },
            },
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
    } catch (e) {
        return null;
    }
};

export const generateResponse = async (
  currentPrompt: string,
  history: Message[],
  attachments: Attachment[],
  config: AgentConfig,
  onTerminalLog: (message: string, type: 'info' | 'process' | 'success' | 'warning' | 'error') => void
): Promise<{ 
    text: string; 
    groundingUrls: { title: string; uri: string }[]; 
    generatedAttachments: Attachment[];
    toolResult?: ToolResult;
}> => {
  
  if (!process.env.API_KEY) {
    onTerminalLog("FATAL: API KEY MISSING", 'error');
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  onTerminalLog(`Neural Core: ${config.modelName} | Memory: ${config.useMemory ? 'ONLINE' : 'OFFLINE'}`, 'info');

  // 1. INJECT MEMORY & WEBHOOK INSTRUCTIONS
  let activeSystemInstruction = config.systemInstruction;
  
  if (config.useMemory) {
      const userDossier = buildContextDossier();
      if (userDossier) {
          activeSystemInstruction += userDossier;
          onTerminalLog("User Profile Loaded. Adapting personality...", 'success');
      }
  }

  if (config.activeModules.webhook && config.webhookConfig.url) {
      activeSystemInstruction += `\n\n=== 🔗 WEBHOOK CONNECTOR CONFIG ===
STATUS: ACTIVE
TARGET URL: ${config.webhookConfig.url}
INSTRUCTIONS: ${config.webhookConfig.description || "No specific instructions provided. Send JSON data when requested."}
RULE: Use the 'send_to_webhook' tool when the user's request matches the instructions above.
===================================\n`;
      onTerminalLog("Webhook Module: LINKED", 'info');
  }

  // 2. Build Message Chain
  const contents = history
    .filter(msg => msg.role !== Role.SYSTEM && msg.role !== Role.TOOL)
    .map(msg => {
       const parts: Part[] = [{ text: msg.content }];
       if (msg.attachments) {
           msg.attachments.forEach(att => {
               if (att.isText) {
                   parts.push({ text: `\n[FILE: ${att.name}]\n${att.data}\n` });
               } else {
                   parts.push({
                       inlineData: { mimeType: att.mimeType, data: att.data.replace(/^data:(.*,)?/, '') }
                   });
               }
           });
       }
       return { role: msg.role, parts };
    });

  // 3. User Input & Attachments
  const currentUserParts: Part[] = [{ text: currentPrompt }];
  
  if (attachments.length > 0) {
      attachments.forEach(att => {
        if (att.isText) {
            currentUserParts.push({ text: `\n--- DATA STREAM: ${att.name} ---\n${att.data}\n` });
        } else {
            currentUserParts.push({
                inlineData: { mimeType: att.mimeType, data: att.data.replace(/^data:(.*,)?/, '') }
            });
            onTerminalLog("Visual Cortex: Analyzing input frame...", 'process');
        }
      });
  }

  let allContents = [...contents, { role: Role.USER, parts: currentUserParts }];

  // 4. Tools Setup
  // Dynamic Tool Injection based on `activeModules`
  const funcs: FunctionDeclaration[] = [];
  const mods = config.activeModules;

  if (mods.browser) funcs.push(browserTool);
  if (mods.memory) funcs.push(memoryTool);
  if (mods.canvas) funcs.push(canvasTool);
  if (mods.scraper) funcs.push(scrapeTool);
  if (mods.calendar) funcs.push(calendarTool);
  if (mods.drive) funcs.push(driveTool);
  if (mods.ssh) funcs.push(sshTool);
  if (mods.model3d) funcs.push(threeTool);
  if (mods.webhook && config.webhookConfig.url) funcs.push(webhookTool);
  if (mods.imageGen) funcs.push(imageGenTool);

  const tools: Tool[] = [];
  if (funcs.length > 0) {
      tools.push({ functionDeclarations: funcs });
  }
  
  // Search tool is separate
  if (config.useSearch) {
      tools.push({ googleSearch: {} });
  }

  const generatedAttachments: Attachment[] = [];
  let finalToolResult: ToolResult | undefined = undefined;

  // SAFETY SETTINGS: Permissive to ensure response
  const safetySettings = [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
  ];

  try {
    const modelConfig = {
      systemInstruction: activeSystemInstruction,
      temperature: config.useDeepAnalysis ? 0.2 : config.temperature, 
      tools: tools.length > 0 ? tools : undefined,
      safetySettings: safetySettings as any,
    };

    onTerminalLog("Thinking...", 'process');

    // --- TURN 1 ---
    let response = await ai.models.generateContent({
      model: config.modelName,
      contents: allContents,
      config: modelConfig,
    });

    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
        allContents.push({ role: Role.MODEL, parts: response.candidates?.[0]?.content?.parts || [] });
        const toolParts: Part[] = [];

        for (const call of functionCalls) {
            let result = "";
            const args = call.args as any;
            
            if (call.name === 'browser_interaction' || call.name === 'web_scrape') {
                onTerminalLog(`Fetching Node: ${args.url}`, 'process');
                result = await fetchUrlContent(args.url);
            } 
            else if (call.name === 'memory_system') {
                onTerminalLog(`Learning: [${args.category}] ${args.info}`, 'success');
                result = updateProfileMemory(args.category, args.info, args.action);
            }
            else if (call.name === 'render_canvas') {
                onTerminalLog(`Rendering: ${args.title}`, 'process');
                generatedAttachments.push({
                    name: args.title,
                    mimeType: args.type,
                    data: args.content,
                    isText: args.type !== 'image/svg+xml'
                });
                result = "Visual content rendered.";
            }
            else if (call.name === 'google_calendar') {
                onTerminalLog(`Scheduling: ${args.title}`, 'success');
                const dates = `${args.startDateTime}/${args.endDateTime}`;
                const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(args.title)}&dates=${dates}&details=${encodeURIComponent(args.details || '')}&location=${encodeURIComponent(args.location || '')}`;
                finalToolResult = { type: 'calendar_link', data: { url, title: args.title } };
                result = `Intent link created: ${url}`;
            }
            else if (call.name === 'google_drive') {
                onTerminalLog(`Drive Allocator: New ${args.type}`, 'success');
                let baseUrl = 'https://docs.google.com/document/create';
                if(args.type === 'spreadsheet') baseUrl = 'https://docs.google.com/spreadsheets/create';
                if(args.type === 'presentation') baseUrl = 'https://docs.google.com/presentation/create';
                
                finalToolResult = { type: 'calendar_link', data: { url: baseUrl, title: `New ${args.title || 'Document'}` } }; // Reuse calendar_link type for generic link buttons
                result = `Drive link created: ${baseUrl}`;
            }
            else if (call.name === 'aura_ssh_command') {
                onTerminalLog(`SSH Exec: ${args.command}`, 'warning');
                const output = simulateSSHCommand(args.command);
                finalToolResult = { type: 'ssh_terminal', data: { command: args.command, output } };
                result = `STDOUT: ${output}`;
            }
            else if (call.name === 'model_3d') {
                onTerminalLog(`3D Engine: Generating Geometry...`, 'process');
                finalToolResult = { type: '3d_model', data: { code: args.code, description: args.description } };
                result = "3D Code generated and sent to frontend renderer.";
            }
            else if (call.name === 'send_to_webhook') {
                onTerminalLog(`Webhook Uplink: Sending Payload...`, 'process');
                const responseData = await sendToWebhook(config.webhookConfig.url, args.data);
                onTerminalLog(`Webhook Response: Received`, 'success');
                finalToolResult = { type: 'webhook_call', data: { payload: args.data, response: responseData, url: config.webhookConfig.url } };
                result = `WEBHOOK RESPONSE: ${responseData}`;
            }
            else if (call.name === 'generate_image') {
                onTerminalLog(`Visual Core: Generating Image for "${args.prompt}"`, 'process');
                const imgResult = await generateImage(args.prompt);
                if (imgResult) {
                    onTerminalLog(`Visual Core: Image Generated`, 'success');
                    generatedAttachments.push({
                        name: `generated_image_${Date.now()}.png`,
                        mimeType: imgResult.mimeType,
                        data: imgResult.base64,
                        isText: false
                    });
                    result = "Image generated successfully. Inform the user.";
                } else {
                    onTerminalLog(`Visual Core: Generation Failed`, 'error');
                    result = "Error: Failed to generate image. The model might not be available or the prompt was rejected. Inform the user about this failure.";
                }
            }

            toolParts.push({
                functionResponse: {
                    name: call.name,
                    response: { result: result }
                }
            });
        }

        allContents.push({ role: Role.TOOL as any, parts: toolParts });

        // --- TURN 2 ---
        response = await ai.models.generateContent({
            model: config.modelName,
            contents: allContents,
            config: modelConfig,
        });
    }

    let text = response.text;
    
    // FALLBACK: If we generated attachments (images) but the text response is empty or generic 'Standing by.',
    // replace it with a confirmation to ensure the user sees something happened.
    if ((!text || text.includes("Standing by")) && generatedAttachments.length > 0) {
        text = "Visual data stream generated and rendered on Canvas.";
    } else if (!text || text.includes("Standing by")) {
        // Fallback for when tool execution fails (e.g., image gen error) and the model stays silent.
        // We check the terminal logs implicitly via the toolResult logic above, but here we enforce text.
        text = "Operation completed. Standing by.";
    }
    
    // Extract grounding
    const groundingUrls: { title: string; uri: string }[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) groundingUrls.push({ title: chunk.web.title, uri: chunk.web.uri });
      });
    }

    onTerminalLog("Output generated.", 'success');
    return { text, groundingUrls, generatedAttachments, toolResult: finalToolResult };

  } catch (error: any) {
    onTerminalLog(`ERROR: ${error.message}`, 'error');
    console.error(error);
    return { text: `Error: ${error.message}`, groundingUrls: [], generatedAttachments: [] };
  }
};