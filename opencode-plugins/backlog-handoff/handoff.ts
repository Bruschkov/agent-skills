// Handoff file creation for the OpenCode backlog-handoff tool.
// Validates target project ownership, formats markdown, and writes to target inbox.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { errorToMessage, pathExists, writeNewFileWithSuffix } from "./fs.ts";
import { loadRegistryContext } from "./registry-load.ts";
import { formatOwns, getHandoffDir } from "./registry-report.ts";
import type { BacklogHandoffInput } from "./types.ts";

export async function createBacklogHandoff(params: BacklogHandoffInput, cwd: string) {
	const { targetProject, title, rationale, requestedChange, constraints, acceptanceCriteria } = params;
	const registry = await loadRegistryContext(cwd);
	if (!registry) {
		throw new Error(
			`Missing local backlog-handoff config. Create .backlog-handoff/config.json in this project with {"projectId":"<current-project-id>","metaRoot":"<path-to-meta-root>"}.`,
		);
	}

	const target = registry.projects.get(targetProject);
	if (!target) {
		const availableTargets = Array.from(registry.projects.keys()).filter((projectId) => projectId !== registry.currentProject.id).join(", ");
		throw new Error(`Unknown targetProject '${targetProject}'. Available target ids: ${availableTargets || "none"}. Check ${registry.projectsDir}.`);
	}
	if (target.id === registry.currentProject.id) {
		throw new Error(`backlog-handoff targetProject must be another project. Current project is '${registry.currentProject.id}'.`);
	}
	if (!(await pathExists(target.absolutePath))) {
		throw new Error(`Configured target project path does not exist: ${target.absolutePath}`);
	}

	const handoffDir = path.join(target.absolutePath, getHandoffDir(target));
	const requestedPath = path.join(handoffDir, makeTaskFileName(title));
	const taskContent = formatTaskContent(params, registry.currentProject.id, registry.currentProject.absolutePath, target);

	try {
		await fs.mkdir(handoffDir, { recursive: true });
		const filePath = await writeNewFileWithSuffix(requestedPath, taskContent);
		return {
			output: `Created backlog-handoff file '${title}' for project '${target.id}' at ${filePath}`,
			metadata: { filePath, title, targetProject: target.id, originProject: registry.currentProject.id, handoffDir, localConfigPath: registry.localConfigPath, projectsDir: registry.projectsDir },
		};
	} catch (error) {
		throw new Error(`Failed to write handoff file ${requestedPath}: ${errorToMessage(error)}`);
	}
}

function makeTaskFileName(title: string) {
	const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
	const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
	return `handoff-${timestamp}-${safeTitle || "task"}.md`;
}

function formatTaskContent(
	params: BacklogHandoffInput,
	originProjectId: string,
	originProjectPath: string,
	target: { id: string; absolutePath: string; description: string; owns?: string[]; handoffDir?: string },
) {
	const acceptanceChecklist = params.acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`).join("\n");
	return [
		"---",
		`origin_project: ${JSON.stringify(originProjectId)}`,
		`origin_path: ${JSON.stringify(originProjectPath)}`,
		`target_project: ${JSON.stringify(target.id)}`,
		`target_path: ${JSON.stringify(target.absolutePath)}`,
		`created_at: ${JSON.stringify(new Date().toISOString())}`,
		'status: "inbox"',
		"---",
		"",
		`# ${params.title}`,
		"",
		"## Why this is a handoff",
		params.rationale,
		"",
		"## Requested Change",
		params.requestedChange,
		"",
		"## Target Project Context",
		`- Description: ${target.description}`,
		`- Owns: ${formatOwns(target)}`,
		`- Handoff inbox: ${getHandoffDir(target)}`,
		"",
		...(params.constraints && params.constraints.trim().length > 0 ? ["## Constraints / Notes", params.constraints, ""] : []),
		"## Acceptance Criteria",
		acceptanceChecklist,
		"",
	].join("\n");
}
