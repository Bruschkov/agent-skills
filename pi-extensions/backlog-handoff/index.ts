import { withFileMutationQueue, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { Type } from "typebox";

type BacklogHandoffLocalConfig = {
	projectId: string;
	metaRoot: string;
};

type ProjectEntry = {
	id: string;
	path: string;
	description: string;
	owns?: string[];
	handoffDir?: string;
};

type ProjectWithPath = ProjectEntry & {
	filePath: string;
	absolutePath: string;
};

type LocalSetup = {
	localConfigPath: string;
	projectRoot: string;
	projectId: string;
	metaRoot: string;
	projectsDir: string;
};

type RegistryContext = LocalSetup & {
	currentProject: ProjectWithPath;
	projects: Map<string, ProjectWithPath>;
};

type ValidationIssue = {
	severity: "warning" | "error";
	message: string;
	projectId?: string;
	filePath?: string;
};

const BACKLOG_HANDOFF_SCHEMA = Type.Object({
	targetProject: Type.String({
		description: "Configured target project ID from the current meta-project registry, e.g. 'backend' or 'scraper'",
	}),
	title: Type.String({
		description: "Short, descriptive title for the handoff request",
	}),
	rationale: Type.String({
		description: "Why this work belongs in the target project and what change in the current project triggered the handoff.",
	}),
	requestedChange: Type.String({
		description: "Concrete work the target project should implement.",
	}),
	constraints: Type.Optional(
		Type.String({
			description: "Optional constraints, non-goals, rollout notes, or implementation hints.",
		}),
	),
	acceptanceCriteria: Type.Array(Type.String(), {
		description: "Specific checks that define done. Provide at least one concrete acceptance criterion.",
		minItems: 1,
	}),
});

async function pathExists(targetPath: string): Promise<boolean> {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

async function readJson<T>(filePath: string): Promise<T> {
	const content = await fs.readFile(filePath, "utf-8");
	return JSON.parse(content) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateLocalConfig(value: unknown, filePath: string): BacklogHandoffLocalConfig {
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

	return { projectId, metaRoot };
}

function validateProjectEntry(value: unknown, filePath: string): ProjectEntry {
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

async function findLocalBacklogHandoffConfig(startDir: string): Promise<string | null> {
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

async function loadLocalSetup(startDir: string): Promise<LocalSetup | null> {
	const localConfigPath = await findLocalBacklogHandoffConfig(startDir);
	if (!localConfigPath) {
		return null;
	}

	let localConfigRaw: unknown;
	try {
		localConfigRaw = await readJson<unknown>(localConfigPath);
	} catch (error: any) {
		if (error?.name === "SyntaxError") {
			throw new Error(`Failed to parse ${localConfigPath}. Must be valid JSON.`);
		}
		throw new Error(`Failed to read ${localConfigPath}: ${error?.message ?? String(error)}`);
	}

	const localConfig = validateLocalConfig(localConfigRaw, localConfigPath);
	const projectRoot = path.dirname(path.dirname(localConfigPath));
	const metaRoot = path.resolve(projectRoot, localConfig.metaRoot);
	const projectsDir = path.join(metaRoot, ".backlog-handoff", "projects");

	return {
		localConfigPath,
		projectRoot,
		projectId: localConfig.projectId,
		metaRoot,
		projectsDir,
	};
}

async function loadRegistryContext(startDir: string): Promise<RegistryContext | null> {
	const setup = await loadLocalSetup(startDir);
	if (!setup) {
		return null;
	}

	if (!(await pathExists(setup.projectsDir))) {
		throw new Error(`Missing meta-project registry directory at ${setup.projectsDir}. Expected project entries in .backlog-handoff/projects/*.json.`);
	}

	let projectFiles: string[];
	try {
		projectFiles = (await fs.readdir(setup.projectsDir)).filter((entry) => entry.endsWith(".json")).sort();
	} catch (error: any) {
		throw new Error(`Failed to read project registry directory ${setup.projectsDir}: ${error?.message ?? String(error)}`);
	}

	if (projectFiles.length === 0) {
		throw new Error(`No project entries found in ${setup.projectsDir}. Add at least one *.json file.`);
	}

	const projects = new Map<string, ProjectWithPath>();
	for (const fileName of projectFiles) {
		const filePath = path.join(setup.projectsDir, fileName);
		let raw: unknown;
		try {
			raw = await readJson<unknown>(filePath);
		} catch (error: any) {
			if (error?.name === "SyntaxError") {
				throw new Error(`Failed to parse ${filePath}. Must be valid JSON.`);
			}
			throw new Error(`Failed to read ${filePath}: ${error?.message ?? String(error)}`);
		}

		const project = validateProjectEntry(raw, filePath);
		if (projects.has(project.id)) {
			throw new Error(`Duplicate project id '${project.id}' in ${setup.projectsDir}.`);
		}

		projects.set(project.id, {
			...project,
			filePath,
			absolutePath: path.resolve(setup.metaRoot, project.path),
		});
	}

	const currentProject = projects.get(setup.projectId);
	if (!currentProject) {
		throw new Error(
			`Current project '${setup.projectId}' from ${setup.localConfigPath} not found in ${setup.projectsDir}. Available projects: ${Array.from(projects.keys()).join(", ") || "none"}`,
		);
	}

	return {
		...setup,
		currentProject,
		projects,
	};
}

function formatOwns(project: ProjectEntry): string {
	return project.owns && project.owns.length > 0 ? project.owns.join(", ") : "not specified";
}

function isGenericDescription(description: string): boolean {
	const normalized = description.trim().toLowerCase();
	if (normalized.length < 30) {
		return true;
	}
	if (normalized.startsWith("todo")) {
		return true;
	}
	const vaguePhrases = ["handles stuff", "project repo", "things", "misc", "miscellaneous", "backend project", "frontend project"];
	return vaguePhrases.some((phrase) => normalized.includes(phrase));
}

function normalizeOwns(value: string): string {
	return value.trim().toLowerCase();
}

async function collectValidationIssues(registry: RegistryContext): Promise<ValidationIssue[]> {
	const issues: ValidationIssue[] = [];
	const normalizedProjectRoot = path.resolve(registry.projectRoot);
	const normalizedCurrentPath = path.resolve(registry.currentProject.absolutePath);

	if (normalizedProjectRoot !== normalizedCurrentPath) {
		issues.push({
			severity: "warning",
			message: `Local config points to current project '${registry.currentProject.id}', but registry path resolves to ${registry.currentProject.absolutePath} while current repo root is ${registry.projectRoot}.`,
			projectId: registry.currentProject.id,
			filePath: registry.localConfigPath,
		});
	}

	const ownsIndex = new Map<string, string[]>();
	for (const project of registry.projects.values()) {
		if (!(await pathExists(project.absolutePath))) {
			issues.push({
				severity: "warning",
				message: `Configured project path does not exist on this machine: ${project.absolutePath}`,
				projectId: project.id,
				filePath: project.filePath,
			});
		}

		if (isGenericDescription(project.description)) {
			issues.push({
				severity: "warning",
				message: "Project description is too generic. Describe project purpose, boundary, and what it owns.",
				projectId: project.id,
				filePath: project.filePath,
			});
		}

		if (project.owns && project.owns.length > 0) {
			for (const ownsEntry of project.owns) {
				if (ownsEntry.toLowerCase().startsWith("todo")) {
					issues.push({
						severity: "warning",
						message: `Owns entry '${ownsEntry}' still contains TODO placeholder text.`,
						projectId: project.id,
						filePath: project.filePath,
					});
				}
				const key = normalizeOwns(ownsEntry);
				const owners = ownsIndex.get(key) ?? [];
				owners.push(project.id);
				ownsIndex.set(key, owners);
			}
		}
	}

	for (const [ownsEntry, projectIds] of ownsIndex.entries()) {
		if (projectIds.length > 1) {
			issues.push({
				severity: "warning",
				message: `Owns entry '${ownsEntry}' appears in multiple projects: ${projectIds.join(", ")}. This may make target selection ambiguous.`,
			});
		}
	}

	return issues;
}

function getHandoffDir(project: ProjectEntry): string {
	return project.handoffDir ?? ".backlog-handoff/inbox";
}

function formatWorkspacePrompt(registry: RegistryContext, issues: ValidationIssue[]): string {
	const targets = Array.from(registry.projects.values()).filter((project) => project.id !== registry.currentProject.id);
	const targetLines =
		targets.length === 0
			? ["- none configured"]
			: targets.map(
				(project) => `- ${project.id}: ${project.description} Owns: ${formatOwns(project)}. Handoff inbox: ${getHandoffDir(project)}`,
			  );
	const warningCount = issues.filter((issue) => issue.severity === "warning").length;
	const errorCount = issues.filter((issue) => issue.severity === "error").length;

	return [
		"## Backlog handoff workspace",
		`Current project: ${registry.currentProject.id}`,
		`Current project description: ${registry.currentProject.description}`,
		`Current project owns: ${formatOwns(registry.currentProject)}`,
		"Available backlog-handoff targets:",
		...targetLines,
		"Backlog-handoff quality rules:",
		"- Project descriptions should state purpose, boundary, and what the repo owns.",
		"- Owns lists are optional. If present, use concrete domains or capabilities, not vague placeholders.",
		"- Backlog-handoff creates landing-zone handoff files, not final backlog-md tickets. Target project can later review and convert them.",
		"- Backlog-handoff files should explain the trigger, requested change, constraints, and concrete acceptance criteria.",
		warningCount > 0 || errorCount > 0
			? `Registry health: ${errorCount} errors, ${warningCount} warnings. Use /backlog-handoff-check to review details if targeting seems ambiguous.`
			: "Registry health: no known validation issues.",
		"Use backlog-handoff only for work that belongs in another configured project. Use exact targetProject ids from the list above. Do not invent target ids or filesystem paths.",
	].join("\n");
}

function makeTaskFileName(title: string): string {
	const timestamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 14);
	const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
	return `handoff-${timestamp}-${safeTitle || "task"}.md`;
}

function formatIssue(issue: ValidationIssue): string {
	const prefix = issue.severity === "error" ? "ERROR" : "WARN";
	const target = issue.projectId ? ` [${issue.projectId}]` : "";
	const fileInfo = issue.filePath ? ` (${issue.filePath})` : "";
	return `- ${prefix}${target}: ${issue.message}${fileInfo}`;
}

function inferProjectId(projectRoot: string): string {
	const normalized = path
		.basename(projectRoot)
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return normalized || "project";
}

function toPortableRelativePath(fromDir: string, toDir: string): string {
	const relativePath = path.relative(fromDir, toDir).split(path.sep).join("/");
	if (!relativePath) {
		return ".";
	}
	return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
}

function stringifyJson(value: unknown): string {
	return `${JSON.stringify(value, null, 2)}\n`;
}

function buildValidationReport(registry: RegistryContext, issues: ValidationIssue[]): string {
	const errors = issues.filter((issue) => issue.severity === "error");
	const warnings = issues.filter((issue) => issue.severity === "warning");
	const targets = Array.from(registry.projects.values()).filter((project) => project.id !== registry.currentProject.id);

	return [
		"# Backlog Handoff Check",
		"",
		`Current project: ${registry.currentProject.id}`,
		`Current repo root: ${registry.projectRoot}`,
		`Local config: ${registry.localConfigPath}`,
		`Meta root: ${registry.metaRoot}`,
		`Projects dir: ${registry.projectsDir}`,
		"",
		"## Current project",
		`- Description: ${registry.currentProject.description}`,
		`- Owns: ${formatOwns(registry.currentProject)}`,
		"",
		"## Available targets",
		...(targets.length === 0
			? ["- none configured"]
			: targets.map((project) => `- ${project.id}: ${project.description} Owns: ${formatOwns(project)}. Path: ${project.absolutePath}. Handoff inbox: ${getHandoffDir(project)}`)),
		"",
		"## Quality guidance",
		"- Description: 1-2 sentences. State project purpose, boundary, and what belongs there.",
		"- Owns: optional short capability/domain hints like 'routes', 'auth', 'search ui', 'scraping'.",
		"- Avoid vague text like 'backend project', 'handles stuff', or TODO placeholders.",
		"- Handoffs land in a landing-zone inbox first, then can be converted into real backlog-md tickets later.",
		"",
		`## Validation summary`,
		`- Errors: ${errors.length}`,
		`- Warnings: ${warnings.length}`,
		"",
		...(issues.length === 0 ? ["No validation issues found."] : issues.map(formatIssue)),
	].join("\n");
}

export default function backlogHandoffExtension(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		try {
			const registry = await loadRegistryContext(event.systemPromptOptions.cwd);
			if (!registry) {
				return;
			}
			const issues = await collectValidationIssues(registry);
			return {
				systemPrompt: `${event.systemPrompt}\n\n${formatWorkspacePrompt(registry, issues)}`,
			};
		} catch (error: any) {
			return {
				systemPrompt: `${event.systemPrompt}\n\n## Backlog handoff workspace\nBacklog-handoff configuration currently invalid: ${error?.message ?? String(error)}\nDo not call backlog-handoff until the user fixes this configuration.`,
			};
		}
	});

	pi.registerCommand("backlog-handoff-init", {
		description: "Initialize backlog-handoff for the current project and register it in the meta-project registry",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("backlog-handoff-init requires interactive mode", "error");
				return;
			}

			let projectRoot = ctx.cwd;
			try {
				const gitRoot = await pi.exec("git", ["rev-parse", "--show-toplevel"], { timeout: 3_000 });
				if (gitRoot.code === 0 && gitRoot.stdout.trim()) {
					projectRoot = gitRoot.stdout.trim();
				}
			} catch {
				// Ignore. Fallback to ctx.cwd.
			}

			const localConfigPath = path.join(projectRoot, ".backlog-handoff", "config.json");
			let defaultProjectId = inferProjectId(projectRoot);
			let defaultMetaRoot = "..";
			if (await pathExists(localConfigPath)) {
				try {
					const existingLocalConfig = validateLocalConfig(await readJson<unknown>(localConfigPath), localConfigPath);
					defaultProjectId = existingLocalConfig.projectId;
					defaultMetaRoot = existingLocalConfig.metaRoot;
				} catch {
					// Ignore broken existing config here. User can overwrite it.
				}
			}

			const projectIdInput = await ctx.ui.input("Project id", defaultProjectId);
			if (projectIdInput === undefined) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}
			const projectId = projectIdInput.trim() || defaultProjectId;
			if (!projectId) {
				ctx.ui.notify("Project id required", "error");
				return;
			}

			const metaRootInput = await ctx.ui.input("Meta root (relative to project root)", defaultMetaRoot);
			if (metaRootInput === undefined) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}
			const metaRootSetting = metaRootInput.trim() || defaultMetaRoot;
			const metaRoot = path.resolve(projectRoot, metaRootSetting);
			const projectsDir = path.join(metaRoot, ".backlog-handoff", "projects");
			const projectEntryPath = path.join(projectsDir, `${projectId}.json`);
			const projectPath = toPortableRelativePath(metaRoot, projectRoot);

			let initialProjectEntry = stringifyJson({
				id: projectId,
				path: projectPath,
				description: "TODO: Replace with 1-2 sentences describing this project and what work belongs here.",
			});
			if (await pathExists(projectEntryPath)) {
				try {
					initialProjectEntry = await fs.readFile(projectEntryPath, "utf-8");
				} catch {
					// Keep generated default.
				}
			}

			const editedEntry = await ctx.ui.editor("Backlog Handoff Project Entry", initialProjectEntry);
			if (editedEntry === undefined) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			let parsedEntry: unknown;
			try {
				parsedEntry = JSON.parse(editedEntry);
			} catch (error: any) {
				ctx.ui.notify(`Project entry is not valid JSON: ${error?.message ?? String(error)}`, "error");
				return;
			}

			const projectEntry = validateProjectEntry(parsedEntry, projectEntryPath);
			if (projectEntry.id !== projectId) {
				ctx.ui.notify(`Project entry id must stay '${projectId}'.`, "error");
				return;
			}
			if (projectEntry.path !== projectPath) {
				ctx.ui.notify(`Project entry path must stay '${projectPath}'.`, "error");
				return;
			}

			const localConfig = { projectId, metaRoot: metaRootSetting };
			const inboxDir = path.join(projectRoot, ".backlog-handoff", "inbox");
			const gitkeepPath = path.join(inboxDir, ".gitkeep");
			const willOverwriteLocalConfig = await pathExists(localConfigPath);
			const willOverwriteProjectEntry = await pathExists(projectEntryPath);
			const ok = await ctx.ui.confirm(
				"Initialize backlog handoff?",
				[
					`Project root: ${projectRoot}`,
					`Meta root: ${metaRoot}`,
					`Local config: ${localConfigPath}${willOverwriteLocalConfig ? " (overwrite)" : ""}`,
					`Project entry: ${projectEntryPath}${willOverwriteProjectEntry ? " (overwrite)" : ""}`,
					`Inbox dir: ${inboxDir}`,
				].join("\n"),
			);
			if (!ok) {
				ctx.ui.notify("Cancelled", "info");
				return;
			}

			try {
				await fs.mkdir(path.join(projectRoot, ".backlog-handoff"), { recursive: true });
				await fs.mkdir(projectsDir, { recursive: true });
				await fs.mkdir(inboxDir, { recursive: true });

				await withFileMutationQueue(localConfigPath, async () => {
					await fs.writeFile(localConfigPath, stringifyJson(localConfig), "utf-8");
					return { content: [], details: {} };
				});
				await withFileMutationQueue(projectEntryPath, async () => {
					await fs.writeFile(projectEntryPath, stringifyJson(projectEntry), "utf-8");
					return { content: [], details: {} };
				});
				await withFileMutationQueue(gitkeepPath, async () => {
					await fs.writeFile(gitkeepPath, "", "utf-8");
					return { content: [], details: {} };
				});
			} catch (error: any) {
				ctx.ui.notify(`Failed to initialize backlog handoff: ${error?.message ?? String(error)}`, "error");
				return;
			}

			ctx.ui.notify(`Initialized backlog handoff for '${projectId}'`, "success");
		},
	});

	pi.registerCommand("backlog-handoff-check", {
		description: "Validate backlog-handoff config and project registry",
		handler: async (_args, ctx) => {
			try {
				const registry = await loadRegistryContext(ctx.cwd);
				if (!registry) {
					ctx.ui.notify(
						"Missing .backlog-handoff/config.json. Create it with {\"projectId\":\"<id>\",\"metaRoot\":\"<path>\"}.",
						"error",
					);
					return;
				}

				const issues = await collectValidationIssues(registry);
				const report = buildValidationReport(registry, issues);
				const errorCount = issues.filter((issue) => issue.severity === "error").length;
				const warningCount = issues.filter((issue) => issue.severity === "warning").length;

				if (ctx.hasUI) {
					await ctx.ui.editor("Backlog Handoff Check", report);
				} else {
					console.log(report);
				}

				ctx.ui.notify(
					`Backlog handoff check: ${errorCount} errors, ${warningCount} warnings`,
					errorCount > 0 ? "error" : warningCount > 0 ? "warning" : "success",
				);
			} catch (error: any) {
				ctx.ui.notify(`Backlog handoff check failed: ${error?.message ?? String(error)}`, "error");
			}
		},
	});


	pi.registerTool({
		name: "backlog-handoff",
		label: "Backlog Handoff",
		description: "Create a structured handoff file in another configured project's landing-zone inbox.",
		promptSnippet: "Create a structured handoff file in another configured project's landing-zone inbox when required work belongs outside the current repo",
		promptGuidelines: [
			"Use backlog-handoff when required work belongs in another configured project rather than the current project.",
			"Use backlog-handoff with targetProject set to one exact configured project id from the backlog-handoff workspace context.",
			"Use backlog-handoff with rationale, requestedChange, constraints, and concrete acceptanceCriteria so the receiving project can review and convert the handoff into a real backlog ticket without guessing.",
		],
		parameters: BACKLOG_HANDOFF_SCHEMA,
		prepareArguments(args) {
			if (!isRecord(args)) {
				return args;
			}

			const prepared = { ...args } as Record<string, unknown>;
			if (typeof prepared.project === "string" && prepared.targetProject === undefined) {
				prepared.targetProject = prepared.project;
			}
			if (typeof prepared.description === "string") {
				if (prepared.requestedChange === undefined) {
					prepared.requestedChange = prepared.description;
				}
				if (prepared.rationale === undefined) {
					prepared.rationale = "Follow-up work belongs in the target project and was discovered while implementing work in the current project.";
				}
				if (prepared.acceptanceCriteria === undefined) {
					prepared.acceptanceCriteria = ["Requested change implemented in target project."];
				}
			}
			return prepared;
		},
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { targetProject, title, rationale, requestedChange, constraints, acceptanceCriteria } = params.input;
			const registry = await loadRegistryContext(ctx.cwd);
			if (!registry) {
				throw new Error(
					`Missing local backlog-handoff config. Create .backlog-handoff/config.json in this project with {"projectId":"<current-project-id>","metaRoot":"<path-to-meta-root>"}.`,
				);
			}

			const target = registry.projects.get(targetProject);
			if (!target) {
				const availableTargets = Array.from(registry.projects.keys())
					.filter((projectId) => projectId !== registry.currentProject.id)
					.join(", ");
				throw new Error(
					`Unknown targetProject '${targetProject}'. Available target ids: ${availableTargets || "none"}. Check ${registry.projectsDir}.`,
				);
			}
			if (target.id === registry.currentProject.id) {
				throw new Error(`backlog-handoff targetProject must be another project. Current project is '${registry.currentProject.id}'.`);
			}
			if (!(await pathExists(target.absolutePath))) {
				throw new Error(`Configured target project path does not exist: ${target.absolutePath}`);
			}

			const handoffDir = path.join(target.absolutePath, getHandoffDir(target));
			const filePath = path.join(handoffDir, makeTaskFileName(title));
			const createdAt = new Date().toISOString();
			const acceptanceChecklist = acceptanceCriteria.map((criterion) => `- [ ] ${criterion}`).join("\n");
			const taskContent = [
				"---",
				`origin_project: ${JSON.stringify(registry.currentProject.id)}`,
				`origin_path: ${JSON.stringify(registry.currentProject.absolutePath)}`,
				`target_project: ${JSON.stringify(target.id)}`,
				`target_path: ${JSON.stringify(target.absolutePath)}`,
				`created_at: ${JSON.stringify(createdAt)}`,
				'status: "inbox"',
				"---",
				"",
				`# ${title}`,
				"",
				"## Why this is a handoff",
				rationale,
				"",
				"## Requested Change",
				requestedChange,
				"",
				"## Target Project Context",
				`- Description: ${target.description}`,
				`- Owns: ${formatOwns(target)}`,
				`- Handoff inbox: ${getHandoffDir(target)}`,
				"",
				...(constraints && constraints.trim().length > 0 ? ["## Constraints / Notes", constraints, ""] : []),
				"## Acceptance Criteria",
				acceptanceChecklist,
				"",
			].join("\n");

			return withFileMutationQueue(filePath, async () => {
				try {
					await fs.mkdir(handoffDir, { recursive: true });
					await fs.writeFile(filePath, taskContent, "utf-8");
				} catch (error: any) {
					throw new Error(`Failed to write handoff file ${filePath}: ${error?.message ?? String(error)}`);
				}

				return {
					content: [
						{
							type: "text",
							text: `Created backlog-handoff file '${title}' for project '${target.id}' at ${filePath}`,
						},
					],
					details: {
						filePath,
						title,
						targetProject: target.id,
						originProject: registry.currentProject.id,
						handoffDir,
						localConfigPath: registry.localConfigPath,
						projectsDir: registry.projectsDir,
					},
				};
			});
		},
	});
}
