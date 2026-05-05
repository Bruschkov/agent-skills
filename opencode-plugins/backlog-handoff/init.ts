// Non-interactive initializer for backlog-handoff config used by OpenCode tools.
// Replaces Pi slash-command UI with explicit tool arguments and safe overwrite behavior.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { errorToMessage, pathExists, readJson, stringifyJson } from "./fs.ts";
import { validateLocalConfig, validateProjectEntry } from "./registry-validation.ts";
import type { BacklogHandoffInitInput, ProjectEntry } from "./types.ts";

const PLACEHOLDER_DESCRIPTION = "TODO: Replace with 1-2 sentences describing this project and what work belongs here.";

export async function initializeBacklogHandoff(params: BacklogHandoffInitInput, projectRoot: string) {
	const normalizedRoot = path.resolve(projectRoot);
	const localConfigPath = path.join(normalizedRoot, ".backlog-handoff", "config.json");
	const setup = await resolveInitSetup(params, normalizedRoot, localConfigPath);
	const inboxDir = path.join(normalizedRoot, ".backlog-handoff", "inbox");
	const processedDir = path.join(normalizedRoot, ".backlog-handoff", "processed");
	const projectEntry = buildProjectEntry(params, setup.projectId, setup.projectPath);

	await fs.mkdir(path.join(normalizedRoot, ".backlog-handoff"), { recursive: true });
	await fs.mkdir(setup.projectsDir, { recursive: true });
	await fs.mkdir(inboxDir, { recursive: true });
	await fs.mkdir(processedDir, { recursive: true });
	await writeConfigIfAllowed(localConfigPath, { projectId: setup.projectId, metaRoot: setup.metaRootSetting }, params.overwrite);
	await writeProjectEntryIfAllowed(setup.projectEntryPath, projectEntry, params.overwrite);
	await fs.writeFile(path.join(inboxDir, ".gitkeep"), "", "utf-8");
	await fs.writeFile(path.join(processedDir, ".gitkeep"), "", "utf-8");

	return {
		output: `Initialized backlog handoff for '${setup.projectId}' at ${normalizedRoot}`,
		metadata: { projectRoot: normalizedRoot, projectId: setup.projectId, metaRoot: setup.metaRoot, localConfigPath, projectEntryPath: setup.projectEntryPath, inboxDir, processedDir },
	};
}

async function resolveInitSetup(params: BacklogHandoffInitInput, projectRoot: string, localConfigPath: string) {
	const existingConfig = await readExistingConfig(localConfigPath);
	const projectId = params.projectId?.trim() || existingConfig?.projectId || inferProjectId(projectRoot);
	const metaRootSetting = params.metaRoot?.trim() || existingConfig?.metaRoot || "..";
	if (!params.overwrite && existingConfig) {
		if (params.projectId && params.projectId.trim() !== existingConfig.projectId) {
			throw new Error(`Existing ${localConfigPath} uses projectId '${existingConfig.projectId}'. Pass overwrite=true to replace it.`);
		}
		if (params.metaRoot && params.metaRoot.trim() !== existingConfig.metaRoot) {
			throw new Error(`Existing ${localConfigPath} uses metaRoot '${existingConfig.metaRoot}'. Pass overwrite=true to replace it.`);
		}
	}

	const metaRoot = path.resolve(projectRoot, metaRootSetting);
	const projectPath = toPortableRelativePath(metaRoot, projectRoot);
	return {
		projectId,
		metaRootSetting,
		metaRoot,
		projectPath,
		projectsDir: path.join(metaRoot, ".backlog-handoff", "projects"),
		projectEntryPath: path.join(metaRoot, ".backlog-handoff", "projects", `${projectId}.json`),
	};
}

function buildProjectEntry(params: BacklogHandoffInitInput, projectId: string, projectPath: string): ProjectEntry {
	return stripUndefined({
		id: projectId,
		path: projectPath,
		description: params.description?.trim() || PLACEHOLDER_DESCRIPTION,
		owns: params.owns?.map((item) => item.trim()).filter((item) => item.length > 0),
		handoffDir: params.handoffDir?.trim(),
	});
}

async function writeConfigIfAllowed(filePath: string, value: { projectId: string; metaRoot: string }, overwrite: boolean) {
	if ((await pathExists(filePath)) && !overwrite) {
		return;
	}
	await fs.writeFile(filePath, stringifyJson(value), "utf-8");
}

async function writeProjectEntryIfAllowed(filePath: string, value: ProjectEntry, overwrite: boolean) {
	if ((await pathExists(filePath)) && !overwrite) {
		validateProjectEntry(await readJson<unknown>(filePath), filePath);
		return;
	}
	await fs.writeFile(filePath, stringifyJson(value), "utf-8");
}

async function readExistingConfig(filePath: string) {
	if (!(await pathExists(filePath))) {
		return null;
	}
	try {
		return validateLocalConfig(await readJson<unknown>(filePath), filePath);
	} catch (error) {
		throw new Error(`Existing backlog-handoff config is invalid: ${errorToMessage(error)}. Pass overwrite=true to replace it.`);
	}
}

function inferProjectId(projectRoot: string) {
	const normalized = path.basename(projectRoot).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
	return normalized || "project";
}

function toPortableRelativePath(fromDir: string, toDir: string) {
	const relativePath = path.relative(fromDir, toDir).split(path.sep).join("/");
	return relativePath ? (relativePath.startsWith(".") ? relativePath : `./${relativePath}`) : ".";
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
	return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
