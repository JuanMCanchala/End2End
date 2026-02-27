-- Calendly integration: add credentials and event URI to appointments

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS calendly_access_token TEXT,
  ADD COLUMN IF NOT EXISTS calendly_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS calendly_user_uri TEXT,
  ADD COLUMN IF NOT EXISTS calendly_org_uri TEXT,
  ADD COLUMN IF NOT EXISTS calendly_token_expires_at TIMESTAMPTZ;

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS calendly_event_uri TEXT,
  ADD COLUMN IF NOT EXISTS calendly_invitee_uri TEXT;

CREATE INDEX IF NOT EXISTS idx_appointments_calendly_uri ON appointments(calendly_event_uri) WHERE calendly_event_uri IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_calendly_user ON businesses(calendly_user_uri) WHERE calendly_user_uri IS NOT NULL;
