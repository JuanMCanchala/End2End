import Anthropic from '@anthropic-ai/sdk'
import { anthropic, CLAUDE_MODEL } from '@/lib/claude/client'
import { AgentType } from '@/types'

export interface ToolHandler {
  [toolName: string]: (input: Record<string, unknown>) => Promise<unknown>
}

export interface AgentLoopResult {
  finalResponse: string
  toolsExecuted: Array<{ tool: string; input: unknown; output: unknown }>
  agentType: AgentType
}

const MAX_ITERATIONS = 10

export async function runAgentLoop(
  systemPrompt: string,
  userMessage: string,
  tools: Anthropic.Tool[],
  toolHandlers: ToolHandler,
  agentType: AgentType,
  conversationHistory: Anthropic.MessageParam[] = [],
  terminalTools: string[] = []
): Promise<AgentLoopResult> {
  const toolsExecuted: Array<{ tool: string; input: unknown; output: unknown }> = []
  let finalResponse = ''

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      tools,
      messages,
    })

    // If no tool calls, we have the final answer
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text')
      finalResponse = textBlock ? textBlock.text : ''
      break
    }

    // Process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')

      // Add assistant's response to messages
      messages.push({ role: 'assistant', content: response.content })

      // Execute all tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const toolUse of toolUseBlocks) {
        const handler = toolHandlers[toolUse.name]
        let result: unknown

        if (handler) {
          try {
            result = await handler(toolUse.input as Record<string, unknown>)
          } catch (error) {
            result = { error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
          }
        } else {
          result = { error: `Unknown tool: ${toolUse.name}` }
        }

        toolsExecuted.push({ tool: toolUse.name, input: toolUse.input, output: result })

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      // Add tool results to messages
      messages.push({ role: 'user', content: toolResults })

      // Check if any terminal tool was called (agent is done after this)
      const terminalToolCalled = terminalTools.length > 0 &&
        toolsExecuted.some((t) => terminalTools.includes(t.tool))

      if (terminalToolCalled) {
        const textBlock = response.content.find((b) => b.type === 'text')
        finalResponse = textBlock ? textBlock.text : ''
        break
      }

      // Check if any tool returned a "stop" signal (agent decided to delegate)
      const stopTool = toolsExecuted.find((t) =>
        ['route_to_qualifier', 'route_to_proposal', 'route_to_scheduler', 'route_to_followup', 'route_to_purchase'].includes(t.tool)
      )

      if (stopTool && agentType === 'orchestrator') {
        // Get final text from last assistant response
        const textBlock = response.content.find((b) => b.type === 'text')
        finalResponse = textBlock ? textBlock.text : ''
        break
      }
    }
  }

  return { finalResponse, toolsExecuted, agentType }
}
