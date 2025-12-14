# PROBOTICS - Especificación de Arquitectura de Interfaz (UI/UX)

Este documento define la estructura técnica, la disposición espacial y el comportamiento de los componentes de la interfaz de usuario para la aplicación PROBOTICS. 

**Objetivo:** Proporcionar una guía estructural agnóstica al estilo visual para el desarrollo y mantenimiento del layout en versiones Móvil, Tablet y Escritorio.

---

## 1. Topología Raíz (Root Layout)

El contenedor principal de la aplicación (`App.tsx`) actúa como un **Viewport Bloqueado**.
- **Dimensiones:** Ocupa el 100% del ancho (`w-screen`) y el 100% de la altura dinámica del dispositivo (`100dvh`).
- **Comportamiento:** No existe scroll en el `body` principal. El desbordamiento (`overflow`) está oculto globalmente. Todo el scroll ocurre dentro de contenedores específicos internos.
- **Estructura Flex:** 
  - **Móvil:** `flex-col` (Columna).
  - **Escritorio:** `flex-row` (Fila).

## 2. Componentes Estructurales Principales

### 2.1. Panel de Chat (Sidebar / Drawer)
**Componente:** `ChatInterface.tsx`

*   **Ubicación (Z-Index: 40):** Aineado a la izquierda (`left-0`, `top-0`).
*   **Comportamiento Móvil (< 768px):**
    *   Actúa como un **Drawer Off-Canvas** (Menú lateral deslizable).
    *   Estado Cerrado: Desplazado completamente fuera de la pantalla a la izquierda (`-translate-x-full`).
    *   Estado Abierto: Se desliza sobre el contenido principal cubriendo el 90% del ancho (`90vw`).
    *   Posee un botón de cierre interno visible solo en móvil.
*   **Comportamiento Escritorio (>= 768px):**
    *   Actúa como un **Sidebar Fijo**.
    *   Ancho fijo de `450px`.
    *   Estado Abierto: Empuja el contenido principal (Avatar View) hacia la derecha mediante margen (`ml-[450px]`).
    *   Estado Cerrado: Se oculta a la izquierda y el margen del contenido principal se elimina.

### 2.2. Viewport Visual (Avatar Core)
**Componente:** `AvatarView.tsx`

*   **Ubicación (Z-Index: 10-20):** 
    *   Ocupa el espacio restante (`flex-1`) del contenedor principal.
    *   En móvil, ocupa el 100% del fondo, situándose *detrás* del Chat y la Barra de Control.
*   **Disposición Interna:**
    *   Contenedor relativo centrado (`flex center-center`).
    *   **Capas de Prioridad:**
        1.  **Feed de Cámara:** `video` element (Absolute, full cover).
        2.  **Screen Share:** Contenedor `video` centrado con `object-fit: contain`.
        3.  **Avatar Personalizado:** `video` element centrado.
        4.  **Visualizador IA (Orbe):** Elemento por defecto si no hay video activo.
*   **Barra de Estado Superior:**
    *   Elemento flotante (`absolute top-0`) anclado a la derecha en escritorio y centrado/justificado en móvil.
    *   Muestra el estado del sistema y versión. `pointer-events-none` para no bloquear clics.

### 2.3. Barra de Control (Control Deck)
**Componente:** `ControlBar.tsx`

*   **Ubicación (Z-Index: 50):** Posicionamiento absoluto, anclado en la parte inferior central (`bottom-4`, `left-1/2`, `translate-x-1/2`).
*   **Ancho:** 
    *   Móvil: 96% del ancho de pantalla.
    *   Escritorio: 90% del ancho (max 5xl).

#### Arquitectura de Distribución (Layout):

**A. Versión Móvil:**
Se divide en dos áreas físicas para optimizar el espacio vertical y horizontal del input.
1.  **Área Satelital (Botones Flotantes - FABs):**
    *   Ubicación: 16px *arriba* de la barra principal.
    *   Elementos: Botones circulares para "Cámara", "Compartir Pantalla" y "Subir Archivo".
    *   Justificación: Centro.
