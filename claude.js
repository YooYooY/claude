const readline = require("readline")
const fsp = require("fs/promises");
const { OpenAI } = require("openai");

require("dotenv").config({ override: true })
const { WORKSPACE_ROOT, AGENTMAXSTEPS } = require("./constant");
const { MODEL_TOOL_DEFINATIONS: LOCAL_MODEL_TOOL_DEFINITIONS, toolHandlerByName } = require("./tools");

const openaiClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
})

const {
  connectMcpServer,
  callMcpTool,
  isMcpTool,
  getMcpOpenAItools,
  closeMcpConnection
} = require("./mcp_client");

const {
  loadSkills,
  enrichSystem,
  parseSlash
} = require("./skills")

const AGENT_SYSTEM_INSTRUCTION_BASE = [
  "You are [Claude Code].",
  "An intelligent assistant that assists users in reading and modifying code.",
  "Running commands within a controlled workspace.",
  "When a user request some specific action, the MCP tool can be invoked"
].join("");

let agentSystemInstruction = AGENT_SYSTEM_INSTRUCTION_BASE

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
})

const askLine = () => new Promise(r => rl.question(">", r))

async function executeSingleToolCall(toolCallPayload) {
  const name = toolCallPayload.function.name;
  let parsedArgs = {}
  try {
    parsedArgs = JSON.parse(toolCallPayload.function.arguments)
  } catch (error) {
    parsedArgs = {}
  }

  console.log(`\n tool ${name} was invoked`);
  console.log(`tool parameters: ${JSON.stringify(parsedArgs, null, 2)}`)

  let textResult = "";

  if (isMcpTool(name)) {
    try {
      textResult = await callMcpTool(name, parsedArgs)
    } catch (error) {
      textResult = `❌ MCP invoded fail: ${error.message}`
    }
  } else {
    const handler = toolHandlerByName[ name ]
    textResult = handler ? await handler.run(parsedArgs, rl) : `unimplemented tools: ${name}`

  }

  return {
    role: "tool",
    tool_call_id: toolCallPayload.id,
    name,
    content: textResult
  }

}

let activeModeToolDefinitions = [ ...LOCAL_MODEL_TOOL_DEFINITIONS ]

function refreshModeToolDefinitions() {
  activeModeToolDefinitions = [
    ...LOCAL_MODEL_TOOL_DEFINITIONS,
    ...getMcpOpenAItools()
  ]
}

async function runAgentUntilReplyOrMaxSteps(messages) {
  let step = 0;
  while (step < AGENTMAXSTEPS) {
    step++;
    console.log("\n request model...");
    const completion = await openaiClient.chat.completions.create({
      model: "deepseek-v4-pro",
      messages: messages,
      tools: activeModeToolDefinitions,
      tool_choice: "auto"
    })
    const assistantMessage = completion.choices[ 0 ].message
    console.log(JSON.stringify(assistantMessage, null, 2))
    messages.push(assistantMessage)
    const tool_calls = assistantMessage.tool_calls
    if (!tool_calls || tool_calls.length === 0) return assistantMessage

    const sequential = tool_calls.some(tool_call => tool_call.function.name === "runCommand")

    let toolResponses = [];

    if (sequential) {
      for (const tool_call of tool_calls) {
        const toolResponse = await executeSingleToolCall(tool_call)
        toolResponses.push(toolResponse)
      }
    } else {
      toolResponses = await Promise.all(tool_calls.map(executeSingleToolCall))
    }

    for (const toolResponse of toolResponses) {
      console.log('toolResponse>', toolResponse)
      messages.push(toolResponse)
    }

  }
  return {
    role: "assistant",
    content: "dialog exceed limit"
  }
}

async function main() {
  await fsp.mkdir(WORKSPACE_ROOT, { recursive: true })
  await loadSkills()
  agentSystemInstruction = enrichSystem(AGENT_SYSTEM_INSTRUCTION_BASE)
  try {
    await connectMcpServer();
    refreshModeToolDefinitions();
  } catch (error) {
    console.warn(`Can't connect MCP (mcp_server.js need to be pull up by stdio): ${error.message}`)
  }

  const messages = [ { "role": "system", "content": agentSystemInstruction } ]

  while (true) {
    const line = await askLine();
    if (!line.trim()) continue;
    if (line.trim() === "q") break;

    const slash = parseSlash(line);

    const userContent = slash ? `\n use Skill ${slash.skill.name} to execute` + (slash.args ? `\n\n user parameter:${slash.args}` : "") : line;

    messages.push({ role: "user", content: userContent })
    const reply = await runAgentUntilReplyOrMaxSteps(messages)
    if (reply) {
      console.log(`\nAssistant:\n ${reply.content}`)
    }

  }

  rl.close()
  await closeMcpConnection().catch(() => { })

}

main().catch(async (err) => {
  console.error(err)
  await closeMcpConnection().catch(() => { });
  process.exit(1)
})