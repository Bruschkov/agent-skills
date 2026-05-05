import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const pluginSourceDir = path.join(repoRoot, "opencode-plugins", "backlog-handoff");

let cachedHarnessPromise;

function getOpenCodePluginPackageDir() {
	const candidates = [
		path.join(os.homedir(), ".config", "opencode", "node_modules", "@opencode-ai", "plugin"),
		path.join(execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim(), "@opencode-ai", "plugin"),
	];
	return candidates.find((candidate) => existsSync(path.join(candidate, "package.json")));
}

async function loadBacklogHandoffPlugin() {
	if (cachedHarnessPromise) {
		return cachedHarnessPromise;
	}
	cachedHarnessPromise = createBacklogHandoffHarness();
	return cachedHarnessPromise;
}

async function createBacklogHandoffHarness() {
	const pluginPackageDir = getOpenCodePluginPackageDir();
	assert.ok(pluginPackageDir, "@opencode-ai/plugin package not found");

	const tempDir = await mkdtemp(path.join(os.tmpdir(), "opencode-backlog-handoff-plugin-"));
	const tempPluginDir = path.join(tempDir, "plugin");
	await cp(pluginSourceDir, tempPluginDir, { recursive: true });
	await mkdir(path.join(tempDir, "node_modules", "@opencode-ai"), { recursive: true });
	await symlink(pluginPackageDir, path.join(tempDir, "node_modules", "@opencode-ai", "plugin"), "dir");

	const pluginModule = await import(`${pathToFileURL(path.join(tempPluginDir, "index.ts")).href}?ts=${Date.now()}`);
	assert.equal(typeof pluginModule.BacklogHandoffPlugin, "function");
	const hooks = await pluginModule.BacklogHandoffPlugin({
		client: {},
		project: { id: "test", name: "test" },
		directory: tempDir,
		worktree: tempDir,
		experimental_workspace: { register() {} },
		serverUrl: new URL("http://localhost"),
		$: {},
	});
	return { hooks };
}

async function createWorkspace() {
	const root = await mkdtemp(path.join(os.tmpdir(), "opencode-backlog-handoff-workspace-"));
	const metaRoot = path.join(root, "meta");
	const currentProjectRoot = path.join(metaRoot, "frontend");
	const targetProjectRoot = path.join(metaRoot, "backend");
	const registryDir = path.join(metaRoot, ".backlog-handoff", "projects");
	const currentConfigDir = path.join(currentProjectRoot, ".backlog-handoff");

	await mkdir(currentConfigDir, { recursive: true });
	await mkdir(registryDir, { recursive: true });
	await mkdir(targetProjectRoot, { recursive: true });
	await writeJson(path.join(currentConfigDir, "config.json"), { projectId: "frontend", metaRoot: ".." });
	await writeJson(path.join(registryDir, "frontend.json"), {
		id: "frontend",
		path: "./frontend",
		description: "Frontend app. Owns UI flows, forms, and presentation logic.",
	});
	await writeJson(path.join(registryDir, "backend.json"), {
		id: "backend",
		path: "./backend",
		description: "Backend API. Owns routes, persistence, and background jobs.",
	});

	return { currentProjectRoot, targetProjectRoot, validPayload: makeValidPayload() };
}

function makeValidPayload() {
	return {
		targetProject: "backend",
		title: "Add retry metadata endpoint",
		rationale: "Backend owns retry persistence; issue found while wiring frontend error handling.",
		requestedChange: "Expose retry metadata for failed jobs and store retry timestamps.",
		constraints: "No frontend changes in this task.",
		acceptanceCriteria: ["Retry metadata endpoint exists and is authenticated.", "Retry timestamps are persisted for failed jobs."],
	};
}

async function writeJson(filePath, value) {
	await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function toolContext(directory) {
	return { sessionID: "s", messageID: "m", agent: "build", directory, worktree: directory, abort: new AbortController().signal, metadata() {}, ask() {} };
}

test("OpenCode backlog-handoff tool writes handoff file", async () => {
	const { hooks } = await loadBacklogHandoffPlugin();
	const { currentProjectRoot, targetProjectRoot, validPayload } = await createWorkspace();
	const result = await hooks.tool["backlog-handoff"].execute(validPayload, toolContext(currentProjectRoot));

	assert.equal(result.metadata.targetProject, "backend");
	assert.equal(result.metadata.originProject, "frontend");
	assert.match(result.output, /Created backlog-handoff file/);

	const inboxDir = path.join(targetProjectRoot, ".backlog-handoff", "inbox");
	const inboxFiles = await readdir(inboxDir);
	assert.equal(inboxFiles.length, 1);
	const handoffContent = await readFile(path.join(inboxDir, inboxFiles[0]), "utf8");
	assert.match(handoffContent, /origin_project: "frontend"/);
	assert.match(handoffContent, /target_project: "backend"/);
	assert.match(handoffContent, /# Add retry metadata endpoint/);
	assert.match(handoffContent, /- \[ \] Retry metadata endpoint exists and is authenticated\./);
});

test("OpenCode backlog-handoff-check tool returns markdown report", async () => {
	const { hooks } = await loadBacklogHandoffPlugin();
	const { currentProjectRoot } = await createWorkspace();
	const result = await hooks.tool["backlog-handoff-check"].execute({}, toolContext(currentProjectRoot));

	assert.match(result.output, /# Backlog Handoff Check/);
	assert.match(result.output, /Current project: frontend/);
	assert.match(result.output, /backend/);
	assert.equal(result.metadata.errorCount, 0);
});

test("OpenCode backlog-handoff-init tool bootstraps inbox and processed folders", async () => {
	const { hooks } = await loadBacklogHandoffPlugin();
	const root = await mkdtemp(path.join(os.tmpdir(), "opencode-backlog-handoff-init-"));
	const metaRoot = path.join(root, "meta");
	const projectRoot = path.join(metaRoot, "frontend");
	await mkdir(projectRoot, { recursive: true });

	const result = await hooks.tool["backlog-handoff-init"].execute(
		{
			projectId: "frontend",
			metaRoot: "..",
			description: "Frontend app. Owns UI flows and presentation logic.",
			overwrite: false,
		},
		toolContext(projectRoot),
	);

	assert.match(result.output, /Initialized backlog handoff/);
	assert.equal(await readFile(path.join(projectRoot, ".backlog-handoff", "inbox", ".gitkeep"), "utf8"), "");
	assert.equal(await readFile(path.join(projectRoot, ".backlog-handoff", "processed", ".gitkeep"), "utf8"), "");
	assert.equal(JSON.parse(await readFile(path.join(projectRoot, ".backlog-handoff", "config.json"), "utf8")).projectId, "frontend");
	assert.match(await readFile(path.join(metaRoot, ".backlog-handoff", "projects", "frontend.json"), "utf8"), /Frontend app/);
});

test("OpenCode system hook injects backlog-handoff target context", async () => {
	const { currentProjectRoot } = await createWorkspace();
	const pluginModule = await import(`${pathToFileURL(path.join(pluginSourceDir, "system.ts")).href}?ts=${Date.now()}`);
	const output = { system: [] };
	await pluginModule.appendBacklogHandoffSystemPrompt(output, currentProjectRoot);

	assert.equal(output.system.length, 1);
	assert.match(output.system[0], /Backlog handoff workspace/);
	assert.match(output.system[0], /backend: Backend API/);
	assert.match(output.system[0], /Use backlog-handoff only/);
});
