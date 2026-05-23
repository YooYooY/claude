const path = require("path")

const WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace")
const AGENT_SYSTEM_INSTRUCTION = "You are [Claude Code], an intelligent assistant that assists users in reading and modifying code, and running commands within a controlled workspace."

module.exports = {
  WORKSPACE_ROOT,
  AGENT_SYSTEM_INSTRUCTION,
  AGENTMAXSTEPS: 100
}