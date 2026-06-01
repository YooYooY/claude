const path = require("path");
const fsp = require("fs/promises")
const os = require("os")
const matter = require("gray-matter")

const SKILL_DIRS = [
  path.join(process.cwd(), ".claude", "skills"),
  path.join(os.homedir(), ".claude", "skills"),
]

const skills = new Map();

function parseFrontmatter(raw) {
  const { data, content } = matter(raw);
  return { meta: data, body: content.trim() }
}

async function scanDir(root) {
  let entries;
  try {
    entries = await fsp.readdir(root, { withFileTypes: true })
  } catch (error) {
    return;
  }

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    try {
      const raw = await fsp.readFile(path.join(root, ent.name, "SKILL.md"), "utf-8");
      const { meta, body } = parseFrontmatter(raw)
      const { name } = (meta.name || ent.name).trim()

      skills.set(name, {
        name,
        description: meta.description || name,
        body
      })
    } catch (error) {
      // if SKILL.md file is't exist skim
    }
  }
}

async function loadSkills() {
  skills.clear()
  for (const dir of SKILL_DIRS) await scanDir(dir)

  return [ ...skills.values() ]
}

function getSkill(name) {
  return skills.get(String(name || "").replace(/^\//, "").trim()) || null;
}

function enrichSystem(base) {
  if (!skills.size) return base;
  const lines = [ ...skills.values() ].map(s => `- ${s.name}: ${s.description}`)
  return base + "\n\nSKills (using readSkill tool when matching content): \n" + lines.join("\n")
}

function parseSlash(line) {
  const t = line.trim()

  if (!t.startsWith("/")) return null;

  const rest = t.slice(1);

  const sp = rest.indexOf(" ");
  const cmd = (sp === -1 ? rest : rest.slice(0, sp)).trim();

  const skill = getSkill(cmd);

  if (!skill) return null;

  return { skill, args: sp === -1 ? "" : rest.slice(sp + 1).trim() }

}

module.exports = {
  loadSkills,
  getSkill,
  enrichSystem,
  parseSlash
}