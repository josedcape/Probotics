# Especificación de Integración: Terminal de Comandos (HUD)

Este documento detalla cómo integrar, conectar y operar el módulo de "Terminal de Comandos" en la interfaz de PROBOTICS. Este componente actúa como un registro visual de los procesos internos del asistente (pensamiento, uso de herramientas, errores), proporcionando transparencia y estética "Cyberpunk" al usuario.

## 1. Arquitectura de Datos

La terminal no es un simple string de texto; es una colección de objetos estructurados. Definimos la estructura en `types.ts`.

### Interfaz `TerminalLog`
Cada línea en la terminal debe cumplir con este contrato:

```typescript
export interface TerminalLog {
  id: string;       // Identificador único para React (key)
  message: string;  // El texto a mostrar
  type: 'info' | 'process' | 'success' | 'warning' | 'error'; // Determina el color/animación
  timestamp: number; // Para mostrar la hora de ejecución
}
```

---

## 2. Implementación de la UI (`TerminalPanel.tsx`)

El componente visual es "tonto" (stateless respect to logic); solo renderiza lo que recibe vía props.

*   **Ubicación:** `components/TerminalPanel.tsx`
*   **Props:**
    *   `logs: TerminalLog[]`: Array de mensajes a mostrar.
    *   `isVisible: boolean`: Controla la visibilidad (CSS transform/opacity).
*   **Auto-Scroll:** Debe usar un `useRef` referenciando un div vacío al final de la lista para hacer scroll automático (`scrollIntoView`) cada vez que el array `logs` cambie.

---

## 3. Conexión Lógica (El Puente)

La conexión entre el cerebro (Gemini) y la vista (React) se realiza mediante el patrón **"Callback Injection"**. El estado vive en `App.tsx` y se pasa hacia abajo.

### Paso A: Estado en `App.tsx`

```typescript
// 1. Definir el estado
const [terminalLogs, setTerminalLogs] = useState<TerminalLog[]>([]);

// 2. Crear la función ayudante (Bridge)
const addTerminalLog = (message: string, type: 'info' | 'process' | 'success' | 'warning' | 'error' = 'info') => {
    setTerminalLogs(prev => [...prev, {
        id: Date.now().toString() + Math.random(), // Generación de ID único
        message,
        type,
        timestamp: Date.now()
    }]);
};
```

### Paso B: Pasar el Callback al Servicio

Cuando llamamos a `generateResponse` en `geminiService.ts`, inyectamos la función `addTerminalLog`.

**En `App.tsx`:**
```typescript
const response = await generateResponse(
    text, 
    messages, 
    attachments, 
    config,
    addTerminalLog // <--- INYECCIÓN DEL CALLBACK
);
```

---

## 4. Ejecución de Tareas en el Asistente (`geminiService.ts`)

El servicio recibe el callback y lo utiliza para reportar estado en tiempo real, especialmente durante el uso de herramientas (Function Calling).

### Firma de la Función
```typescript
export const generateResponse = async (
  ...,
  // Recibimos el callback aquí
  onTerminalLog: (message: string, type: 'info' | 'process' | 'success' | 'warning' | 'error') => void
) => { ... }
```

### Casos de Uso para Reportar Tareas

#### 1. Inicio de Proceso (Thinking)
Justo antes de llamar a la API:
```typescript
onTerminalLog("Neural Core: Analyzing input...", 'process');
```

#### 2. Ejecución de Herramientas (Tool Execution)
Cuando el modelo decide usar una herramienta (ej. Navegador o Memoria), reportamos la acción antes de ejecutarla para dar feedback visual.

```typescript
if (call.name === 'browser_interaction') {
    // Feedback visual inmediato
    onTerminalLog(`Browsing Node: ${(call.args as any).url}`, 'process'); 
    
    // Ejecución real
    result = await fetchUrlContent((call.args as any).url);
} 
else if (call.name === 'memory_system') {
    const args = call.args as any;
    // Feedback de éxito
    onTerminalLog(`Writing Memory: [${args.category}]`, 'success');
    
    result = updateProfileMemory(...);
}
```

#### 3. Manejo de Errores
Si el bloque `try/catch` captura una excepción:
```typescript
onTerminalLog(`FATAL ERROR: ${error.message}`, 'error');
```

---

## 5. Estilos y Efectos Visuales

Para lograr la estética correcta, el componente `TerminalPanel` debe aplicar clases condicionales basadas en el `type` del log:

*   `'process'`: Color Púrpura/Neon (`text-neon-purple`) + Animación `animate-pulse`. Usar prefijo `> ` para simular comando activo.
*   `'success'`: Color Verde Matrix (`text-green-400`).
*   `'error'`: Color Rojo y negrita (`text-red-500 font-bold`).
*   `'info'`: Color Cyan estándar (`text-neon-cyan`).

### Animación de Entrada
Cada línea nueva debe tener una animación de aparición (ej. `animate-scan` definida en `tailwind.config`) para simular el barrido de un monitor CRT antiguo.

```css
@keyframes scan {
  0% { transform: translateY(-100%); opacity: 0; }
  50% { opacity: 1; }
  100% { transform: translateY(0); opacity: 1; } /* Ajustado para listas */
}
```
