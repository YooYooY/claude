const fsp = require("fs/promises");
const path = require("path")
const { resolvePathInsideWorkspace } = require("./utils")
const { RunCommandLine } = require("./RunCommandLine");
const { getSkill } = require("./skills");

class ReadText {
  async run({ path: relativePath }) {
    try {
      return await fsp.readFile(resolvePathInsideWorkspace(relativePath), "utf-8")
    } catch (err) {
      return err.code === 'ENOENT' ? `can't find file:${relativePath}` : `error reading:${err.message}`
    }
  }
}

class WriteText {
  async run({ path: relativePath, content }) {
    try {
      const absolute = resolvePathInsideWorkspace(relativePath)
      await fsp.mkdir(path.dirname(absolute), { recursive: true })
      await fsp.writeFile(absolute, content, "utf-8")
      return `already write in ${Buffer.byteLength(content, "utf-8")} bite ->${relativePath}`
    } catch (error) {
      return `write error: ${error.message}`
    }
  }
}

class EditFile {
  async run({ path: relativePath, oldText, newText }) {
    try {
      const absolute = resolvePathInsideWorkspace(reolativePath)
      const before = await fsp.readFile(absolute, "utf-8")
      if (!before.include(oldText)) return "❌ No Fragment exactly matching `oldText` was found in the file"
      await fsp.writeFile(absolute, before.replace(oldText, newText), "utf-8")
      return `File content successfully replaced: ${relativePath}`
    } catch (error) {
      return error.code === "ENOENT" ? `File not found: ${relativePath}` : `Read Exception: ${error.message}`
    }
  }
}

class ListDir {
  async run({ path: relativePath }) {
    try {
      const absolute = resolvePathInsideWorkspace(relativePath)

      const stat = await fsp.stat(absolute)

      if (!stat.isDirectory()) {
        return `The target path is not a directory: ${relativePath}`
      }

      const entries = await fsp.readdir(absolute, { withFileTypes: true })

      entries.sort((a, b) => a.name.localeCompare(b.name))

      const rows = entries.map(entry => `${entry.isDirectory() ? 'directory: ' : 'file: '} ${entry.name}`)

      return rows.length > 0 ? rows.join("\n") : "(empty dir)"
    } catch (error) {
      return error.code === "ENOENT" ? `can't not found: ${relativePath}` : `read execption: ${error.message}`
    }
  }
}

class ReadSkill {
  async run({skill: skillName}) {
    const skill = getSkill(skillName)
    return skill ? skill.body : `error: Skill ${skillName} Not Found`
  }
}

const MODEL_TOOL_DEFINATIONS = [
  {
    "type": "function",
    "function": {
      name: "readFile",
      description: "Read text files within the workspace using UTF-8 encoding.",
      parameters: {
        type: "object",
        properties: { path: { type: "string" } },
        required: [ "path" ]
      }
    }
  },
  {
    "type": "function",
    "function": {
      name: "writeFile",
      description: "Create new files or overwrite existing ones within the workspace",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" }
        },
        required: [ "path", "content" ]
      }
    },
  },
  {
    "type": "function",
    "function": {
      name: "editFile",
      description: "Performs a precise substring replacement on the existing text; 'oldtext' must match the file content exactly",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file to be modified" },
          oldText: { type: "string", description: "The original text to be replaced (single match)" },
          newText: { type: "string", description: "The new, replaced text" }
        },
        required: [ "path", "oldText", "newText" ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "listDir",
      description: "Lists the entries within a directory(including subfolder indicators) to quickly map out the directory structure",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "dir path" },
        },
        required: [ "path" ]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "runCommand",
      description: 
      "When executing commands in the shell, short-running commands block until completion. \n"+
      "Whereas commands suspected to be development servers are launched in the background. \n"+
      "Important: Commands are executed in the current directory; do not use the `cd` command. \n"+
      "Standard: `install`, `build`, `test`, etx, execute sync; `stdout` and `stderr` are aggregated and returned \n"+
      "Persistent Mode: Runs processes(e.g. `pnpm dev`, `npm start`, `uvicorn`, `flask run`) in the background; returns the PID and startup logs after approximately 8 seconds. \n"+
      "Backend Subcommands: \n" +
      "   task_list   Lists the registered background tasks\n"+
      "   task_logs <pid> Retrieve the most recent lines for this PID and merge the output \n"+
      "   task_stop <pid> Terminate the background task corresponding to this PID\n ",
      parameters: {
        type: "object",
        properties: {
          commandLine: {
            type: "string",
            description: "shell command line (example: npm install)"
          }
        },
        required: ["commandline"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "readSkill",
      description: "load Skill full body content, operation when the task match system instruction",
      parameters: {
        type: "object",
        properties: {
          skill: {
            type: "string",
            description: "Skill name(filename or SKILL.md frontmatter's name)"
          }
        },
        required: ["skill"]
      }
    }
  }
]

const toolHandlerByName = {
  readFile: new ReadText(),
  writeFile: new WriteText(),
  editFile: new EditFile(),
  listDir: new ListDir(),
  runCommand: new RunCommandLine(),
  readSkill: new ReadSkill()
}

module.exports = {
  MODEL_TOOL_DEFINATIONS,
  toolHandlerByName
}

