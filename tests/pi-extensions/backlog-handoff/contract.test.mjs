import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
const extensionSourcePath = path.join(repoRoot, "pi-extensions", "backlog-handoff", "index.ts");

let cachedHarnessPromise;

function getPiInstallPaths() {
	const npmRoot = execFileSync("npm", ["root", "-g"], { encoding: "utf8" }).trim();
	const piRoot = path.join(npmRoot, "@mariozechner", "pi-coding-agent");
	return {
		piRoot,
		piEntry: pathToFileURL(path.join(piRoot, "dist", "index.js")).href,
		typeboxEntry: pathToFileURL(path.join(piRoot, "node_modules", "typebox", "build", "index.mjs")).href,
		aiEntry: pathToFileURL(path.join(piRoot, "node_modules", "@mariozechner", "pi-ai", "dist", "index.js")).href,
		wrapEntry: pathToFileURL(path.join(piRoot, "dist", "core", "tools", "tool-definition-wrapper.js")).href,
	};
}

async function createBacklogHandoffHarness(options = {}) {
	const { execImpl } = options;
	const { piEntry, typeboxEntry, aiEntry, wrapEntry } = getPiInstallPaths();
	const source = await readFile(extensionSourcePath, "utf8");
	const patchedSource = source
		.replace('from "@mariozechner/pi-coding-agent"', `from ${JSON.stringify(piEntry)}`)
		.replace('from "typebox"', `from ${JSON.stringify(typeboxEntry)}`);
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "backlog-handoff-test-module-"));
	const tempModulePath = path.join(tempDir, "index.ts");
	await writeFile(tempModulePath, patchedSource, "utf8");

	const extensionModule = await import(`${pathToFileURL(tempModulePath).href}?ts=${Date.now()}`);
	const { validateToolArguments } = await import(aiEntry);
	const { wrapToolDefinition } = await import(wrapEntry);

	let tool;
	const commands = new Map();
	extensionModule.default({
		on() {},
		async exec(...args) {
			if (execImpl) {
				return execImpl(...args);
			}
			return { code: 1, stdout: "", stderr: "" };
		},
		registerCommand(name, definition) {
			commands.set(name, definition);
		},
		registerTool(definition) {
			tool = definition;
		},
	});

	assert.ok(tool, "Extension did not register backlog-handoff tool");
	return { tool, commands, validateToolArguments, wrapToolDefinition };
}

async function loadBacklogHandoffHarness(options = {}) {
	if (options.execImpl) {
		return createBacklogHandoffHarness(options);
	}

	cachedHarnessPromise ??= createBacklogHandoffHarness();
	return cachedHarnessPromise;
}

async function createWorkspace() {
	const root = await mkdtemp(path.join(os.tmpdir(), "backlog-handoff-workspace-"));
	const metaRoot = path.join(root, "meta");
	const currentProjectRoot = path.join(metaRoot, "frontend");
	const targetProjectRoot = path.join(metaRoot, "backend");
	const registryDir = path.join(metaRoot, ".backlog-handoff", "projects");
	const currentConfigDir = path.join(currentProjectRoot, ".backlog-handoff");

	await mkdir(currentConfigDir, { recursive: true });
	await mkdir(registryDir, { recursive: true });
	await mkdir(targetProjectRoot, { recursive: true });

	await writeFile(
		path.join(currentConfigDir, "config.json"),
		JSON.stringify({ projectId: "frontend", metaRoot: ".." }, null, 2),
		"utf8",
	);
	await writeFile(
		path.join(registryDir, "frontend.json"),
		JSON.stringify(
			{
				id: "frontend",
				path: "./frontend",
				description: "Frontend app. Owns UI flows, forms, and presentation logic.",
			},
			null,
			2,
		),
		"utf8",
	);
	await writeFile(
		path.join(registryDir, "backend.json"),
		JSON.stringify(
			{
				id: "backend",
				path: "./backend",
				description: "Backend API. Owns routes, persistence, and background jobs.",
			},
			null,
			2,
		),
		"utf8",
	);

	const validPayload = {
		targetProject: "backend",
		title: "Add retry metadata endpoint",
		rationale: "Backend owns retry persistence; issue found while wiring frontend error handling.",
		requestedChange: "Expose retry metadata for failed jobs and store retry timestamps.",
		constraints: "No frontend changes in this task.",
		acceptanceCriteria: [
			"Retry metadata endpoint exists and is authenticated.",
			"Retry timestamps are persisted for failed jobs.",
		],
	};

	return { currentProjectRoot, targetProjectRoot, validPayload };
}

