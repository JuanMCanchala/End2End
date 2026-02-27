-- Tabla para guardar leads esperando seleccionar empresa
CREATE TABLE pending_selections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone TEXT NOT NULL UNIQUE,
  profile_name TEXT,
  options JSONB NOT NULL DEFAULT '[]', -- [{index: 1, business_id: '...', name: '...'}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service role access
CREATE POLICY "Service role full access pending_selections" ON pending_selections FOR ALL TO service_role USING (true);
ALTER TABLE pending_selections ENABLE ROW LEVEL SECURITY;
