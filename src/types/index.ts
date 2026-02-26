// End2End - TypeScript Types

export interface Business {
  id: string
  user_id: string
  name: string
  description: string | null
  products: Product[]
  qualification_questions: QualificationQuestion[]
  tone: string
  working_hours: WorkingHours
  whatsapp_number: string | null
  setup_completed: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  name: string
  description: string
  price?: number
  currency?: string
}

export interface QualificationQuestion {
  id: string
  question: string
  field: string
  weight: number // 0-10, how much this question affects the score
}

export interface WorkingHours {
  start: string // "08:00"
  end: string   // "18:00"
  days: number[] // 0=Sun, 1=Mon, ... 6=Sat
}

export interface Lead {
  id: string
  business_id: string
  name: string | null
  phone: string
  email: string | null
  status: LeadStatus
  temperature: LeadTemperature
  score: number
  qualification_data: Record<string, string>
  notes: string | null
  last_interaction: string
  created_at: string
  updated_at: string
}

export type LeadStatus = 'new' | 'qualifying' | 'qualified' | 'proposal_sent' | 'meeting_scheduled' | 'won' | 'lost'
export type LeadTemperature = 'hot' | 'warm' | 'cold'

export interface Conversation {
  id: string
  business_id: string
  lead_id: string
  status: ConversationStatus
  channel: string
  twilio_conversation_sid: string | null
  last_message_at: string
  created_at: string
  updated_at: string
  lead?: Lead
  messages?: Message[]
}

export type ConversationStatus = 'active' | 'human_takeover' | 'paused' | 'closed'

export interface Message {
  id: string
  conversation_id: string
  sender: MessageSender
  agent_type: AgentType | null
  content: string
  metadata: Record<string, unknown>
  created_at: string
}

export type MessageSender = 'lead' | 'agent' | 'human'
export type AgentType = 'orchestrator' | 'qualifier' | 'followup' | 'proposal' | 'scheduler' | 'system'

export interface AgentAction {
  id: string
  business_id: string
  conversation_id: string | null
  lead_id: string | null
  agent_type: AgentType
  action_type: string
  description: string
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  status: 'success' | 'failed' | 'pending'
  created_at: string
}

export interface Followup {
  id: string
  business_id: string
  lead_id: string
  conversation_id: string | null
  scheduled_at: string
  message: string
  status: 'pending' | 'sent' | 'failed' | 'cancelled'
  sent_at: string | null
  created_at: string
}

export interface Proposal {
  id: string
  business_id: string
  lead_id: string
  conversation_id: string | null
  title: string
  content: string
  items: ProposalItem[]
  total_amount: number | null
  currency: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected'
  sent_at: string | null
  created_at: string
}

export interface ProposalItem {
  name: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface Appointment {
  id: string
  business_id: string
  lead_id: string
  conversation_id: string | null
  title: string
  scheduled_at: string
  duration_minutes: number
  location: string | null
  meeting_link: string | null
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  notes: string | null
  created_at: string
}

export interface SetupConversation {
  id: string
  business_id: string
  user_id: string
  messages: SetupMessage[]
  setup_step: string
  completed: boolean
  created_at: string
  updated_at: string
}

export interface SetupMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

// Metrics
export interface DashboardMetrics {
  total_leads: number
  hot_leads: number
  warm_leads: number
  cold_leads: number
  active_conversations: number
  human_takeover_conversations: number
  proposals_sent: number
  appointments_scheduled: number
  conversion_rate: number
  avg_response_time_seconds: number
  messages_today: number
  leads_today: number
}

// Agent processing
export interface AgentInput {
  business: Business
  lead: Lead
  conversation: Conversation
  messages: Message[]
  incomingMessage: string
}

export interface AgentResult {
  response: string
  agentType: AgentType
  actionsExecuted: string[]
  shouldSendWhatsApp: boolean
}
