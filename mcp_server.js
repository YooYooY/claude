const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js")
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js")

const { z } = require("zod");

const server = new McpServer({ name: "greeting-server", version: "1.0.0" });

server.registerTool("greet", {
  description: "Greeting someone by name",
  inputSchema: {
    name: z.string().describe("greet person's name")
  },
},
  async ({ name }) => ({
    content: [ { type: "text", text: `Hello, ${name}` } ]
  })
)

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport)
}

main().catch(err=>{
  console.error(err)
  process.exit(1)
})