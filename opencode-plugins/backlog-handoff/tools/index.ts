// Barrel for OpenCode backlog-handoff tool definitions.
// Keeps plugin entrypoint small and exposes only public tool registrations.

import { backlogHandoffCheckTool } from "./check-tool.ts";
import { backlogHandoffInitTool } from "./init-tool.ts";
import { backlogHandoffTool } from "./handoff-tool.ts";

export const backlogHandoffTools = {
	"backlog-handoff": backlogHandoffTool,
	"backlog-handoff-check": backlogHandoffCheckTool,
	"backlog-handoff-init": backlogHandoffInitTool,
};
