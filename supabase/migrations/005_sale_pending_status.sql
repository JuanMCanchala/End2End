-- Agregar estado 'sale_pending' (venta por verificar) a leads y conversations

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status IN ('new', 'qualifying', 'qualified', 'proposal_sent', 'meeting_scheduled', 'won', 'lost', 'sale_pending'));

ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('active', 'human_takeover', 'paused', 'closed', 'sale_pending'));
