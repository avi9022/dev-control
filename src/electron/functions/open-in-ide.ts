import { execFile } from "child_process";
import { access } from "fs/promises";
import { platform } from "os";
import { getDirectoryById } from "../storage/get-directory-by-id.js";

interface AvailableIDE {
  name: string;
  command: string;
}

interface IDEDefinition {
  name: string;
  command: string;
  macAppPath: string;
}

const IDE_DEFINITIONS: IDEDefinition[] = [
  { name: "VS Code", command: "code", macAppPath: "/Applications/Visual Studio Code.app" },
  { name: "Cursor", command: "cursor", macAppPath: "/Applications/Cursor.app" },
  { name: "Windsurf", command: "windsurf", macAppPath: "/Applications/Windsurf.app" },
  { name: "Zed", command: "zed", macAppPath: "/Applications/Zed.app" },
];

const ALLOWED_COMMANDS = new Set(IDE_DEFINITIONS.map((ide) => ide.command));

async function existsOnDisk(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function getAvailableIDEs(): Promise<AvailableIDE[]> {
  const isMac = platform() === "darwin";

  const checks = IDE_DEFINITIONS.map(async (ide) => {
    if (isMac) {
      const exists = await existsOnDisk(ide.macAppPath);
      return exists ? { name: ide.name, command: ide.command } : null;
    }
    // Non-mac: fall back to checking if CLI command exists via `where`/`which`
    const exists = await existsOnDisk(`/usr/local/bin/${ide.command}`);
    return exists ? { name: ide.name, command: ide.command } : null;
  });

  const results = await Promise.all(checks);
  return results.filter((ide): ide is AvailableIDE => ide !== null);
}

export function openInIDE(id: string, cliCommand: string) {
  if (!ALLOWED_COMMANDS.has(cliCommand)) {
    return;
  }

  const directory = getDirectoryById(id);
  if (!directory) {
    return;
  }

  execFile(cliCommand, [directory.path], (error) => {
    if (error) {
      console.error(`Failed to open IDE (${cliCommand}): ${error.message}`);
    }
  });
}
