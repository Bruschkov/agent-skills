import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

type Rule = string | { type: "regex"; pattern: string };

const DEFAULT_RULES: Rule[] = [
  "git commit",
  "git push",
  "git reset --hard",
  "git clean",
  "sudo",
  "su ",
  "rm -rf /",
  "rm -rf ~",
  "mkfs",
  "dd ",
  "reboot",
  "shutdown",
  "halt"
];

let activeRules: Rule[] = [];

async function loadConfig(cwd: string) {
  const globalPath = path.join(os.homedir(), ".pi", "agent", "blocked-commands.json");
  const localPath = path.join(cwd, ".pi", "blocked-commands.json");

  const customRules: Rule[] = [];

  for (const p of [globalPath, localPath]) {
    try {
      const content = await fs.readFile(p, "utf8");
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed) ? parsed : (parsed.rules || []);
      customRules.push(...list);
    } catch (e) {
      // Ignore missing files or parse errors
    }
  }

  activeRules = customRules;
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    await loadConfig(ctx.cwd);
  });

  pi.registerCommand("block-commands-init", {
    description: "Generate a default blocked-commands.json config file",
    handler: async (args, ctx) => {
      const isProject = args.trim() === "--project";
      const targetPath = isProject 
        ? path.join(ctx.cwd, ".pi", "blocked-commands.json")
        : path.join(os.homedir(), ".pi", "agent", "blocked-commands.json");

      try {
        await fs.access(targetPath);
        const ok = await ctx.ui.confirm("File exists", `${targetPath} already exists. Overwrite?`);
        if (!ok) return;
      } catch (e) {}

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, JSON.stringify({ rules: DEFAULT_RULES }, null, 2), "utf8");
      
      await loadConfig(ctx.cwd); // reload rules immediately
      ctx.ui.notify(`Created and loaded config: ${targetPath}`, "success");
    }
  });

  pi.on("tool_call", async (event, ctx) => {
    if (isToolCallEventType("bash", event)) {
      const commandToRun = event.input.command;
      
      // Split by shell operators to get individual commands
      const subCommands = commandToRun.split(/(?:&&|\|\||;|\||\n)/).map(s => s.trim()).filter(Boolean);

      for (const rule of activeRules) {
        if (typeof rule === "string") {
          // Smart startsWith: checks each segment of a chained command
          if (subCommands.some(cmd => cmd.startsWith(rule))) {
            ctx.ui.notify(`Blocked potentially unsafe command: ${rule}`, "warning");
            return {
              block: true,
              reason: `Command blocked by block-commands extension (matches rule: "${rule}")`
            };
          }
        } else if (typeof rule === "object" && rule !== null && rule.type === "regex") {
          // Regex: tests the entire raw command string
          const regex = new RegExp(rule.pattern);
          if (regex.test(commandToRun)) {
            ctx.ui.notify(`Blocked potentially unsafe command (regex match)`, "warning");
            return {
              block: true,
              reason: `Command blocked by block-commands extension (matches regex: ${rule.pattern})`
            };
          }
        }
      }
    }
  });
}
