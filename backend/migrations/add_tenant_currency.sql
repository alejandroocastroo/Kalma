-- Agrega el campo de moneda al tenant (COP por defecto para compatibilidad)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'COP';
