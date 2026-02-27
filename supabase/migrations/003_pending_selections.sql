-- Tabla para gestionar la selección de empresa cuando hay múltiples negocios
-- Usada por los webhooks de Twilio y Telegram

CREATE TABLE IF NOT EXISTS pending_selections (
  phone TEXT PRIMARY KEY,
  profile_name TEXT,
  options JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE pending_selections ENABLE ROW LEVEL SECURITY;

-- Service role bypass (webhooks necesitan leer/escribir sin contexto de usuario)
CREATE POLICY "Service role full access pending_selections"
  ON pending_selections FOR ALL TO service_role USING (true);
