import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { runAgentLoop } from '@/lib/agents/agent-loop'
import { SETUP_TOOLS } from '@/lib/agents/tools'
import { buildSetupPrompt } from '@/lib/utils/prompts'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message } = await req.json()

    // Get or create business
    let { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!business) {
      const { data: newBusiness } = await supabase
        .from('businesses')
        .insert({ user_id: user.id, name: 'Mi Negocio' })
        .select()
        .single()
      business = newBusiness
    }

    // Get or create setup conversation
    let { data: setupConv } = await supabase
      .from('setup_conversations')
      .select('*')
      .eq('business_id', business!.id)
      .eq('completed', false)
      .single()

    if (!setupConv) {
      const { data: newSetup } = await supabase
        .from('setup_conversations')
        .insert({
          business_id: business!.id,
          user_id: user.id,
          messages: [],
          setup_step: 'name',
        })
        .select()
        .single()
      setupConv = newSetup
    }

    const currentMessages = setupConv!.messages || []
    const currentStep = setupConv!.setup_step || 'name'

    // Build conversation history for Claude
    const history = currentMessages.slice(-10).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    let setupCompleted = false
    let savedField = ''
    let savedValue: unknown = null
    let nextStep = currentStep

    const toolHandlers = {
      save_setup_data: async (toolInput: Record<string, unknown>) => {
        const { field, value, next_step } = toolInput as { field: string; value: unknown; next_step: string }
        savedField = field
        savedValue = value
        nextStep = next_step

        await supabase
          .from('businesses')
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('id', business!.id)

        await supabase
          .from('setup_conversations')
          .update({ setup_step: next_step, updated_at: new Date().toISOString() })
          .eq('id', setupConv!.id)

        return { success: true, saved: field }
      },

      complete_setup: async (toolInput: Record<string, unknown>) => {
        setupCompleted = true
        const { summary_message } = toolInput as { summary_message: string }

        await supabase
          .from('businesses')
          .update({ setup_completed: true, updated_at: new Date().toISOString() })
          .eq('id', business!.id)

        await supabase
          .from('setup_conversations')
          .update({ completed: true, setup_step: 'complete', updated_at: new Date().toISOString() })
          .eq('id', setupConv!.id)

        return { success: true, summary: summary_message }
      },
    }

    const currentBusiness = {
      name: business!.name,
      description: business!.description,
      products: business!.products,
      tone: business!.tone,
      qualification_questions: business!.qualification_questions,
      working_hours: business!.working_hours,
    }

    const systemPrompt = buildSetupPrompt(currentBusiness, currentStep)

    const result = await runAgentLoop(
      systemPrompt,
      message,
      SETUP_TOOLS,
      toolHandlers,
      'system',
      history
    )

    // Save messages to setup conversation
    const updatedMessages = [
      ...currentMessages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: result.finalResponse, timestamp: new Date().toISOString() },
    ]

    await supabase
      .from('setup_conversations')
      .update({ messages: updatedMessages, updated_at: new Date().toISOString() })
      .eq('id', setupConv!.id)

    return NextResponse.json({
      response: result.finalResponse,
      setup_completed: setupCompleted,
      current_step: nextStep,
      saved_field: savedField || null,
    })
  } catch (error) {
    console.error('Setup chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!business) {
      return NextResponse.json({ messages: [], step: 'name', completed: false })
    }

    const { data: setupConv } = await supabase
      .from('setup_conversations')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      messages: setupConv?.messages || [],
      step: setupConv?.setup_step || 'name',
      completed: business.setup_completed || false,
      business,
    })
  } catch (error) {
    console.error('Setup GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
