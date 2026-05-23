const fsp = require("fs/promises");
const path = require("path")
const { resolvePathInsideWorkspace } = require("./utils")

class ReadText {
  async run({path: relativePath}) {
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
      await fsp.mkdir(path.dirname(absolute), {recursive: true})
      await fsp.writeFile(absolute, content, "utf-8")
      return  `already write in ${Buffer.byteLength(content, "utf-8")} bite ->${relativePath}`
    } catch (error) {
      return `write error: ${error.message}`
    }
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
        properties: {path: {type: "string"}},
        required: ["path"]
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
          content: {type: "string"} 
        },
        required: [ "path", "content"]
      }
    }
  }
]

const toolHandlerByName = {
  readFile: new ReadText(),
  writeFile: new WriteText()
}

module.exports = {
  MODEL_TOOL_DEFINATIONS,
  toolHandlerByName
}

