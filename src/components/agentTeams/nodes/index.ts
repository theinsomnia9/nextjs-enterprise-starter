import TriggerNode from './TriggerNode'
import AgentNode from './AgentNode'
import ToolNode from './ToolNode'
import GuardrailNode from './GuardrailNode'
import OutputNode from './OutputNode'

export const nodeTypes = {
  trigger: TriggerNode,
  agent: AgentNode,
  tool: ToolNode,
  guardrail: GuardrailNode,
  output: OutputNode,
}