2.  **Barra Principal (Dock):**
    *   Contiene: Botón Toggle Chat (Izq), Input de Texto (Centro), Botón Voz (Der), Botón Terminal (Der), Botón Enviar (Der), Botón Configuración (Der).
    *   El input se expande (`flex-1`) ocupando todo el espacio disponible.

**B. Versión Escritorio:**
Todos los elementos se integran en una única barra unificada ("Deck").
1.  **Bloque Izquierdo (Herramientas):** Toggle Chat, Cámara, Screen Share, Upload. Separados por divisor vertical.
2.  **Bloque Central (Input):** Campo de texto expandible.
3.  **Bloque Derecho (Acciones):** Voz, Terminal, Configuración, Enviar.

### 2.4. Panel de Terminal (HUD Console)
**Componente:** `TerminalPanel.tsx`

*   **Ubicación (Z-Index: 30):** Posicionamiento fijo, esquina inferior derecha (`bottom-24`, `right-4/8`).
*   **Comportamiento:**
    *   Elemento colapsable verticalmente.
    *   No afecta el flujo del documento (Overlay).
    *   Contiene scroll interno independiente (`overflow-y-auto`).

## 3. Sistemas de Superposición (Modales)

### 3.1. Modal de Configuración
**Componente:** `SettingsModal.tsx`

*   **Tipo:** Full Screen Overlay (`fixed inset-0`, Z-Index: 60).
*   **Estructura Interna:**
    *   Contenedor central con dimensiones máximas definidas.
    *   **Header:** Título y Pestañas de Navegación (Configuración, Identidades, Historial).
    *   **Body:** Área scrollable (`overflow-y-auto`) con los controles de formulario.
    *   **Footer:** Botón de cierre/acción anclado al fondo del contenedor.

### 3.2. Visualizador de Archivos
**Componente:** `FileViewer.tsx`

*   **Tipo:** Full Screen Overlay (Z-Index: 100 - Máxima prioridad).
*   **Estructura:**
    *   **Header Superior:** Barra fija con título de archivo y botón de cierre.
    *   **Canvas Central:** Área flexible que centra el contenido (Imagen, PDF, Iframe, Texto Raw) ocupando el máximo espacio disponible sin desbordar.

## 4. Jerarquía del Eje Z (Layering)

Para asegurar la correcta interactividad, la aplicación sigue esta estricta jerarquía de apilamiento:

1.  **Nivel 0:** Fondo (Ambiente, Gradientes).
2.  **Nivel 10:** Contenido Principal (Cámara, Avatar Video).
3.  **Nivel 20:** Visualizador IA (Orbe) y Overlays de Estado del Avatar.
4.  **Nivel 30:** HUDs Informativos (Barra superior de estado, Panel de Terminal).
5.  **Nivel 40:** Interfaz de Chat (Sidebar).
6.  **Nivel 50:** Barra de Control (Inputs y Botones).
7.  **Nivel 60:** Modales de Sistema (Configuración).
8.  **Nivel 100:** Visualizador de Archivos (Debe cubrir todo).

## 5. Resumen de Adaptabilidad (Responsive Strategy)

| Elemento | Móvil (Portrait) | Escritorio (Landscape) |
| :--- | :--- | :--- |
| **Chat** | Overlay (Cubre contenido) | Push (Empuja contenido) |
| **Herramientas (Cám/Screen)** | Botones Flotantes (Arriba del input) | Integrados en Barra (Izquierda del input) |
| **Avatar** | Fondo completo (Detrás del UI) | Espacio flexible (Lado derecho) |
| **Terminal** | Oculta por defecto (Toggle manual) | Oculta por defecto (Toggle manual) |
| **Settings** | Full Screen | Modal Centrado |

