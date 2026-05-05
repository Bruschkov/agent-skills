// OpenCode tool definition for non-interactive backlog-handoff initialization.
// OpenCode plugins cannot add slash commands, so init data is supplied as tool args.

import { tool } from "@opencode-ai/plugin";
import { initializeBacklogHandoff } from "../init.ts";

export const backlogHandoffInitTool = tool({
	description: "Initialize backlog-handoff for this project and register it in the meta-project registry.",
	args: {
		projectId: tool.schema.string().optional().describe("Project id to register. Defaults to existing config projectId or current directory basename."),
		metaRoot: tool.schema.string().default("..").describe("Meta root path relative to project root. Defaults to '..'."),
		description: tool.schema.string().optional().describe("1-2 sentence project purpose and ownership boundary. Defaults to a TODO placeholder."),
		owns: tool.schema.array(tool.schema.string()).optional().describe("Optional concrete domains or capabilities owned by this repo."),
		handoffDir: tool.schema.string().optional().describe("Optional custom handoff inbox directory relative to project root."),
		overwrite: tool.schema.boolean().default(false).describe("Overwrite existing local config and registry entry when true."),
	},
	async execute(args, context) {
		return initializeBacklogHandoff(args, context.worktree || context.directory);
	},
});
