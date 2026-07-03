# 💻 Guía de Equivalencia de Consola — Bash vs. PowerShell

> **Propósito:** Facilitar la traducción de comandos entre entornos **Linux/macOS (Bash/Zsh)** y **Windows (PowerShell)** para todos los desarrolladores y agentes IA que trabajen en este proyecto.

---

## 1. Tabla de Equivalencias Rápidas

| Operación | Unix (Bash/Zsh) 🐧🍏 | Windows (PowerShell) 🪟 |
|-----------|--------------------|-----------------------|
| **Encadenar comandos (AND)** | `cmd1 && cmd2` | `cmd1; cmd2` *(o líneas separadas)* |
| **Redirigir stderr a stdout** | `cmd 2>&1` | `cmd 2>&1` *(evitar con `;`)* |
| **Buscar texto en archivo** | `grep "texto" archivo` | `Select-String -Path archivo -Pattern "texto"` |
| **Buscar texto recursivamente** | `grep -r "texto" src/` | `Select-String -Path "src/**" -Pattern "texto" -Recurse` |
| **Ver primeras N líneas** | `head -n 20 archivo` | `Get-Content archivo \| Select-Object -First 20` |
| **Ver últimas N líneas** | `tail -n 20 archivo` | `Get-Content archivo \| Select-Object -Last 20` |
| **Ver contenido de archivo** | `cat archivo.txt` | `Get-Content archivo.txt` |
| **Listar archivos recursivo** | `find . -name "*.ts"` | `Get-ChildItem -Recurse -Filter "*.ts"` |
| **Copiar archivo** | `cp origen destino` | `Copy-Item origen destino` |
| **Mover/Renombrar archivo** | `mv origen destino` | `Move-Item origen destino` |
| **Eliminar archivo** | `rm archivo` | `Remove-Item archivo` |
| **Crear directorio** | `mkdir -p dir/sub` | `New-Item -ItemType Directory -Force -Path dir/sub` |
| **Definir Variable de Entorno** | `export VAR=valor` | `$env:VAR = "valor"` |
| **Leer Variable de Entorno** | `echo $VAR` | `$env:VAR` |
| **Verificar si comando existe** | `which pnpm` | `Get-Command pnpm -ErrorAction SilentlyContinue` |

---

## 2. El problema del operador `&&` en Windows

En sistemas Windows con PowerShell 5.x (el predeterminado en muchas instalaciones), el operador `&&` no es un separador válido y causará un error de sintaxis en el parser.

**Solución cross-platform:**
- Si escribes comandos para que los ejecute un agente o un script, **escribe líneas separadas** en lugar de encadenar con `&&`.
- En PowerShell, usa `;` para separar instrucciones en una misma línea.

---

## 3. Compatibilidad con el Sandbox de Agentes IA

Cuando utilices herramientas como `run_command` en el Host:
- Los package managers (`pnpm`, `npm`, `npx`) y Docker (`docker`, `docker-compose`) a menudo requieren `BypassSandbox: true` porque el sandbox no hereda el PATH global del sistema ni el acceso a red local/externa.
- Los comandos locales simples de Git (`git status`, `git add`, `git diff`) funcionan perfectamente con `BypassSandbox: false`.

---

## 4. Comandos de Docker Cross-Platform

Los comandos de Docker interactúan con el daemon de Docker y son idénticos en ambos sistemas operativos:

```bash
# Ver logs del bot
docker logs discord-music-bot --tail 50

# Ver logs de Lavalink
docker logs lavalink-server --tail 50

# Reiniciar el contenedor del bot
docker restart discord-music-bot
```

*Última actualización: 2026-07-02 — Rama `rankine`*
