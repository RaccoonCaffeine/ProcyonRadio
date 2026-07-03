# 📡 ProcyonRadio

<p align="center">
  <img src="assets/logo_light.svg" alt="ProcyonRadio Logo" width="160" height="160" />
</p>

<h3 align="center">ProcyonRadio</h3>

<p align="center">
  <strong>Servidor de streaming de audio/video y panel de control reactivo diseñado especialmente para servidores de GTA V (FiveM).</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20+-green.svg?style=flat-square&logo=node.js" alt="Node.js version" />
  <img src="https://img.shields.io/badge/Docker-Supported-blue.svg?style=flat-square&logo=docker" alt="Docker Support" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Linux-lightgrey.svg?style=flat-square" alt="Platform Support" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License" />
</p>

---

## 📝 Descripción

**ProcyonRadio** es una solución autohospedada que te permite crear y transmitir tu propia señal de radio en vivo. Combina un potente backend de codificación continua con un panel de control web reactivo y moderno. Está optimizada para integrarse como radio en el juego dentro de **GTA V (FiveM)** o emitir transmisiones 24/7 en plataformas de streaming.

---

## 🚀 Características Principales

* **Transmisión Multi-Modo**:
  * **Modo YouTube (Video RTMP)**: Combina una imagen de fondo estática y audio continuo en un feed de video H.264 para transmitir directamente a YouTube Live sin interrupciones.
  * **Modo Icecast (Solo Audio)**: Codificación ligera en formatos MP3/AAC directa a servidores de radio online (ZenoMedia, Icecast, Shoutcast o Listen2MyRadio), reduciendo drásticamente el consumo de CPU.
* **Transiciones Sin Cortes (Zero-Gaps)**: Arquitectura de codificador persistente que nunca corta la conexión de red con el destino; los decodificadores PCM se alternan en segundo plano de forma invisible para el oyente.
* **Buscador Integrado y Respaldos**:
  * Agrega canciones pegando URLs directas de YouTube o playlists.
  * Realiza búsquedas por nombre de canción directamente desde el panel.
  * **SoundCloud Fallback**: Si un tema falla por derechos de autor o restricción geográfica en YouTube, el servidor busca y reproduce automáticamente un respaldo en SoundCloud.
* **Panel Web Reactivo e Inteligente**:
  * Diseñado con Vanilla JavaScript, delegación de eventos y estados reactivos mediante `Proxy`.
  * Diseño adaptativo premium (tonos oscuros e índigo) optimizado para pantallas táctiles y navegadores integrados en el juego (NUI de FiveM).
  * Soporte nativo para modo claro y oscuro, adaptando tanto el logotipo vectorial (inline SVG) como el favicon al instante.
* **Control de Accesos Basado en Roles (RBAC)**:
  * **Dueño (`owner`) / Admin (`admin`)**: Acceso a toda la configuración de transmisión y gestión de usuarios.
  * **Operador (`operator`)**: Gestión de lista de reproducción (añadir, borrar y ordenar temas con flechas manuales).
  * **Invitado (`guest`)**: Acceso de solo lectura al reproductor.
* **Túnel Cloudflare Automático**: Levanta un subdominio seguro (`HTTPS`) de forma automática y transparente sin necesidad de abrir puertos en tu router o lidiar con problemas de CGNAT.
* **Instalador Portable en Windows**: Un instalador moderno de un solo archivo ejecutable C# nativo que extrae todo lo necesario (servidor NodeJS compilado, `ffmpeg` y `yt-dlp`) y asocia los accesos directos con un icono transparente de alta definición.

---

## 📸 Capturas de Pantalla

| Vista de Escritorio (Relación de Aspecto 16:9 Adaptativo) | Vista Móvil (Relación de Aspecto 16:9) |
|:---:|:---:|
| ![Escritorio](assets/ProcyonRadio%20Desktop.png) | ![Móvil](assets/ProcyonRadio%20Mobil.png) |

---

## 🛠️ Instalación y Despliegue

### Opción A: Despliegue con Docker (Recomendado para Servidores)

Asegúrate de tener instalado [Docker](https://www.docker.com/) y [Docker Compose].

1. Clona este repositorio en tu servidor.
2. Configura las variables de entorno en el archivo `.env` en la raíz (usa como plantilla el archivo `.env` de ejemplo).
3. Inicia los contenedores en segundo plano:
   ```bash
   docker compose up --build -d livestream
   ```
4. El servidor estará escuchando en el puerto `3000`. Si tienes el túnel de Cloudflare activo (`EXPOSE_SERVER=true` en tu `.env`), verás el enlace seguro HTTPS en el log de la aplicación.

### Opción B: Instalador Portable (Recomendado para Windows Local)

1. Descarga el ejecutable `ProcyonRadio-Instalador.exe` desde la sección de lanzamientos (Releases) de tu repositorio.
2. Ejecuta el instalador e indica la ruta de destino (por defecto en tu perfil de usuario para no requerir permisos de administrador).
3. Selecciona si deseas accesos directos en el Escritorio y el Menú Inicio.
4. El instalador extraerá de forma standalone todo el servidor junto con los binarios de `ffmpeg` y `yt-dlp` y creará los accesos con el icono oficial de la app.

---

## 📂 Estructura del Repositorio

```
ProcyonRadio/
├── assets/              # Logo oficial e imágenes del proyecto
├── backend/
│   ├── src/             # Código fuente TypeScript (Express, Workers, RBAC)
│   ├── public/          # Assets estáticos de la Web App (HTML, CSS, JS modular, SVGs)
│   ├── installer/       # Código C# del Instalador portable y scripts de WiX
│   └── package.json     # Dependencias de Node.js
├── data/                # Carpeta local para imágenes y base de datos (excluida de git)
├── Dockerfile           # Receta de construcción de la imagen Docker
├── docker-compose.yml   # Orquestación de servicios (livestream + sidecar de firmas)
├── .gitignore           # Archivos ignorados por Git (binarios, datos, .env)
└── README.md            # Presentación del proyecto
```

---

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Si encuentras un error o deseas proponer una mejora, abre un **Issue** o envía un **Pull Request**.

---

## 📄 Licencia

**Todos los derechos reservados.**

Este proyecto es de desarrollo privado y propiedad de RaccoonCaffeine. No esta permitida su distribucion, modificacion o uso sin autorizacion explicita.
