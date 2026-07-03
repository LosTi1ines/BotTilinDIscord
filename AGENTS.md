# 🤖 AGENTS.md — Instrucciones y Cuestionario para Agentes IA

> 🚨 **INSTRUCCIÓN OBLIGATORIA:** Si eres un agente IA, **debes leer este archivo completo** y realizar el **cuestionario inicial** de la sección 1 al usuario antes de ejecutar cualquier comando de terminal o modificar código.

---

## 1. 📋 Cuestionario Inicial Obligatorio (Debes preguntar esto al usuario)

Antes de cualquier acción de escritura o ejecución de comandos, debes presentar y solicitar respuesta a las siguientes preguntas en tu primer mensaje:

1. **Entorno de Trabajo Actual:** ¿En qué sistema operativo y terminal estás ejecutando al agente en este momento? (Por ejemplo: *Windows con PowerShell* o *Linux/macOS con Bash/Zsh*).
2. **Ambiente de Ejecución:** ¿Las pruebas y comandos se ejecutarán directamente en el Host o mediante comandos dentro de Docker (`docker exec`)?
3. **Credenciales de YouTube OAuth:** ¿Deseas usar las credenciales de YouTube OAuth existentes en el `.env` o necesitas que configuremos/autoricemos un nuevo token?
4. **Git Branch & Push:** ¿Confirmas que los commits deben realizarse en la rama activa (`rankine` o la que indique el usuario) y si tengo permiso para hacer `git push` tras finalizar?

---

## 2. 👥 Proyecto Colaborativo Multiplataforma

Este es un proyecto colaborativo donde los desarrolladores trabajan en diferentes entornos:
- **Usuario Principal:** Trabaja en **Windows (PowerShell)**.
- **Colaboradores:** Trabajan en **Linux/macOS (Bash/Zsh)**.

Por lo tanto:
- **No asumas que el host es Windows.** Siempre valida con el cuestionario inicial.
- **No asumas que el host es Linux.** Traduce tus comandos según la terminal que te indique el usuario.
- **Mantén la compatibilidad:** Toda la configuración, scripts de Node.js y flujos en Docker Compose deben ser 100% multiplataforma.

---

## 3. 🛠️ Reglas Técnicas y Sandbox

### A. Dependencia del Sandbox
Si el comando requiere herramientas instaladas en el sistema global del host (como `pnpm`, `npm`, `npx` o `docker`), o conexiones de red (como `git push`/`pull` o `docker pull`):
- **Debes usar `BypassSandbox: true`**. El sandbox interno no tiene acceso al PATH global en Windows ni a la red externa.

### B. Comandos Locales (Sin Bypass)
Operaciones puramente locales de git (como `git status`, `git diff`, `git add`) o lecturas de archivos del proyecto se pueden ejecutar con `BypassSandbox: false`.

---

## 4. 📚 Documentación de Referencia

- **Guía de Equivalencia de Consola:** Consulta [`docs/SHELL_GUIDE.md`](./docs/SHELL_GUIDE.md) para traducir comandos rápidamente entre Bash y PowerShell.
- **Guía de Pruebas de Audio:** Consulta [`docs/TESTING.md`](./docs/TESTING.md) para saber cómo probar las mejoras de reproducción, autocompletado, embeds y reconexión.

---

## 💻 Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Runtime | Node.js | 20+ |
| Package Manager | **pnpm** (obligatorio) | 9.x |
| Lenguaje | TypeScript | 5.x |
| Framework Discord | discord.js | 14.x |
| Audio | Shoukaku + Lavalink | 4.x |
| Contenedores | Docker + Docker Compose | - |
