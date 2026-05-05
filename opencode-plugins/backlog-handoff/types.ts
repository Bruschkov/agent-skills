// Shared backlog-handoff types for OpenCode plugin modules.
// These interfaces mirror the Pi extension registry and handoff payload shape.

export type BacklogHandoffLocalConfig = {
	projectId: string;
	metaRoot: string;
};

export type ProjectEntry = {
	id: string;
	path: string;
	description: string;
	owns?: string[];
	handoffDir?: string;
};

export type ProjectWithPath = ProjectEntry & {
	filePath: string;
	absolutePath: string;
};

export type LocalSetup = {
	localConfigPath: string;
	projectRoot: string;
	projectId: string;
	metaRoot: string;
	projectsDir: string;
};

export type RegistryContext = LocalSetup & {
	currentProject: ProjectWithPath;
	projects: Map<string, ProjectWithPath>;
};

export type ValidationIssue = {
	severity: "warning" | "error";
	message: string;
	projectId?: string;
	filePath?: string;
};

export type BacklogHandoffInput = {
	targetProject: string;
	title: string;
	rationale: string;
	requestedChange: string;
	constraints?: string;
	acceptanceCriteria: string[];
};

export type BacklogHandoffInitInput = {
	projectId?: string;
	metaRoot: string;
	description?: string;
	owns?: string[];
	handoffDir?: string;
	overwrite: boolean;
};
