# 🤖 AGENTS.md — Instrucciones para Agentes IA

> **LEE ESTE ARCHIVO PRIMERO** antes de ejecutar cualquier comando o modificar código en este proyecto.

---

## Sistema Operativo del Proyecto

```
OS:    Windows 10/11
Shell: PowerShell (no Bash, no Zsh)
User:  C:\Users\Ferna
```

Este proyecto **se desarrolla y despliega desde una máquina Windows**.  
Los contenedores Docker corren Linux internamente, pero **todos los comandos del host** deben escribirse en sintaxis **PowerShell**.

---

## Reglas Obligatorias

### 1. Nunca usar sintaxis Bash en comandos del host

| ❌ No usar | ✅ Usar en su lugar |
|-----------|-------------------|
| `cmd1 && cmd2` | Dos comandos separados, o `cmd1; cmd2` |
| `grep "texto" archivo` | `Select-String -Path archivo -Pattern "texto"` |
| `head -n 20 archivo` | `Get-Content archivo \| Select-Object -First 20` |
| `find . -name "*.ts"` | `Get-ChildItem -Recurse -Filter "*.ts"` |
| `cat archivo` | `Get-Content archivo` |
| `export VAR=valor` | `$env:VAR = "valor"` |

→ Guía completa: [`docs/SHELL_GUIDE.md`](./docs/SHELL_GUIDE.md)

### 2. BypassSandbox obligatorio para estas herramientas

Siempre usar `BypassSandbox: true` cuando el comando involucre:

- `pnpm`, `npm`, `npx` — el PATH global no está en el sandbox
- `git push`, `git pull`, `git fetch` — requieren internet
- `docker restart`, `docker pull`, `docker-compose` — acceso al daemon del sistema

### 3. Comandos locales NO requieren bypass

- `git add`, `git commit`, `git checkout`, `git status`, `git log`
- `tsc --noEmit` si se invoca via `pnpm run typecheck` con bypass
- Lectura de archivos, `Get-Content`, `Select-String`

---

## Stack Tecnológico

| Componente | Tecnología | Versión |
|------------|-----------|---------|
| Runtime | Node.js | 20+ |
| Package Manager | **pnpm** (no npm, no yarn) | 9.x |
| Lenguaje | TypeScript | 5.x |
| Framework Discord | discord.js | 14.x |
| Audio | Shoukaku + Lavalink | 4.x |
| Contenedores | Docker + Docker Compose | - |
| Rama activa | `rankine` | - |

---

## Estructura del Proyecto

```
discord-music-bot/
├── AGENTS.md                   ← Este archivo (leer primero)
├── docs/
│   └── SHELL_GUIDE.md          ← Guía de comandos Windows/PowerShell
├── bot/                        ← Código TypeScript del bot (Clean Architecture)
│   └── src/
│       ├── domain/             ← Entidades y puertos (sin dependencias externas)
│       ├── application/        ← Use cases
│       ├── infrastructure/     ← Adaptadores (Lavalink, estado en memoria)
│       └── presentation/       ← Comandos Discord, embeds, eventos
├── lavalink/
│   └── application.yml         ← Config del servidor de audio Lavalink
├── docker-compose.yml
└── .env                        ← Variables de entorno (NO commitear)
```

---

## Comandos Frecuentes del Proyecto

```powershell
# Verificar tipos (sin errores TS)
pnpm run typecheck          # BypassSandbox: true

# Ver logs del bot
docker logs discord-music-bot --tail 40    # BypassSandbox: true

# Ver logs de Lavalink
docker logs lavalink-server --tail 40      # BypassSandbox: true

# Reiniciar el stack
docker restart discord-music-bot           # BypassSandbox: true

# Git workflow (rama rankine)
git add .
git commit -m "tipo: descripcion"
git push origin rankine                    # BypassSandbox: true
```
