import fs from 'fs'
import path from 'path'

export const listDirectories = (dirPath: string): string[] => {
  return fs.readdirSync(dirPath).filter((entry) => {
    const fullPath = path.join(dirPath, entry);
    return fs.statSync(fullPath).isDirectory();
  });
}