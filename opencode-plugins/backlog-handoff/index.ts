// OpenCode plugin entrypoint for backlog-handoff cross-project workflow.
// Registers handoff/check/init tools and injects configured project target context into system prompts.

import type { Plugin } from "@opencode-ai/plugin";
import { appendBacklogHandoffSystemPrompt } from "./system.ts";
import { backlogHandoffTools } from "./tools/index.ts";

export const BacklogHandoffPlugin: Plugin = async ({ directory, worktree }) => {
	const promptStartDir = worktree || directory;
	return {
		tool: backlogHandoffTools,
		"experimental.chat.system.transform": async (_input, output) => {
			await appendBacklogHandoffSystemPrompt(output, promptStartDir);
		},
	};
};

export default BacklogHandoffPlugin;
