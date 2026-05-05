// Runtime validators for backlog-handoff config and registry JSON files.
// External JSON stays unknown until these guards prove required fields.

import { isRecord } from "./fs.ts";
import type { BacklogHandoffLocalConfig, ProjectEntry } from "./types.ts";

export function validateLocalConfig(value: unknown, filePath: string): BacklogHandoffLocalConfig {
	if (!isRecord(value)) {
		throw new Error(`${filePath} must be a JSON object.`);
	}

	const { projectId, metaRoot } = value;
	if (typeof projectId !== "string" || projectId.trim() === "") {
		throw new Error(`${filePath} must contain string field 'projectId'.`);
	}
	if (typeof metaRoot !== "string" || metaRoot.trim() === "") {
		throw new Error(`${filePath} must contain string field 'metaRoot'.`);
	}

	return { projectId: projectId.trim(), metaRoot: metaRoot.trim() };
}

export function validateProjectEntry(value: unknown, filePath: string): ProjectEntry {
	if (!isRecord(value)) {
		throw new Error(`${filePath} must be a JSON object.`);
	}

	const { id, path: projectPath, description, owns, handoffDir } = value;
	if (typeof id !== "string" || id.trim() === "") {
		throw new Error(`${filePath} must contain string field 'id'.`);
	}
	if (typeof projectPath !== "string" || projectPath.trim() === "") {
		throw new Error(`${filePath} must contain string field 'path'.`);
	}
	if (typeof description !== "string" || description.trim() === "") {
		throw new Error(`${filePath} must contain string field 'description'.`);
	}
	if (owns !== undefined && (!Array.isArray(owns) || owns.some((item) => typeof item !== "string"))) {
		throw new Error(`${filePath} field 'owns' must be an array of strings when present.`);
	}
	if (handoffDir !== undefined && (typeof handoffDir !== "string" || handoffDir.trim() === "")) {
		throw new Error(`${filePath} field 'handoffDir' must be a non-empty string when present.`);
	}

	return {
		id: id.trim(),
		path: projectPath.trim(),
		description: description.trim(),
		owns: owns?.map((item) => item.trim()).filter((item) => item.length > 0),
		handoffDir: handoffDir?.trim(),
	};
}
