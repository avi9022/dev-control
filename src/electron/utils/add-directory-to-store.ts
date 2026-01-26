import path from "path";
import fs from 'fs'
import { store } from "../storage/store.js";
import { isFrontendProject } from "./check-is-frontend-proj.js";

const localScriptsPriority = ["dev", "start", "serve", "develop", "local", "watch"];
export const addDirectoryToStore = async (dirPath: string) => {
  const directories = store.get('directories') || [];
  const existingDirectory = directories.find(({ path }) => path === dirPath)
  if (existingDirectory) {
    return
  }

  const name = dirPath.split('/').pop() || 'UNNAMED'
  const packageJsonPath = path.join(dirPath, "package.json");

  let packageJsonExists = false;
  let runCommand: string | undefined = undefined;

  try {
    const packageJsonContent = await fs.promises.readFile(packageJsonPath, "utf-8");
    packageJsonExists = true;
    const packageJson = JSON.parse(packageJsonContent);

    if (packageJson.scripts) {
      const script = localScriptsPriority.find((script) => packageJson.scripts[script])
      runCommand = script ? `npm run ${script}` : undefined;
    }
  } catch {
    // Package.json doesn't exist or can't be parsed
    packageJsonExists = false;
  }

  const id = Buffer.from(dirPath).toString('base64');
  const nameToSave = name.replaceAll('-', ' ').replace(name.charAt(0), name.charAt(0).toUpperCase())
  let isFrontendProj = false
  if (packageJsonExists) {
    isFrontendProj = await isFrontendProject(dirPath)
  }

  const newDirectory: DirectorySettings = {
    id,
    path: dirPath,
    name: nameToSave,
    packageJsonExists,
    runCommand,
    isFrontendProj,
  };

  directories.push(newDirectory)
  store.set('directories', directories)
}