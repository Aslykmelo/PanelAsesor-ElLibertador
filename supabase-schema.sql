-- SQL Query to set up the restructured historical tracking table in Supabase.
-- Run this script directly in the Supabase SQL Editor.

-- Table for detailed movements
CREATE TABLE IF NOT EXISTS recaudo_movimientos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud TEXT,
  estado_recibo TEXT,
  funcionario TEXT,
  fecha_pago DATE,
  valor_liquidacion NUMERIC,
  valor_link_crm NUMERIC,
  cliente TEXT,
  emisor TEXT,
  responsable TEXT,
  supervisor TEXT,
  cartera TEXT,
  archivo_origen TEXT,
  fecha_importacion TIMESTAMP DEFAULT NOW(),
  usuario_importacion TEXT,
  hash_movimiento TEXT UNIQUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recaudo_movimientos_hash ON recaudo_movimientos(hash_movimiento);

-- Table for total historical traceability (based on CRM registration id)
CREATE TABLE IF NOT EXISTS recaudo_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_registro_crm TEXT UNIQUE NOT NULL,
  solicitud TEXT,
  cliente TEXT,
  estado_recibo TEXT,
  valor_link_crm NUMERIC,
  valor_liquidacion NUMERIC,
  funcionario TEXT,
  fecha_generacion_link TEXT,
  fecha_vencimiento_link TEXT,
  fecha_pago TEXT,
  fecha_importacion TIMESTAMP DEFAULT NOW(),
  archivo_origen TEXT,
  usuario_importacion TEXT,
  tipo_recaudo TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recaudo_historico_crm_id ON recaudo_historico(id_registro_crm);

-- Enable RLS (Row Level Security)
ALTER TABLE recaudo_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE recaudo_historico ENABLE ROW LEVEL SECURITY;

-- Create open policies for read-write access
CREATE POLICY "Allow public read-write access to recaudo_movimientos" 
ON recaudo_movimientos FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow public read-write access to recaudo_historico" 
ON recaudo_historico FOR ALL USING (true) WITH CHECK (true);
