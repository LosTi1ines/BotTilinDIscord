// ═══════════════════════════════════════════════════════════════
// src/index.ts (barrel export)
//
// Exporta los módulos principales de la aplicación.
// ═══════════════════════════════════════════════════════════════

// Configuración
export * from './config/index.js';

// Capa de Dominio (Entidades + Puertos)
export * from './domain/index.js';

// Las capas de Aplicación, Infraestructura y Presentación
// se cargarán según sea necesario en los siguientes pasos.
