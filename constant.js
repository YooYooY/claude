const path = require("path")

const WORKSPACE_ROOT = path.resolve(process.cwd(), "workspace")
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
  LONG_RUNNING_HINTS,
  AGENTMAXSTEPS: 100,
  backgroundLogPreviewLines: 50,
  backgroundWarmupMs: 3500
}