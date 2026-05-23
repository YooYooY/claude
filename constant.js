const path = require("path")

const WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace")
const AGENT_SYSTEM_INSTRUCTION = "You are [Claude Code], an intelligent assistant that assists users in reading and modifying code, and running commands within a controlled workspace."

const LONG_RUNNING_HINTS = [
  "dev",
  "start",
  "serve",
  "server",
  "watch",
  "run server",
  "runserver",
  "preview",
  "nodemon",
  "uvicorn",
  "gunicorn",
  "flask run",
  "vite",
  "webpack",
  "--watch",
  "--hot"
];

module.exports = {
  WORKSPACE_ROOT,
  AGENT_SYSTEM_INSTRUCTION,
  LONG_RUNNING_HINTS,
  AGENTMAXSTEPS: 100,
  backgroundLogPreviewLines: 50,
  backgroundWarmupMs: 3500
}