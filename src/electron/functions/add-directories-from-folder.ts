import { dialog } from 'electron';
import fs from 'fs'
import path from 'path';
import { addDirectoryToStore } from '../utils/add-directory-to-store.js';
import { listDirectories } from '../utils/list-directories.js';

export const addDirectoriesFromFolder = async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'multiSelections'],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return
  }

  for (const currPath of result.filePaths) {
    const mainDirectoryPath = currPath;

    const packageJsonPath = path.join(mainDirectoryPath, "package.json");
    const packageJsonExists = fs.existsSync(packageJsonPath);

    if (packageJsonExists) {
      await addDirectoryToStore(mainDirectoryPath)
    } else {
      const subDirectories = listDirectories(mainDirectoryPath)

      for (const name of subDirectories) {
        const fullPath = path.join(mainDirectoryPath, name);
        const subPackageJsonPath = path.join(fullPath, "package.json");

        if (fs.existsSync(subPackageJsonPath)) {
          await addDirectoryToStore(fullPath)
        }
      }
    }
  }
}