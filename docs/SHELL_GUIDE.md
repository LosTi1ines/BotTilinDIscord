# 🪟 Guía de Shell — Windows PowerShell

> Este proyecto se desarrolla en **Windows con PowerShell**.  
> Consultar esta guía antes de ejecutar cualquier comando de terminal.

---

## ¿Por qué existe esta guía?

La mayoría del ecosistema Node.js/Docker asume entornos Linux/macOS.  
Los agentes IA y documentación online usan sintaxis Bash por defecto.  
En Windows con PowerShell, muchos de esos comandos **simplemente no existen o fallan silenciosamente**.

---

## Equivalencias rápidas: Bash → PowerShell

| Operación | Bash ❌ | PowerShell ✅ |
|-----------|--------|--------------|
| Encadenar comandos (AND) | `cmd1 && cmd2` | `cmd1; cmd2` *(o dos líneas separadas)* |
| Redirigir stderr | `cmd 2>&1` | `cmd 2>&1` *(no combinar con `&&`)* |
| Buscar texto en archivo | `grep -n "texto" archivo` | `Select-String -Path archivo -Pattern "texto"` |
| Buscar en carpetas | `grep -r "texto" src/` | `Select-String -Path "src/**" -Pattern "texto" -Recurse` |
| Primeras N líneas | `head -n 20 archivo` | `Get-Content archivo \| Select-Object -First 20` |
| Últimas N líneas | `tail -n 20 archivo` | `Get-Content archivo \| Select-Object -Last 20` |
| Ver contenido | `cat archivo.txt` | `Get-Content archivo.txt` |
| Listar archivos recursivo | `find . -name "*.ts"` | `Get-ChildItem -Recurse -Filter "*.ts"` |
| Copiar archivo | `cp origen destino` | `Copy-Item origen destino` |
| Mover/Renombrar | `mv origen destino` | `Move-Item origen destino` |
| Eliminar archivo | `rm archivo` | `Remove-Item archivo` |
| Crear directorio | `mkdir -p dir/sub` | `New-Item -ItemType Directory -Force -Path dir/sub` |
| Variable de entorno (set) | `export VAR=valor` | `$env:VAR = "valor"` |
| Variable de entorno (read) | `echo $VAR` | `$env:VAR` |
| Verificar si comando existe | `which pnpm` | `Get-Command pnpm -ErrorAction SilentlyContinue` |

---

## El problema del `&&`

PowerShell 5 (que viene por defecto en Windows 10/11) **no soporta `&&`**.  
PowerShell 7+ sí lo soporta, pero **nunca se debe asumir** que está disponible.

```powershell
# ❌ Falla en PS5
git add . && git commit -m "mensaje"

# ✅ Siempre funciona
git add .
git commit -m "mensaje"

# ✅ También funciona (punto y coma)
git add .; git commit -m "mensaje"
```

---

## El problema de `pnpm` en el sandbox

Cuando un agente IA ejecuta comandos en modo sandbox, el PATH del sistema está restringido.  
`pnpm` instalado globalmente (via Corepack o instalador) **no es visible** en ese entorno.

**Solución:** Siempre usar `BypassSandbox: true` para comandos de package managers.

### Requieren BypassSandbox ✅

```powershell
pnpm install
pnpm run typecheck
pnpm run build
npm run dev
git push origin rama
git pull
docker restart contenedor
docker logs contenedor
docker-compose up
```

### No requieren BypassSandbox ✅

```powershell
git add .
git commit -m "..."
git checkout -b rama
git status
git log -n 10
Get-Content archivo.ts
Select-String -Path "src/**" -Pattern "texto"
```

---

## Comandos útiles para este proyecto

```powershell
# ── Verificar TypeScript ──────────────────────────────────────
pnpm run typecheck
# (requiere BypassSandbox)

# ── Inspeccionar tipos de una librería ───────────────────────
Get-Content "node_modules\shoukaku\dist\index.d.ts" | Select-Object -First 100
Select-String -Path "node_modules\shoukaku\dist\index.d.ts" -Pattern "channelId"

# ── Buscar en el código fuente ────────────────────────────────
Select-String -Path "bot\src\**\*.ts" -Pattern "hasPlayer" -Recurse

# ── Git workflow ──────────────────────────────────────────────
git status
git add .
git commit -m "feat: descripcion del cambio"
git push origin rankine
# (el push requiere BypassSandbox)

# ── Docker ────────────────────────────────────────────────────
docker logs discord-music-bot --tail 40
docker logs lavalink-server --tail 40
docker restart discord-music-bot
# (todos requieren BypassSandbox)
```

---

## Checklist antes de ejecutar cualquier comando

```
[ ] ¿El comando usa &&?
    → Separar en dos comandos o reemplazar por ;

[ ] ¿Usa grep, head, tail, cat, find, sed, awk?
    → Traducir al equivalente de PowerShell

[ ] ¿Involucra pnpm, npm, npx, git push/pull, docker?
    → Usar BypassSandbox: true

[ ] ¿Usa rutas con / como separador en el host?
    → En PowerShell también funciona /, pero \ es más seguro para paths locales

[ ] ¿Combina 2>&1 con &&?
    → Separar el comando y quitar el &&
```

---

*Última actualización: 2026-07-02 — Rama `rankine`*
