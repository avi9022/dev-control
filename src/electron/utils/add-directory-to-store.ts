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

  if (fs.existsSync(packageJsonPath)) {
    packageJsonExists = true;

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));


      if (packageJson.scripts) {
        const script = localScriptsPriority.find((script) => packageJson.scripts[script])
        runCommand = script ? `npm run ${script}` : undefined;
      }
    } catch (error) {
      console.warn(`Failed to parse package.json in ${dirPath}:`, error);
      runCommand = `npm run dev`;
    }
  }

  const id = Buffer.from(dirPath).toString('base64');
  const nameToSave = name.replaceAll('-', ' ').replace(name.charAt(0), name.charAt(0).toUpperCase())
  let isFrontendProj = false
  if (packageJsonExists) {
    isFrontendProj = isFrontendProject(dirPath)
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