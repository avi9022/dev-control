import { getDirectoryById } from "../storage/get-directory-by-id.js"
import { shell } from 'electron';

export const openProjectInBrowser = (id: string): void => {
  const directory = getDirectoryById(id)
  if (!directory?.port) return
  shell.openExternal(`http://localhost:${directory.port}`);
}