import { exec } from "child_process";
import { getDirectoryById } from "../storage/get-directory-by-id.js";

export function openInVSCode(id: string) {
  const directory = getDirectoryById(id)
  if (!directory) {
    return
  }
  exec(`code "${directory.path}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Failed to open VS Code: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`VS Code stderr: ${stderr}`);
      return;
    }
    console.log(`VS Code stdout: ${stdout}`);
  });
}