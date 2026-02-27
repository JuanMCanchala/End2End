-- Agregar 'purchase' como agent_type válido en mensajes y acciones
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_agent_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_agent_type_check
  CHECK (agent_type IN ('orchestrator', 'qualifier', 'followup', 'proposal', 'scheduler', 'system', 'purchase'));
