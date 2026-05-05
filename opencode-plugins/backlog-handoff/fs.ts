// Filesystem helpers for backlog-handoff plugin code.
// Keeps JSON parsing, path checks, and safe write loops out of domain modules.

import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function pathExists(targetPath: string) {
	try {
		await fs.access(targetPath);
		return true;
	} catch {
		return false;
	}
}

export async function readJson<T>(filePath: string) {
	const content = await fs.readFile(filePath, "utf-8");
	return JSON.parse(content) as T;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringifyJson(value: unknown) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

export function errorToMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}

export async function writeNewFileWithSuffix(basePath: string, content: string) {
	const parsed = path.parse(basePath);
	for (let attempt = 0; attempt < 100; attempt += 1) {
		const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
		const candidate = path.join(parsed.dir, `${parsed.name}${suffix}${parsed.ext}`);
		try {
			await fs.writeFile(candidate, content, { encoding: "utf-8", flag: "wx" });
			return candidate;
		} catch (error) {
			const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
			if (code !== "EEXIST") {
				throw error;
			}
		}
	}
	throw new Error(`Could not create unique file path for ${basePath}.`);
}
