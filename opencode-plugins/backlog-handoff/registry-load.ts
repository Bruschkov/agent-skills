// Discovery and loading for backlog-handoff meta-project registry files.
// Resolves local config from current directory upward, then loads all project entries.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { errorToMessage, pathExists, readJson } from "./fs.ts";
import { validateLocalConfig, validateProjectEntry } from "./registry-validation.ts";
import type { LocalSetup, ProjectWithPath, RegistryContext } from "./types.ts";

export async function findLocalBacklogHandoffConfig(startDir: string) {
	let currentDir = path.resolve(startDir);

	while (true) {
		const configPath = path.join(currentDir, ".backlog-handoff", "config.json");
		if (await pathExists(configPath)) {
			return configPath;
		}

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			return null;
		}
		currentDir = parentDir;
	}
}

export async function loadLocalSetup(startDir: string): Promise<LocalSetup | null> {
	const localConfigPath = await findLocalBacklogHandoffConfig(startDir);
	if (!localConfigPath) {
		return null;
	}

	let localConfigRaw: unknown;
	try {
		localConfigRaw = await readJson<unknown>(localConfigPath);
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Failed to parse ${localConfigPath}. Must be valid JSON.`);
		}
		throw new Error(`Failed to read ${localConfigPath}: ${errorToMessage(error)}`);
	}

	const localConfig = validateLocalConfig(localConfigRaw, localConfigPath);
	const projectRoot = path.dirname(path.dirname(localConfigPath));
	const metaRoot = path.resolve(projectRoot, localConfig.metaRoot);
	const projectsDir = path.join(metaRoot, ".backlog-handoff", "projects");

	return { localConfigPath, projectRoot, projectId: localConfig.projectId, metaRoot, projectsDir };
}

export async function loadRegistryContext(startDir: string): Promise<RegistryContext | null> {
	const setup = await loadLocalSetup(startDir);
	if (!setup) {
		return null;
	}
	if (!(await pathExists(setup.projectsDir))) {
		throw new Error(`Missing meta-project registry directory at ${setup.projectsDir}. Expected project entries in .backlog-handoff/projects/*.json.`);
	}

	const projectFiles = await readProjectFiles(setup.projectsDir);
	const projects = await loadProjects(setup.metaRoot, setup.projectsDir, projectFiles);
	const currentProject = projects.get(setup.projectId);
	if (!currentProject) {
		throw new Error(
			`Current project '${setup.projectId}' from ${setup.localConfigPath} not found in ${setup.projectsDir}. Available projects: ${Array.from(projects.keys()).join(", ") || "none"}`,
		);
	}

	return { ...setup, currentProject, projects };
}

async function readProjectFiles(projectsDir: string) {
	let projectFiles: string[];
	try {
		projectFiles = (await fs.readdir(projectsDir)).filter((entry) => entry.endsWith(".json")).sort();
	} catch (error) {
		throw new Error(`Failed to read project registry directory ${projectsDir}: ${errorToMessage(error)}`);
	}
	if (projectFiles.length === 0) {
		throw new Error(`No project entries found in ${projectsDir}. Add at least one *.json file.`);
	}
	return projectFiles;
}

async function loadProjects(metaRoot: string, projectsDir: string, projectFiles: string[]) {
	const projects = new Map<string, ProjectWithPath>();
	for (const fileName of projectFiles) {
		const filePath = path.join(projectsDir, fileName);
		const raw = await readProjectEntry(filePath);
		const project = validateProjectEntry(raw, filePath);
		if (projects.has(project.id)) {
			throw new Error(`Duplicate project id '${project.id}' in ${projectsDir}.`);
		}
		projects.set(project.id, { ...project, filePath, absolutePath: path.resolve(metaRoot, project.path) });
	}
	return projects;
}

async function readProjectEntry(filePath: string) {
	try {
		return await readJson<unknown>(filePath);
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new Error(`Failed to parse ${filePath}. Must be valid JSON.`);
		}
		throw new Error(`Failed to read ${filePath}: ${errorToMessage(error)}`);
	}
}
