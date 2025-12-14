# Especificación de Componente: Quantum Laser Input

Este documento detalla la implementación técnica del campo de entrada de texto principal ("Input Universo") utilizado en la barra de control de PROBOTICS. Este componente se caracteriza por un borde de "láser" rotativo y un estilo interior con profundidad.

## 1. Concepto Visual

El componente consta de tres capas en el eje Z:
1.  **Contenedor (Wrapper):** Define la forma (border-radius) y oculta el desbordamiento (`overflow: hidden`).
2.  **Capa de Animación (Pseudo-element ::before):** Un gradiente cónico (`conic-gradient`) que es 2 veces más grande que el contenedor y rota infinitamente. Esto crea el efecto de "haz de luz" moviéndose por el borde.
3.  **Input Frontal (Textarea):** Se superpone a la animación. Tiene un margen interno (padding) simulado o un fondo opaco para tapar el centro de la animación, dejando ver solo los bordes.

---

## 2. Estructura DOM (React/JSX)

El componente debe envolverse en un `div` con la clase `laser-input-wrapper`. El input (o textarea) interno lleva la clase `input-universe`.

```tsx
<div className="relative laser-input-wrapper w-full">
  <textarea
    className="input-universe w-full h-12 py-3 px-4 resize-none overflow-hidden"
    placeholder="Escribe tu mensaje..."
    style={{ lineHeight: '1.5' }}
  />
</div>
```

---

## 3. Implementación CSS

Agrega los siguientes estilos a tu hoja de estilos global o módulo CSS.

### A. Paleta de Colores Requerida
*   **Fondo Oscuro:** `#050a14`
*   **Luz Neón (Púrpura):** `#bc13fe`
*   **Sombra Interior:** `#020408` y `#0a1428`

### B. El Contenedor y el Borde Animado

La magia ocurre en `::before`. Usamos un `conic-gradient` con secciones transparentes para simular el "haz" de luz.

```css
/* Contenedor Principal: Define la forma y recorta la animación */
.laser-input-wrapper {
  position: relative;
  border-radius: 20px; /* Radio externo */
  padding: 2px;        /* Grosor del borde láser */
  background: #050a14;
  overflow: hidden;    /* Importante: oculta el gradiente excedente */
  box-shadow: 0 0 15px rgba(188, 19, 254, 0.2); /* Glow externo suave */
}

/* El Haz de Luz Rotativo */
.laser-input-wrapper::before {
  content: '';
  position: absolute;
  /* Centrado y sobredimensionado para cubrir la rotación rectangular */
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  
  /* El patrón del láser */
  background: conic-gradient(
    transparent 0deg, 
    transparent 60deg,
    #bc13fe 100deg,     /* Color del haz principal */
    transparent 140deg,
    transparent 180deg,
    transparent 240deg,
    #bc13fe 280deg,     /* Segundo haz (opcional para simetría) */
    transparent 320deg
  );
  
  /* Animación de rotación */
  animation: rotate-border 4s linear infinite;
  z-index: 0;
}

/* Animación Keyframes */
@keyframes rotate-border {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

### C. El Input Interno ("Input Universo")

Este elemento se coloca ENCIMA de la animación (`z-index: 1`). Su fondo debe coincidir con el fondo de la aplicación para crear la ilusión de que solo el borde brilla.

```css
.input-universe {
  position: relative;
  z-index: 1; /* Debe estar por encima del ::before del wrapper */
  
  /* Reset de estilos básicos */
  border: none;
  outline: none;
  width: 100%;
  height: 100%;
  
  /* Estilizado Visual */
  border-radius: 18px; /* Radio interno (ligeramente menor al wrapper) */
  background: #050a14; /* Mismo color que el fondo global */
  color: white;
  font-family: 'JetBrains Mono', monospace; /* O tu fuente mono preferida */
  letter-spacing: 0.05em;
  
  /* Efecto de Profundidad (Neumorfismo Cyberpunk) */
  box-shadow: inset 4px 4px 10px #020408,
              inset -4px -4px 10px #0a1428;
              
  transition: 0.3s ease;
}

/* Estado Focus: Resplandor interior */
.input-universe:focus {
  background: #0a1428; /* Ligeramente más claro */
  box-shadow: inset 0 0 15px rgba(188, 19, 254, 0.1);
}

.input-universe::placeholder {
  color: #4b5563;
}
```

## 4. Comportamiento y Variaciones

1.  **Grosor del Borde:** Para cambiar el grosor del láser, ajusta el `padding` de `.laser-input-wrapper`. Actualmente es `2px`.
2.  **Velocidad:** Ajusta los segundos en `animation: rotate-border 4s linear infinite`. Menos tiempo = más rápido.
3.  **Color:** Cambia los valores hex `#bc13fe` en el `conic-gradient` para cambiar el color del láser (ej. a Cyan `#00f3ff`).
