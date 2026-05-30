const { backgroundLogPreviewLines, backgroundWarmupMs, LONG_RUNNING_HINTS, WORKSPACE_ROOT } = require("./constant")
const { delay } = require("./utils")
const iconv = require("iconv-lite");
const { spawn, spawnSync } = require("child_process")

const backgroundProcessMap = new Map()

function tailTextLines(text, maxLines) {
  if (!text) return ""
  return text.split(/\r?\n/).slice(-maxLines).join('\n')
}

function buffersToText(buffers) {
  const chunks = buffers.filter(chunk => chunk != null)
  if (!chunks.length) return ""
  return decodeResultBuffer(Buffer.concat(chunks))
}

function decodeResultBuffer(buffer) {
  if (!buffer || buffer.length == 0) return ""
  if (process.platform === 'win32') return iconv.decode(buffer, 'cp936')
  return buffer.toString('utf8')
}

function bindStreamToBuffers(readableStream, buffers) {
  readableStream.on("data", (chunk) => buffers.push(chunk))
  readableStream.on("end", (chunk) => buffers.push(null))
}

function looksLikeLongRunningCommand(commandLine) {
  const normalized = commandLine.trim().toLowerCase()
  return LONG_RUNNING_HINTS.some(hint => normalized.includes(hint))
}

// signal is approval command: default=false, 1=allow this time, 2=always approval, 3=reject
let alwaysApproveCommands = false
function askCommandApproval(commandLine, rl) {
  return new Promise((resolve) => {

    const prompt = () => {
      console.log(`\n[Command Approval] ready executed`);
      console.log(` ${commandLine} \n`)
      console.log(` 1) Agree to this command \n`)
      console.log(` 2) Agree to all future command \n`)
      console.log(` 3) rejected \n`)

      rl.question("please input:[1/2/3]:", (answer) => {
        const choice = parseInt(answer.trim())

        if (![ 1, 2, 3 ].includes(choice)) {
          console.log('invalid input, please input:[1/2/3]')
          prompt()
        }

        if (choice === 1) {
          resolve({ approved: true })
        }

        if (choice === 2) {
          alwaysApproveCommands = true
          console.log(`Rembered: subsequent commands will execute automatically without further prompting`)
          resolve({ approved: true })
        }

        if (choice === 3) {
          resolve({ approved: false })
        }


      })

    }

    prompt()

  })
}



class RunCommandLine {
  async run({ commandLine }, rl) {
    const backgroundTaskControlReply = this.handleBackgroundTaskControlCommand(commandLine)
    if (backgroundTaskControlReply != null) return backgroundTaskControlReply

    if (!alwaysApproveCommands) {
      const decision = await askCommandApproval(commandLine, rl)

      if (!decision.approved) {
        return `user rejectd exectue command: ${commandLine}`
      }
    }

    if (looksLikeLongRunningCommand(commandLine)) {
      return this.runBackgroundCommandLine(commandLine)
    }

    return this.runBlockingCommandLine(commandLine)
  }

  async runBackgroundCommandLine(commandLine) {
    const buffers = []
    const child = spawn(commandLine, {
      shell: true,
      cwd: WORKSPACE_ROOT,
      stdio: [ 'ignore', 'pipe', 'pipe' ]
    })

    bindStreamToBuffers(child.stdout, buffers)
    bindStreamToBuffers(child.stderr, buffers)

    const pid = child.pid

    backgroundProcessMap.set(pid, {
      commandLine,
      child,
      buffers
    })

    child.once("exit", () => backgroundProcessMap.delete(pid))
    await delay(backgroundWarmupMs)

    return `The child process has been successfully launched in the Background \n PID: ${pid} \n output: \n${Buffer.concat(buffers).toString('utf-8') || 'empty output'}`
  }

  runBlockingCommandLine(commandLine) {
    const result = spawnSync(commandLine, {
      shell: true,
      cwd: WORKSPACE_ROOT,
      encoding: "buffer",
      maxBuffer: 10 * 1024 * 1024
    })

    if (result.error?.code == "ETIMEOUT") return `Synchronization command timed out`
    let merged = result.stdout?.length ? decodeResultBuffer(result.stdout) : "(empty stdout)"
    if (result.stderr?.length) {
      merged += `\n[stderr] \n ${decodeResultBuffer(result.stderr)}`
    }

    return result.status != 0 ? `exit code: ${result.status}\n${merged}` : `command success:\n ${merged}`

  }

  handleBackgroundTaskControlCommand(commandLine) {
    // task_list
    if (/^task_list(\s|$)/i.test(commandLine)) {
      if (backgroundProcessMap.size == 0) return "empty registered background process"
      return [
        "background task list",
        ...[ ...backgroundProcessMap ].map(([ pid, meta ]) => `- ${pid} ${meta.child.exitCode == null ? "Actived" : "Ended"}`)
      ].join("\n")
    }

    // task_logs
    const logsMatch = /^task_logs\s+(\d+)\s*$/i.exec(commandLine.trim())
    if (logsMatch) {
      const pid = Number.parseInt(logsMatch[ 1 ], 10)
      if (!backgroundProcessMap.has(pid)) return `Unregistered Backend PID ${pid}`
      const { buffers } = backgroundProcessMap.get(pid)
      const text = tailTextLines(buffersToText(buffers), backgroundLogPreviewLines)
      return `[PID ${pid} recent output]\n ${text || 'empty output'}`
    }

    const stopMatch = /^task_stop\s+(\d+)\s*$/i.exec(commandLine.trim())
    if (stopMatch) {
      const pid = parseInt(stopMatch[ 1 ])
      if (!backgroundProcessMap.has(pid)) return `unregister PID: ${pid}`
      const { child } = backgroundProcessMap.get(pid)
      try {
        if (process.platform == 'win32') {
          spawnSync(`taskkill /PID ${pid}  \T \F`, { shell: true, stdio: "ignore" })
        } else {
          process.kill(-pid, "SIGTERM")
        }
      } catch (error) {
        child.kill("SIGTERM")
      }
      backgroundProcessMap.delete(pid)
      return `Already terminate process PID=${pid}`
    }

    return null
  }

}

exports.RunCommandLine = RunCommandLine