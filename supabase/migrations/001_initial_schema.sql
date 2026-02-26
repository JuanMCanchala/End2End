-- End2End - Initial Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- BUSINESSES
-- =====================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  products JSONB DEFAULT '[]',
  qualification_questions JSONB DEFAULT '[]',
  tone TEXT DEFAULT 'profesional',
  working_hours JSONB DEFAULT '{"start": "08:00", "end": "18:00", "days": [1,2,3,4,5]}',
  whatsapp_number TEXT,
  setup_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- LEADS
-- =====================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'qualifying', 'qualified', 'proposal_sent', 'meeting_scheduled', 'won', 'lost')),
  temperature TEXT DEFAULT 'cold' CHECK (temperature IN ('hot', 'warm', 'cold')),
  score INTEGER DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  qualification_data JSONB DEFAULT '{}',
  notes TEXT,
  last_interaction TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- CONVERSATIONS
-- =====================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'human_takeover', 'paused', 'closed')),
  channel TEXT DEFAULT 'whatsapp',
  twilio_conversation_sid TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- MESSAGES
-- =====================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('lead', 'agent', 'human')),
  agent_type TEXT CHECK (agent_type IN ('orchestrator', 'qualifier', 'followup', 'proposal', 'scheduler', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- AGENT ACTIONS (Transparency Log)
-- =====================
CREATE TABLE agent_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  agent_type TEXT NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT NOT NULL,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- FOLLOWUPS
-- =====================
CREATE TABLE followups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- PROPOSALS
-- =====================
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  items JSONB DEFAULT '[]',
  total_amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'COP',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- APPOINTMENTS
-- =====================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  location TEXT,
  meeting_link TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- SETUP CONVERSATIONS
-- =====================
CREATE TABLE setup_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',
  setup_step TEXT DEFAULT 'name',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================
CREATE INDEX idx_leads_business ON leads(business_id);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_conversations_business ON conversations(business_id);
CREATE INDEX idx_conversations_lead ON conversations(lead_id);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_agent_actions_business ON agent_actions(business_id);
CREATE INDEX idx_followups_business ON followups(business_id);
CREATE INDEX idx_followups_scheduled ON followups(scheduled_at) WHERE status = 'pending';

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own business data
CREATE POLICY "Users own businesses" ON businesses FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Business members see leads" ON leads FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Business members see conversations" ON conversations FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Business members see messages" ON messages FOR ALL
  USING (conversation_id IN (
    SELECT id FROM conversations WHERE business_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Business members see agent_actions" ON agent_actions FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Business members see followups" ON followups FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Business members see proposals" ON proposals FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Business members see appointments" ON appointments FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid()));

CREATE POLICY "Users own setup conversations" ON setup_conversations FOR ALL
  USING (user_id = auth.uid());

-- Service role bypass for webhooks (agents need to write without user context)
CREATE POLICY "Service role full access leads" ON leads FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access conversations" ON conversations FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access messages" ON messages FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access agent_actions" ON agent_actions FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access followups" ON followups FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access proposals" ON proposals FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access appointments" ON appointments FOR ALL TO service_role USING (true);
CREATE POLICY "Service role full access businesses" ON businesses FOR ALL TO service_role USING (true);

-- =====================
-- REALTIME
-- =====================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_actions;
