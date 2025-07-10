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

  result.filePaths.forEach((currPath) => {
    const mainDirectoryPath = currPath;

    const packageJsonPath = path.join(mainDirectoryPath, "package.json");
    const packageJsonExists = fs.existsSync(packageJsonPath);

    if (packageJsonExists) {
      addDirectoryToStore(mainDirectoryPath)
    } else {
      const subDirectories = listDirectories(mainDirectoryPath)

      subDirectories.forEach((name) => {
        const fullPath = path.join(mainDirectoryPath, name);
        const packageJsonPath = path.join(fullPath, "package.json");

        if (fs.existsSync(packageJsonPath)) {
          addDirectoryToStore(fullPath)
        }
      })
    }
  })
}