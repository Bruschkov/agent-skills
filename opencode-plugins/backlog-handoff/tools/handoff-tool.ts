// OpenCode tool definition for creating cross-project backlog handoff files.
// Schema intentionally accepts flat top-level args, matching the Pi extension contract.

import { tool } from "@opencode-ai/plugin";
import { createBacklogHandoff } from "../handoff.ts";

export const backlogHandoffTool = tool({
	description: "Create a structured handoff file in another configured project's landing-zone inbox.",
	args: {
		targetProject: tool.schema.string().describe("Configured target project ID from the current meta-project registry, e.g. 'backend' or 'scraper'"),
		title: tool.schema.string().describe("Short, descriptive title for the handoff request"),
		rationale: tool.schema.string().describe("Why this work belongs in the target project and what change in the current project triggered the handoff."),
		requestedChange: tool.schema.string().describe("Concrete work the target project should implement."),
		constraints: tool.schema.string().optional().describe("Optional constraints, non-goals, rollout notes, or implementation hints."),
		acceptanceCriteria: tool.schema.array(tool.schema.string()).min(1).describe("Specific checks that define done. Provide at least one concrete acceptance criterion."),
	},
	async execute(args, context) {
		return createBacklogHandoff(args, context.directory);
	},
});
