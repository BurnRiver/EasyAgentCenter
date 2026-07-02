# EasyAgentCenter

[English](README.md) | [简体中文](README.zh-CN.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Español](README.es.md)

EasyAgentCenter es un administrador ligero y rápido para herramientas CLI Agent en Windows. Permite iniciar y gestionar Codex CLI, Kimi Code, Claude Code, Hermes y otros Agent populares desde un solo lugar, además de cualquier herramienta o comando personalizado que el usuario pueda ejecutar.

Está pensado para personas que usan varios agentes de programación al mismo tiempo: puedes ver sesiones por proyecto o por Agent, conversar directamente en el terminal integrado, iniciar rápidamente un directorio de proyecto y recibir notificaciones de escritorio cuando una sesión termina o falla. EasyAgentCenter no incluye API Key y no sube tus datos de sesión. Cada Agent sigue usando su propio estado de inicio de sesión y configuración local.

## Capturas

<p>
  <img src="docs/images/easyagentcenter-light-preview.png" alt="EasyAgentCenter light theme preview" width="49%">
  <img src="docs/images/easyagentcenter-dark-preview.png" alt="EasyAgentCenter dark terminal preview" width="49%">
</p>

## Funciones

- Detecta automáticamente los CLI Agent instalados en PATH.
- Permite agregar carpetas de proyecto e iniciar Agent rápidamente dentro del proyecto elegido.
- Gestiona sesiones por proyecto o por Agent.
- Detiene, elimina, elimina en lote, reordena y restaura registros de sesión.
- Incluye un terminal PTY integrado para conversar directamente con los Agent.
- Permite personalizar el color de fondo del terminal.
- Panel opcional de cuota de Codex CLI para la salida de `/status` y `/usage`.
- Ayuda con comandos de instalación/actualización para Agent conocidos.
- Notificaciones de escritorio opcionales cuando una sesión termina o falla.
- Idiomas de la interfaz: inglés, chino simplificado, ruso, japonés, coreano y español.

## Privacidad

EasyAgentCenter guarda los metadatos de sesión y los registros de sesión localmente en tu computadora. La app no sube tus datos de sesión y no incluye API Key. Los CLI Agent individuales pueden usar su propio estado de inicio de sesión, variables de entorno o configuración local.

Si ejecutas el proyecto desde el código fuente, las carpetas generadas `data/` y `logs/` son solo para desarrollo local. Git las ignora y no deben enviarse al repositorio.

## Inicio rápido

### Ejecutar en desarrollo

```bash
npm ci
npm run dev
```

### Lanzador de desarrollo con un clic

Haz doble clic:

```text
start-easy-agent-center.bat
```

Para iniciar sin una ventana visible de Command Prompt:

```text
start-easy-agent-center-hidden.vbs
```

El lanzador oculto inicia `npm run dev` en segundo plano. Para depurar problemas de inicio, es mejor usar el archivo `.bat` visible.

### Empaquetar

```bash
npm run dist:dir
```

Después abre la app desempaquetada desde:

```text
dist\win-unpacked\easy-agent-center.exe
```

Exe portable:

```bash
npm run dist
```

## Requisitos

- Node.js 24.14.0, ver `.nvmrc` / `.node-version`
- Windows es la plataforma principal

## Licencia

[MIT](LICENSE)
