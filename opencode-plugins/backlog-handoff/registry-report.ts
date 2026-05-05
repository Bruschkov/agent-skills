// Formatting and health checks for backlog-handoff registry context.
// Produces prompt snippets and human-readable validation reports for OpenCode tools.

import * as path from "node:path";
import { pathExists } from "./fs.ts";
import type { ProjectEntry, RegistryContext, ValidationIssue } from "./types.ts";

export function formatOwns(project: ProjectEntry) {
	return project.owns && project.owns.length > 0 ? project.owns.join(", ") : "not specified";
}

export function getHandoffDir(project: ProjectEntry) {
	return project.handoffDir ?? ".backlog-handoff/inbox";
}

export async function collectValidationIssues(registry: RegistryContext) {
	const issues: ValidationIssue[] = [];
	await collectProjectIssues(registry, issues);
	collectOwnsCollisions(registry, issues);
	return issues;
}

export function formatWorkspacePrompt(registry: RegistryContext, issues: ValidationIssue[]) {
	const targets = Array.from(registry.projects.values()).filter((project) => project.id !== registry.currentProject.id);
	const targetLines = targets.length === 0 ? ["- none configured"] : targets.map(formatTargetPromptLine);
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
		"- Backlog-handoff creates landing-zone handoff files, not final backlog-md tickets.",
		"- Handoff files should explain trigger, requested change, constraints, and concrete acceptance criteria.",
		warningCount > 0 || errorCount > 0
			? `Registry health: ${errorCount} errors, ${warningCount} warnings. Use backlog-handoff-check if targeting seems ambiguous.`
			: "Registry health: no known validation issues.",
		"Use backlog-handoff only for work that belongs in another configured project. Use exact targetProject ids from the list above. Do not invent target ids or filesystem paths.",
	].join("\n");
}

export function buildValidationReport(registry: RegistryContext, issues: ValidationIssue[]) {
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
		...(targets.length === 0 ? ["- none configured"] : targets.map(formatTargetReportLine)),
		"",
		"## Quality guidance",
		"- Description: 1-2 sentences. State project purpose, boundary, and what belongs there.",
		"- Owns: optional short capability/domain hints like 'routes', 'auth', 'search ui', 'scraping'.",
		"- Avoid vague text like 'backend project', 'handles stuff', or TODO placeholders.",
		"- Handoffs land in a landing-zone inbox first, then can be converted into real backlog-md tickets later.",
		"",
		"## Validation summary",
		`- Errors: ${errors.length}`,
		`- Warnings: ${warnings.length}`,
		"",
		...(issues.length === 0 ? ["No validation issues found."] : issues.map(formatIssue)),
	].join("\n");
}

function formatTargetPromptLine(project: ProjectEntry) {
	return `- ${project.id}: ${project.description} Owns: ${formatOwns(project)}. Handoff inbox: ${getHandoffDir(project)}`;
}

function formatTargetReportLine(project: ProjectEntry & { absolutePath: string }) {
	return `- ${project.id}: ${project.description} Owns: ${formatOwns(project)}. Path: ${project.absolutePath}. Handoff inbox: ${getHandoffDir(project)}`;
}

function formatIssue(issue: ValidationIssue) {
	const prefix = issue.severity === "error" ? "ERROR" : "WARN";
	const target = issue.projectId ? ` [${issue.projectId}]` : "";
	const fileInfo = issue.filePath ? ` (${issue.filePath})` : "";
	return `- ${prefix}${target}: ${issue.message}${fileInfo}`;
}

async function collectProjectIssues(registry: RegistryContext, issues: ValidationIssue[]) {
	if (path.resolve(registry.projectRoot) !== path.resolve(registry.currentProject.absolutePath)) {
		issues.push({
			severity: "warning",
			message: `Local config points to current project '${registry.currentProject.id}', but registry path resolves to ${registry.currentProject.absolutePath} while current repo root is ${registry.projectRoot}.`,
			projectId: registry.currentProject.id,
			filePath: registry.localConfigPath,
		});
	}

	for (const project of registry.projects.values()) {
		if (!(await pathExists(project.absolutePath))) {
			issues.push({ severity: "warning", message: `Configured project path does not exist on this machine: ${project.absolutePath}`, projectId: project.id, filePath: project.filePath });
		}
		if (isGenericDescription(project.description)) {
			issues.push({ severity: "warning", message: "Project description is too generic. Describe project purpose, boundary, and what it owns.", projectId: project.id, filePath: project.filePath });
		}
	}
}

function collectOwnsCollisions(registry: RegistryContext, issues: ValidationIssue[]) {
	const ownsIndex = new Map<string, string[]>();
	for (const project of registry.projects.values()) {
		for (const ownsEntry of project.owns ?? []) {
			if (ownsEntry.toLowerCase().startsWith("todo")) {
				issues.push({ severity: "warning", message: `Owns entry '${ownsEntry}' still contains TODO placeholder text.`, projectId: project.id, filePath: project.filePath });
			}
			const key = ownsEntry.trim().toLowerCase();
			ownsIndex.set(key, [...(ownsIndex.get(key) ?? []), project.id]);
		}
	}
	for (const [ownsEntry, projectIds] of ownsIndex.entries()) {
		if (projectIds.length > 1) {
			issues.push({ severity: "warning", message: `Owns entry '${ownsEntry}' appears in multiple projects: ${projectIds.join(", ")}. This may make target selection ambiguous.` });
		}
	}
}

function isGenericDescription(description: string) {
	const normalized = description.trim().toLowerCase();
	const vaguePhrases = ["handles stuff", "project repo", "things", "misc", "miscellaneous", "backend project", "frontend project"];
	return normalized.length < 30 || normalized.startsWith("todo") || vaguePhrases.some((phrase) => normalized.includes(phrase));
}
