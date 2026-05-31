const path = require("path")

const { Client } = require("@modelcontextprotocol/sdk/client/index.js")

const { StdioClientTransport } = require("@modelcontextprotocol/sdk/client/stdio.js")

const SERVER_SCRIPT = path.join(__dirname, "mcp_server.js")

let client = null;

const toolNames = new Set()

let openAI_ToolDefinitions = []

function mcpToolToOpenAI(tool) {
  const schema = tool.inputSchema || { type: "object", properties: {} };

  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || `MCP tool: ${tool.name}`,
      parameters: schema
    }
  }
}

function mcpResultToText(result) {
  if (!result?.content?.length) return '(EMPTY MCP return result)'

  return result.content.filter(block => block.type === "text").map(block => block.text).join("\n")
}

async function connectMcpServer() {
  if (client) return { client, toolNames, openAI_ToolDefinitions };

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [ SERVER_SCRIPT ],
    cwd: path.dirname(SERVER_SCRIPT),
    stderr: "pipe"
  })

  client = new Client({ name: "claude-code-mcp-client", version: "1.0.0" });

  await client.connect(transport)

  const { tools } = await client.listTools();

  openAI_ToolDefinitions = tools.map(mcpToolToOpenAI)

  toolNames.clear();

  for (const t of tools) toolNames.add(t.name);

  console.log(`Already connect MCP (stdio -> ${SERVER_SCRIPT}), tools: ${[ ...toolNames ].join(",") || "None"}`)

  return { client, toolNames, openAI_ToolDefinitions };

}

async function callMcpTool(name, args) {
  if (!client) throw new Error("MCP Not Connected")

  const result = await client.callTool({ name, arguments: args || {} });

  return mcpResultToText(result)
}

function isMcpTool(name) {
  return toolNames.has(name)
}

function getMcpOpenAItools(){
  return openAI_ToolDefinitions
}

async function closeMcpConnection(){
  if(!client) return;
  await client.close();
  client = null;
  toolNames.clear()
  openAI_ToolDefinitions = []
}

module.exports = {
  connectMcpServer,
  callMcpTool,
  isMcpTool,
  getMcpOpenAItools,
  closeMcpConnection
}