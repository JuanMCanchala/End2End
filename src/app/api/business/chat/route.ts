import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, CLAUDE_MODEL } from '@/lib/claude/client'
import { Business } from '@/types'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const UPDATE_BUSINESS_TOOL: Anthropic.Tool = {
  name: 'update_business',
  description:
    'Actualiza la configuración del negocio. Llama esta herramienta cuando el usuario pida modificar cualquier dato del negocio como nombre, descripción, tono, productos, preguntas de calificación u horarios.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        description: 'Nuevo nombre del negocio',
      },
      description: {
        type: 'string',
        description: 'Nueva descripción del negocio',
      },
      tone: {
        type: 'string',
        description: 'Tono de comunicación del agente (ej: profesional, amigable, formal, informal, técnico)',
      },
      products: {
        type: 'array',
        description: 'Lista completa de productos/servicios (reemplaza la lista anterior)',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            currency: { type: 'string' },
          },
          required: ['name', 'description'],
        },
      },
      qualification_questions: {
        type: 'array',
        description: 'Lista completa de preguntas de calificación (reemplaza la lista anterior)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            question: { type: 'string' },
            field: { type: 'string' },
            weight: { type: 'number' },
          },
          required: ['id', 'question', 'field', 'weight'],
        },
      },
      working_hours: {
        type: 'object',
        description: 'Horario de atención',
        properties: {
          start: { type: 'string', description: 'Hora de inicio en formato HH:MM' },
          end: { type: 'string', description: 'Hora de fin en formato HH:MM' },
          days: {
            type: 'array',
            items: { type: 'number' },
            description: 'Días de la semana (0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb)',
          },
        },
      },
    },
  },
}

function buildSystemPrompt(business: Business): string {
  return `Eres un asistente experto que ayuda a configurar negocios en la plataforma End2End (sistema de ventas IA con WhatsApp).

## Negocio actual
- **Nombre:** ${business.name}
- **Descripción:** ${business.description || 'No especificada'}
- **Tono:** ${business.tone || 'profesional'}
- **Productos/servicios:** ${business.products?.length > 0 ? JSON.stringify(business.products, null, 2) : 'Ninguno configurado'}
- **Preguntas de calificación:** ${business.qualification_questions?.length > 0 ? JSON.stringify(business.qualification_questions, null, 2) : 'Ninguna configurada'}
- **Horario:** ${business.working_hours ? `${business.working_hours.start} - ${business.working_hours.end}, días: ${(business.working_hours.days || []).join(', ')}` : 'No especificado'}

## Tu rol
- Si el usuario quiere **modificar** algo del negocio → llama a la herramienta \`update_business\` con los campos a actualizar.
- Si el usuario hace una **pregunta informativa** sobre su configuración → responde con texto sin usar herramientas.
- Siempre responde en español, de forma amigable y concisa.
- Cuando agregues un producto, incluye todos los productos existentes MÁS el nuevo en el array (no reemplaces los anteriores).
- Para los precios en COP, guárdalos como número sin puntos ni comas (ej: 200000).`
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages, business } = (await req.json()) as {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>
      business: Business
    }

    if (!messages || !business) {
      return NextResponse.json({ error: 'Missing messages or business' }, { status: 400 })
    }

    const systemPrompt = buildSystemPrompt(business)

    // First Claude call
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: [UPDATE_BUSINESS_TOOL],
      messages,
    })

    // Pure text response — no update needed
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text')
      return NextResponse.json({
        message: textBlock?.text ?? 'No entendí tu solicitud, ¿puedes reformularla?',
        business: null,
      })
    }

    // Tool use — update Supabase
    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'update_business'
      )

      if (!toolUse) {
        return NextResponse.json({ message: 'Ocurrió un error interno.', business: null }, { status: 500 })
      }

      const updates = toolUse.input as Partial<Business>

      // Patch Supabase via existing PATCH endpoint logic
      const { data: updatedBusiness, error: updateError } = await supabase
        .from('businesses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', business.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        console.error('Supabase update error:', updateError)
        return NextResponse.json(
          { message: 'Error al guardar los cambios en la base de datos.', business: null },
          { status: 500 }
        )
      }

      // Follow-up call to get confirmation text
      const toolResult: Anthropic.ToolResultBlockParam = {
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify({ success: true, updated: Object.keys(updates) }),
      }

      const followUp = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 512,
        system: systemPrompt,
        tools: [UPDATE_BUSINESS_TOOL],
        messages: [
          ...messages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: [toolResult] },
        ],
      })

      const confirmText = followUp.content.find((b) => b.type === 'text')

      return NextResponse.json({
        message: confirmText?.text ?? '¡Listo! Los cambios fueron guardados correctamente.',
        business: updatedBusiness,
      })
    }

    return NextResponse.json({ message: 'No pude procesar tu solicitud.', business: null })
  } catch (error) {
    console.error('Business chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
