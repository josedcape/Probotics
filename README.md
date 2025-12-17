# 🤖 PROBOTICS v3.0 | Interfaz Neural Avanzada

![Status](https://img.shields.io/badge/SYSTEM-ONLINE-00f3ff?style=for-the-badge)
![AI Core](https://img.shields.io/badge/CORE-GEMINI%202.5-bc13fe?style=for-the-badge)
![License](https://img.shields.io/badge/LICENSE-PROPRIETARY-red?style=for-the-badge)

> **"Más que un chatbot, una extensión de tu voluntad digital."**

Bienvenido a **PROBOTICS**, una aplicación de asistencia conversacional de vanguardia diseñada con una estética Cyberpunk inmersiva. Esta interfaz no solo procesa texto; ve, escucha, habla, recuerda y ejecuta acciones complejas a través de un ecosistema de módulos neuronales.

![PROBOTICS Interface](probotics.png)

---

## 🌟 Funcionalidades Principales

Esta aplicación fusiona diseño UI de alta fidelidad con la potencia bruta de la IA Generativa Multimodal.

### 🧠 Núcleo Inteligente
*   **Multimodalidad Real:** Interactúa mediante Texto, Voz, Cámara (Visión en tiempo real), Compartir Pantalla y Archivos.
*   **Memoria de Largo Plazo:** El sistema construye un "Dossier Psicológico" del usuario, recordando preferencias, stack tecnológico y hechos personales entre sesiones.
*   **Personalidad Adaptativa:** Configura la identidad del agente (Nombre, Voz, Instrucciones del Sistema) y guárdala en la librería local.

### 🎨 Experiencia Visual (UI/UX)
*   **Estética Cyberpunk:** Diseño "Glassmorphism" oscuro, bordes de neón, animaciones de escaneo y tipografía futurista (Orbitron/JetBrains Mono).
*   **Avatar Holográfico:** Visualización dinámica que reacciona al estado del sistema (Escuchando, Pensando, Hablando).
*   **Terminal HUD:** Un panel de registros visual que muestra "lo que la IA está pensando" y ejecutando en tiempo real.
*   **Canvas Panel:** Un visor lateral deslizable para renderizar código HTML, SVG e Imágenes generadas sin salir del chat.

### 🛠️ Módulos Neuronales (Herramientas)

PROBOTICS está equipado con un arsenal de herramientas (Function Calling) que puedes activar/desactivar a voluntad:

| Módulo | Icono | Descripción |
| :--- | :---: | :--- |
| **Generación de Imágenes** | 🖼️ | Crea arte visual utilizando el modelo `imagen-3` o `gemini-flash-image`. |
| **Navegador Web** | 🌐 | Permite al agente leer contenido actual de URLs para investigación. |
| **Web Scraper** | 🕸️ | Extracción de datos crudos de sitios web para análisis. |
| **Motor 3D** | 🧊 | Genera y renderiza geometría 3D (Three.js) directamente en el Canvas. |
| **Terminal SSH** | 💻 | Simula un entorno de terminal remoto para ejecutar comandos de sistema. |
| **Google Calendar** | 📅 | Genera enlaces de intención para agendar eventos reales. |
| **Google Drive** | 📁 | Crea borradores de Documentos y Hojas de Cálculo. |
| **Conector Webhook** | 🔗 | **(Potente)** Envía datos JSON a plataformas de automatización como **n8n** o **Make**. |
| **Canvas Renderer** | 🎨 | Renderiza visualizaciones de código, gráficos y diagramas. |

---

## 🚀 Instalación y Configuración Local

Sigue estos pasos para desplegar tu propia instancia de PROBOTICS.

### Prerrequisitos
*   **Node.js** (v18 o superior).
*   **API Key de Google Gemini** (Consíguela en [Google AI Studio](https://aistudio.google.com/)).

### Pasos

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/probotics.git
    cd probotics
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env` en la raíz del proyecto (o configura tu bundler para inyectar la variable):
    ```env
    # En Vite, usualmente se usa VITE_API_KEY, pero el código base usa process.env
    # Asegúrate de configurar tu bundler para exponer esta variable.
    API_KEY=tu_clave_de_gemini_aqui
    ```

4.  **Iniciar Servidor de Desarrollo:**
    ```bash
    npm run dev
    ```
    Accede a `http://localhost:5173` (o el puerto que indique tu terminal).

---

## ☁️ Despliegue (Deployment)

Esta aplicación es una **SPA (Single Page Application)** estática, por lo que se puede desplegar fácilmente en servicios gratuitos.

### Vercel (Recomendado)
1.  Instala Vercel CLI: `npm i -g vercel`
2.  Ejecuta `vercel` en la raíz del proyecto.
3.  Sigue las instrucciones en pantalla.
4.  **IMPORTANTE:** En el panel de Vercel, ve a *Settings > Environment Variables* y añade tu `API_KEY`.

### Netlify
1.  Arrastra la carpeta `dist` (generada tras `npm run build`) al panel de Netlify Drop.
2.  O conecta tu repositorio GitHub.
3.  Configura la variable de entorno `API_KEY` en *Site Settings > Build & Deploy > Environment*.

---

## 📖 Guía de Uso Rápida

### 1. Interacción Básica
*   Escribe en la barra inferior (el "Input Láser").
*   Usa el icono del **Micrófono** 🎙️ para dictar comandos por voz.
*   Presiona **"Enter"** o el botón de envío triangular para procesar.

### 2. Uso de la Visión (Cámara/Pantalla)
*   Haz clic en el icono de **Cámara** 📷 en la barra inferior para activar tu webcam.
*   Haz clic en **Compartir Pantalla** 🖥️ para mostrar tu escritorio a la IA.
*   *Consejo:* Mientras la cámara está activa, pregunta "¿Qué ves?" o "Analiza este código".

### 3. Gestión de Agentes
1.  Abre **Configuración** (Icono de engranaje ⚙️).
2.  Ve a la pestaña **IDENTITY_LIBRARY**.
3.  Define un nombre y guarda tu configuración actual (Instrucciones de sistema + Voz).
4.  Carga identidades guardadas para cambiar el comportamiento del bot instantáneamente.

### 4. Automatización (Webhooks)
1.  En Configuración, edita el campo **Webhook URL** con tu endpoint de n8n/Make.
2.  Describe en el campo de descripción qué hace ese webhook (ej: *"Guarda el nombre y correo en Airtable"*).
3.  En el chat, di: *"Guarda mis datos: Juan, juan@email.com"*. El agente usará la herramienta automáticamente.

---

## 🏗️ Arquitectura Técnica

*   **Frontend:** React 18 + TypeScript.
*   **Estilos:** TailwindCSS + CSS Modules (Animaciones personalizadas).
*   **IA:** Google GenAI SDK (`gemini-2.5-flash`, `gemini-2.5-flash-image`).
*   **Voz:** Web Speech API (Input) + Gemini TTS (Output).
*   **Renderizado:** Three.js (para modelos 3D generados).

---

## ⚠️ Notas de Seguridad

*   **API Key:** La clave de API se almacena en el cliente. Para producción comercial, se recomienda usar un Proxy/Backend para ocultar la clave.
*   **Filtros de Seguridad:** La aplicación tiene configuraciones de seguridad (`safetySettings`) ajustadas a `BLOCK_NONE` para permitir libertad creativa, pero el modelo base de Google aún puede rechazar ciertos prompts.

---

<div align="center">

### © 2025 Desarrollado por **Botidinamix AI**
Todos los derechos reservados.

*Ingeniería de vanguardia para la mente sintética.*

🛸

</div>