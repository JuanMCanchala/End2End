# End2End

Equipo de agentes de IA que atiende a los clientes de un negocio por WhatsApp y Telegram de punta a punta: responde, califica al interesado, arma la propuesta en PDF, agenda la reunión en Calendly y hace el seguimiento si no contesta — con un panel donde una persona puede leer todo y tomar el control de la conversación en cualquier momento.

**Demo → [end2-end.vercel.app](https://end2-end.vercel.app)**

## La idea

Un chatbot responde preguntas. Esto cierra procesos. Cada conversación entra por un **orquestador** que decide a qué agente especializado rutearla, y cada agente tiene sus propias herramientas y puede escribir en la base de datos del negocio.

```
WhatsApp (Twilio) ─┐
Telegram ──────────┼─► webhook ─► Orquestador ─┬─► Comprador    (catálogo, pedido)
Widget web ────────┘                           ├─► Calificador  (detecta intención y presupuesto)
                                               ├─► Propuestas   (genera y envía el PDF)
                                               ├─► Agendador    (Calendly: disponibilidad y reserva)
                                               └─► Seguimiento  (reengancha al que no respondió)
                                                        │
                                                        ▼
                                              Supabase (Postgres + RLS)
                                                        │
                                                        ▼
                                          Panel: conversaciones, leads,
                                          citas, métricas y *takeover* humano
```

El orquestador no escribe la respuesta: usa _tool calling_ (`route_to_purchase`, `route_to_qualifier`, …) para delegar, y cada ruteo queda registrado en `agent_actions`, así que toda decisión de un agente es auditable después.

## Qué incluye

| Área            | Detalle                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| **Canales**     | WhatsApp vía Twilio, Telegram vía bot, y un chat de demo embebible                      |
| **Agentes**     | orquestador + 5 especializados, sobre un bucle de herramientas propio (`agent-loop.ts`) |
| **Propuestas**  | generación de PDF con PDFKit y envío por el canal de la conversación                    |
| **Agenda**      | OAuth con Calendly, sincronización y webhooks de eventos                                |
| **Seguimiento** | recordatorios programados a leads que se enfriaron                                      |
| **Panel**       | conversaciones en vivo, leads, citas, actividad de los agentes y métricas con Recharts  |
| **Takeover**    | una persona interviene la conversación y los agentes se silencian                       |
| **Onboarding**  | el negocio se configura conversando (`setup_conversations`), no llenando un formulario  |

## Stack

Next.js 14 (App Router) · TypeScript · Claude (`@anthropic-ai/sdk`) · Supabase (Postgres, Auth, RLS) · Twilio · Telegram Bot API · Calendly API · PDFKit · Tailwind + shadcn/ui (Radix) · Recharts

## Esquema de datos

`businesses` · `leads` · `conversations` · `messages` · `agent_actions` · `followups` · `proposals` · `appointments` · `setup_conversations`

Seis migraciones en `supabase/migrations/`, en orden.

## Puesta en marcha

Requisitos: Node 18+, un proyecto de Supabase y una API key de Anthropic. Twilio, Telegram y Calendly son opcionales — sin ellos funciona el chat de demo.

```bash
git clone https://github.com/JuanMCanchala/End2End
cd End2End
npm install
cp .env.example .env.local     # ver la tabla de abajo
npm run dev                    # http://localhost:3000
```

Aplica las migraciones en tu proyecto de Supabase (`supabase db push`, o pegándolas en el editor SQL en orden).

### Variables de entorno

| Variable                                                                         | Para qué                                      |
| -------------------------------------------------------------------------------- | --------------------------------------------- |
| `ANTHROPIC_API_KEY`                                                              | los agentes                                   |
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY`                     | cliente                                       |
| `SUPABASE_SERVICE_ROLE_KEY`                                                      | escrituras del servidor (nunca en el cliente) |
| `NEXT_PUBLIC_APP_URL`                                                            | URL pública, para las de retorno de webhooks  |
| `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` · `TWILIO_WHATSAPP_FROM`              | WhatsApp                                      |
| `TELEGRAM_BOT_TOKEN`                                                             | Telegram                                      |
| `CALENDLY_CLIENT_ID` · `CALENDLY_CLIENT_SECRET` · `CALENDLY_WEBHOOK_SIGNING_KEY` | agenda                                        |

### Webhooks

Los canales entrantes necesitan una URL pública (en local, un túnel tipo ngrok):

| Servicio | Endpoint                                                                     |
| -------- | ---------------------------------------------------------------------------- |
| Twilio   | `POST /api/webhook/twilio`                                                   |
| Telegram | `POST /api/webhook/telegram` — se registra con `/api/telegram/setup-webhook` |
| Calendly | `POST /api/calendly/webhook`                                                 |

## Estructura

```
src/
├── app/
│   ├── (auth)/              login y registro
│   ├── api/                 webhooks, agentes, recursos REST
│   └── dashboard/           panel: conversaciones, leads, citas, métricas
├── lib/
│   ├── agents/              agent-loop, orchestrator y los 5 especializados
│   ├── claude/ supabase/ twilio/ telegram/ calendly/
│   ├── pdf/                 generación de propuestas
│   └── utils/prompts.ts     prompts del sistema por agente
└── types/
supabase/migrations/
```

## Estado

Proyecto funcional, en desarrollo activo. No es una plantilla: los prompts y el flujo están afinados para un caso de uso concreto de ventas consultivas en español.
