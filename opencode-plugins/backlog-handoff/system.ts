// System prompt integration for backlog-handoff workspace context.
// Adds configured target project summaries before each OpenCode chat request.

import { errorToMessage } from "./fs.ts";
import { loadRegistryContext } from "./registry-load.ts";
import { collectValidationIssues, formatWorkspacePrompt } from "./registry-report.ts";

export async function appendBacklogHandoffSystemPrompt(output: { system: string[] }, startDir: string) {
	try {
		const registry = await loadRegistryContext(startDir);
		if (!registry) {
			return;
		}
		const issues = await collectValidationIssues(registry);
		output.system.push(formatWorkspacePrompt(registry, issues));
	} catch (error) {
		output.system.push(
			[
				"## Backlog handoff workspace",
				`Backlog-handoff configuration currently invalid: ${errorToMessage(error)}`,
				"Do not call backlog-handoff until the user fixes this configuration.",
			].join("\n"),
		);
	}
}
