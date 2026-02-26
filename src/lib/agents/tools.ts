import Anthropic from '@anthropic-ai/sdk'

// Tool definitions for each agent type
export const ORCHESTRATOR_TOOLS: Anthropic.Tool[] = [
  {
    name: 'route_to_qualifier',
    description: 'Enviar al agente calificador para hacer preguntas de calificación al lead',
    input_schema: {
      type: 'object' as const,
      properties: {
        reason: { type: 'string', description: 'Razón por la que se necesita calificar' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'route_to_proposal',
    description: 'Enviar al agente de propuestas para generar una cotización',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_interest: { type: 'string', description: 'En qué productos está interesado el lead' },
      },
      required: ['product_interest'],
    },
  },
  {
    name: 'route_to_scheduler',
    description: 'Enviar al agente de agenda para programar una cita o reunión',
    input_schema: {
      type: 'object' as const,
      properties: {
        meeting_type: { type: 'string', description: 'Tipo de reunión solicitada' },
      },
      required: ['meeting_type'],
    },
  },
  {
    name: 'route_to_followup',
    description: 'Enviar al agente de seguimiento para programar un follow-up',
    input_schema: {
      type: 'object' as const,
      properties: {
        days_until_followup: { type: 'number', description: 'Días hasta el próximo seguimiento' },
        reason: { type: 'string', description: 'Razón del seguimiento' },
      },
      required: ['days_until_followup', 'reason'],
    },
  },
  {
    name: 'send_direct_response',
    description: 'Enviar una respuesta directa sin rutear a otro agente especialista',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Mensaje a enviar al lead' },
      },
      required: ['message'],
    },
  },
]

export const QUALIFIER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'save_qualification_answer',
    description: 'Guardar una respuesta de calificación del lead en la base de datos',
    input_schema: {
      type: 'object' as const,
      properties: {
        field: { type: 'string', description: 'Campo de calificación (ej: budget, timeline, need)' },
        value: { type: 'string', description: 'Valor de la respuesta' },
        lead_name: { type: 'string', description: 'Nombre del lead si fue mencionado' },
      },
      required: ['field', 'value'],
    },
  },
  {
    name: 'update_lead_score',
    description: 'Actualizar el score y temperatura del lead basado en la calificación',
    input_schema: {
      type: 'object' as const,
      properties: {
        score: { type: 'number', description: 'Score de 0 a 100' },
        temperature: { type: 'string', enum: ['hot', 'warm', 'cold'], description: 'Temperatura del lead' },
        reason: { type: 'string', description: 'Razón del score asignado' },
      },
      required: ['score', 'temperature', 'reason'],
    },
  },
  {
    name: 'send_qualifier_message',
    description: 'Enviar un mensaje de calificación al lead',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string', description: 'Pregunta o mensaje a enviar' },
      },
      required: ['message'],
    },
  },
]

export const PROPOSAL_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_proposal',
    description: 'Crear y guardar una propuesta comercial en el sistema',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título de la propuesta' },
        items: {
          type: 'array',
          description: 'Items de la propuesta',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              quantity: { type: 'number' },
              unit_price: { type: 'number' },
              total: { type: 'number' },
            },
            required: ['name', 'description', 'quantity', 'unit_price', 'total'],
          },
        },
        total_amount: { type: 'number', description: 'Monto total de la propuesta' },
        currency: { type: 'string', default: 'COP' },
        message: { type: 'string', description: 'Mensaje a enviar al lead con la propuesta' },
      },
      required: ['title', 'items', 'total_amount', 'message'],
    },
  },
]

export const SCHEDULER_TOOLS: Anthropic.Tool[] = [
  {
    name: 'create_appointment',
    description: 'Crear y guardar una cita o reunión en el sistema',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Título de la cita' },
        scheduled_at: { type: 'string', description: 'Fecha y hora en formato ISO 8601' },
        duration_minutes: { type: 'number', description: 'Duración en minutos', default: 30 },
        location: { type: 'string', description: 'Lugar de la reunión (opcional)' },
        meeting_link: { type: 'string', description: 'Link de videollamada (opcional)' },
        notes: { type: 'string', description: 'Notas adicionales' },
        confirmation_message: { type: 'string', description: 'Mensaje de confirmación para el lead' },
      },
      required: ['title', 'scheduled_at', 'confirmation_message'],
    },
  },
]

export const FOLLOWUP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'schedule_followup',
    description: 'Programar un mensaje de seguimiento para enviar en el futuro',
    input_schema: {
      type: 'object' as const,
      properties: {
        scheduled_at: { type: 'string', description: 'Fecha y hora en formato ISO 8601' },
        message: { type: 'string', description: 'Mensaje de seguimiento personalizado' },
        confirmation_to_lead: { type: 'string', description: 'Mensaje inmediato al lead confirmando el seguimiento' },
      },
      required: ['scheduled_at', 'message', 'confirmation_to_lead'],
    },
  },
]

export const SETUP_TOOLS: Anthropic.Tool[] = [
  {
    name: 'save_setup_data',
    description: 'Guardar los datos de configuración del negocio',
    input_schema: {
      type: 'object' as const,
      properties: {
        field: {
          type: 'string',
          enum: ['name', 'description', 'products', 'tone', 'qualification_questions', 'working_hours'],
          description: 'Campo a actualizar',
        },
        value: { description: 'Valor del campo (string, array, u objeto según el campo)' },
        next_step: { type: 'string', description: 'Próximo paso de la configuración' },
      },
      required: ['field', 'value', 'next_step'],
    },
  },
  {
    name: 'complete_setup',
    description: 'Marcar la configuración como completada',
    input_schema: {
      type: 'object' as const,
      properties: {
        summary_message: { type: 'string', description: 'Mensaje de resumen de la configuración completada' },
      },
      required: ['summary_message'],
    },
  },
]