test("backlog-handoff accepts flat payload and writes handoff file", async () => {
	const { tool, validateToolArguments, wrapToolDefinition } = await loadBacklogHandoffHarness();
	const { currentProjectRoot, targetProjectRoot, validPayload } = await createWorkspace();
	const wrappedTool = wrapToolDefinition(tool, () => ({ cwd: currentProjectRoot }));

	const validatedArgs = validateToolArguments(wrappedTool, {
		id: "call-flat-success",
		name: "backlog-handoff",
		arguments: validPayload,
	});

	assert.deepEqual(validatedArgs, validPayload);

	const result = await wrappedTool.execute("call-flat-success", validatedArgs);
	assert.equal(result.details.targetProject, "backend");
	assert.equal(result.details.originProject, "frontend");
	assert.match(result.content[0].text, /Created backlog-handoff file/);

	const inboxDir = path.join(targetProjectRoot, ".backlog-handoff", "inbox");
	const inboxFiles = await readdir(inboxDir);
	assert.equal(inboxFiles.length, 1);
	const handoffFilePath = path.join(inboxDir, inboxFiles[0]);
	const handoffContent = await readFile(handoffFilePath, "utf8");

	assert.match(handoffContent, /^---$/m);
	assert.match(handoffContent, /origin_project: "frontend"/);
	assert.match(handoffContent, /target_project: "backend"/);
	assert.match(handoffContent, /# Add retry metadata endpoint/);
	assert.match(handoffContent, /## Why this is a handoff/);
	assert.match(handoffContent, /## Requested Change/);
	assert.match(handoffContent, /## Acceptance Criteria/);
	assert.match(handoffContent, /- \[ \] Retry metadata endpoint exists and is authenticated\./);
	assert.match(handoffContent, /- \[ \] Retry timestamps are persisted for failed jobs\./);
});

test("backlog-handoff-init bootstraps processed folder alongside inbox", async () => {
	const { commands } = await loadBacklogHandoffHarness();
	const initCommand = commands.get("backlog-handoff-init");
	assert.ok(initCommand, "Extension did not register backlog-handoff-init command");

	const root = await mkdtemp(path.join(os.tmpdir(), "backlog-handoff-init-workspace-"));
	const metaRoot = path.join(root, "meta");
	const projectRoot = path.join(metaRoot, "frontend");
	const notifications = [];

	await mkdir(projectRoot, { recursive: true });

	await initCommand.handler({}, {
		cwd: projectRoot,
		hasUI: true,
		ui: {
			async input(label) {
				return label === "Project id" ? "frontend" : "..";
			},
			async editor() {
				return JSON.stringify(
					{
						id: "frontend",
						path: "./frontend",
						description: "Frontend app. Owns UI flows and presentation logic.",
					},
					null,
					2,
				);
			},
			async confirm() {
				return true;
			},
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	});

	assert.equal(await readFile(path.join(projectRoot, ".backlog-handoff", "inbox", ".gitkeep"), "utf8"), "");
	assert.equal(await readFile(path.join(projectRoot, ".backlog-handoff", "processed", ".gitkeep"), "utf8"), "");
	assert.equal(
		JSON.parse(await readFile(path.join(projectRoot, ".backlog-handoff", "config.json"), "utf8")).projectId,
		"frontend",
	);
	assert.ok(notifications.some(({ message, level }) => level === "success" && /Initialized backlog handoff/.test(message)));
});

test("backlog-handoff-init pre-fills project entry with generated description when available", async () => {
	const { commands } = await loadBacklogHandoffHarness({
		execImpl: async (command) => {
			if (command === "git") {
				return { code: 1, stdout: "", stderr: "" };
			}
			return {
				code: 0,
				stdout:
					JSON.stringify({
						type: "message_end",
						message: {
							role: "assistant",
							content: [
								{
									type: "text",
									text: '{"description":"Frontend billing app. Owns checkout UI, customer billing pages, and browser-side payment flows."}',
								},
							],
						},
					}) + "\n",
				stderr: "",
			};
		},
	});
	const initCommand = commands.get("backlog-handoff-init");
	assert.ok(initCommand, "Extension did not register backlog-handoff-init command");

	const root = await mkdtemp(path.join(os.tmpdir(), "backlog-handoff-init-generated-description-"));
	const metaRoot = path.join(root, "meta");
	const projectRoot = path.join(metaRoot, "frontend");
	let editorInitialContent = "";

	await mkdir(projectRoot, { recursive: true });

	await initCommand.handler({}, {
		cwd: projectRoot,
		hasUI: true,
		ui: {
			async input(label) {
				return label === "Project id" ? "frontend" : "..";
			},
			async editor(_title, content) {
				editorInitialContent = content;
				return content;
			},
			async confirm() {
				return true;
			},
			notify() {},
		},
	});

	assert.match(editorInitialContent, /"description": "Frontend billing app\. Owns checkout UI, customer billing pages, and browser-side payment flows\."/);
});

test("backlog-handoff-init warns when description draft times out and keeps placeholder", async () => {
	const { commands } = await loadBacklogHandoffHarness({
		execImpl: async (command) => {
			if (command === "git") {
				return { code: 1, stdout: "", stderr: "" };
			}
			return { code: 0, stdout: "", stderr: "", killed: true };
		},
	});
	const initCommand = commands.get("backlog-handoff-init");
	assert.ok(initCommand, "Extension did not register backlog-handoff-init command");

	const root = await mkdtemp(path.join(os.tmpdir(), "backlog-handoff-init-description-timeout-"));
	const metaRoot = path.join(root, "meta");
	const projectRoot = path.join(metaRoot, "frontend");
	const notifications = [];
	let editorInitialContent = "";

	await mkdir(projectRoot, { recursive: true });

	await initCommand.handler({}, {
		cwd: projectRoot,
		hasUI: true,
		ui: {
			async input(label) {
				return label === "Project id" ? "frontend" : "..";
			},
			async editor(_title, content) {
				editorInitialContent = content;
				return content;
			},
			async confirm() {
				return true;
			},
			notify(message, level) {
				notifications.push({ message, level });
			},
		},
	});

	assert.match(editorInitialContent, /"description": "TODO: Replace with 1-2 sentences describing this project and what work belongs here\."/);
	assert.ok(
		notifications.some(({ message, level }) => level === "warning" && /timed out after 60s/.test(message)),
	);
});

test("backlog-handoff rejects actually invalid flat payloads at validation time", async () => {
	const { tool, validateToolArguments, wrapToolDefinition } = await loadBacklogHandoffHarness();
	const { currentProjectRoot } = await createWorkspace();
	const wrappedTool = wrapToolDefinition(tool, () => ({ cwd: currentProjectRoot }));

	assert.throws(
		() =>
			validateToolArguments(wrappedTool, {
				id: "call-invalid-missing-field",
				name: "backlog-handoff",
				arguments: {
					targetProject: "backend",
					title: "Missing acceptance criteria",
					rationale: "Still a handoff",
					requestedChange: "Do the work",
				},
			}),
		(error) => {
			assert.match(error.message, /Validation failed for tool "backlog-handoff"/);
			assert.match(error.message, /acceptanceCriteria/);
			return true;
		},
	);
});

test("backlog-handoff rejects wrapped { input } payload so validator and handler stay consistent", async () => {
	const { tool, validateToolArguments, wrapToolDefinition } = await loadBacklogHandoffHarness();
	const { currentProjectRoot, validPayload } = await createWorkspace();
	const wrappedTool = wrapToolDefinition(tool, () => ({ cwd: currentProjectRoot }));

	assert.throws(
		() =>
			validateToolArguments(wrappedTool, {
				id: "call-wrapped-input",
				name: "backlog-handoff",
				arguments: { input: validPayload },
			}),
		(error) => {
			assert.match(error.message, /Validation failed for tool "backlog-handoff"/);
			assert.match(error.message, /targetProject/);
			return true;
		},
	);
});
