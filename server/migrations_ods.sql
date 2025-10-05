-- Migración incremental ODS mejoras B-E
-- Crear tabla de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  accion VARCHAR(50) NOT NULL,
  recurso VARCHAR(50) NULL,
  recurso_id INT NULL,
  ip VARCHAR(64) NULL,
  meta JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_accion (accion),
  INDEX idx_recurso (recurso),
  INDEX idx_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES usuario(ID_Usuario) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Extender tabla informe para campos IA y validación si no existen
ALTER TABLE informe ADD COLUMN IF NOT EXISTS IA_Confianza DECIMAL(5,2) NULL;
ALTER TABLE informe ADD COLUMN IF NOT EXISTS Modelo_Version VARCHAR(40) NULL;
ALTER TABLE informe ADD COLUMN IF NOT EXISTS Validado TINYINT(1) DEFAULT 0;

-- Nota: mover físicamente uploads a carpeta server/uploads manualmente si se desea mayor aislamiento.
-- Las imágenes existentes en client/uploads seguirán funcionando por compatibilidad.
