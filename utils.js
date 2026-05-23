const path = require("path")
const { WORKSPACE_ROOT } = require("./constant")

function isDescendantOrSameDirectory(candidatePath){
  const targetAbs = path.resolve(candidatePath)
  if(WORKSPACE_ROOT == targetAbs) return true;
  
  const relative = path.relative(WORKSPACE_ROOT, targetAbs)
  
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative) 
}

function resolvePathInsideWorkspace(relativePath) {
  const candidatePath = path.resolve(WORKSPACE_ROOT, relativePath)
  
  if(!isDescendantOrSameDirectory(candidatePath)) {
    throw new Error(`over path: ${candidatePath}`)
  }
  
  return candidatePath
}

const delay = (ms) => new Promise(r => setTimeout(r, ms))

module.exports = {
  isDescendantOrSameDirectory,
  resolvePathInsideWorkspace,
  delay
};


