// OpenCode tool definition for registry validation reports.
// This replaces the Pi /backlog-handoff-check command with a callable tool.

import { tool } from "@opencode-ai/plugin";
import { loadRegistryContext } from "../registry-load.ts";
import { buildValidationReport, collectValidationIssues } from "../registry-report.ts";

export const backlogHandoffCheckTool = tool({
	description: "Validate backlog-handoff config and project registry, returning a markdown report.",
	args: {},
	async execute(_args, context) {
		const registry = await loadRegistryContext(context.directory);
		if (!registry) {
			throw new Error('Missing .backlog-handoff/config.json. Create it with {"projectId":"<id>","metaRoot":"<path>"}.');
		}

		const issues = await collectValidationIssues(registry);
		const errorCount = issues.filter((issue) => issue.severity === "error").length;
		const warningCount = issues.filter((issue) => issue.severity === "warning").length;
		return {
			output: buildValidationReport(registry, issues),
			metadata: { errorCount, warningCount, localConfigPath: registry.localConfigPath, projectsDir: registry.projectsDir },
		};
	},
});
