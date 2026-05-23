const readline = require("readline")
const fsp = require("fs/promises");
const {OpenAI} = require("openai");

require("dotenv").config({override: true})
const { AGENT_SYSTEM_INSTRUCTION, WORKSPACE_ROOT, AGENTMAXSTEPS } = require("./constant");
const { MODEL_TOOL_DEFINATIONS, toolHandlerByName } = require("./tools");

const openaiClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com"
})

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
})

const askLine = () => new Promise(r => rl.question(">", r))

async function executeSingleToolCall(toolCallPayload){
  const name = toolCallPayload.function.name;
  let parsedArgs = {}
  try {
    parsedArgs = JSON.parse(toolCallPayload.function.arguments)
  } catch (error) {
    parsedArgs = {}
  }
  
  console.log(`\n tool ${name} was invoked`);
  console.log(`tool parameters: ${JSON.stringify(parsedArgs, null, 2)}`)
  
  const handler = toolHandlerByName[name]
  const textResult = handler ? await handler.run(parsedArgs) : `unimplemented tools: ${name}`
  
  return {
    role: "tool",
    tool_call_id: toolCallPayload.id,
    name,
    content: textResult
  }
  
}

async function runAgentUntilReplyOrMaxSteps(messages) {
  let step = 0;
  while (step < AGENTMAXSTEPS) {
    step++;
    console.log("\n request model...");
    const completion = await openaiClient.chat.completions.create({
          model: "deepseek-v4-pro",
          messages: messages,
          tools: MODEL_TOOL_DEFINATIONS,
          tool_choice: "auto"
    })
    const assistantMessage = completion.choices[0].message
    console.log(JSON.stringify(assistantMessage, null, 2))
    messages.push(assistantMessage)
    const calls = assistantMessage.tool_calls
    if(!calls || calls.length === 0) return assistantMessage
    const toolResponses = await Promise.all(calls.map(executeSingleToolCall))
    
    for (const toolResponse of toolResponses) {
      console.log('toolResponse>', toolResponse)
      messages.push(toolResponse)
    }
  }
}

async function main(){
  await fsp.mkdir(WORKSPACE_ROOT, {recursive: true})
  
  const messages = [{"role": "system", "content": AGENT_SYSTEM_INSTRUCTION}]
  
  while(true) {
    const line = await askLine();
    if(!line.trim()) continue;
    if (line.trim() === "q") break;
    messages.push({ role: "user", content: line })
    const reply = await runAgentUntilReplyOrMaxSteps(messages)
    if(reply) {
      console.log(`\nAssistant:\n ${reply.content}`)
    }
    
  }
  
  rl.close()
  
}

main()