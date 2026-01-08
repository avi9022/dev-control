import { store } from "../storage/store.js"
import { deleteLogFile } from "../utils/log-file-manager.js"

export const removeDirectory = async (id?: string) => {
  if (id) {
    // Clean up log file for this directory
    await deleteLogFile(id)
    
    const directories = store.get('directories')
    const indexToRemove = directories.findIndex(({ id: currId }) => currId === id)
    directories.splice(indexToRemove, 1)
    store.set('directories', directories)
  } else {
    // If removing all directories, clean up all log files
    const directories = store.get('directories')
    await Promise.all(directories.map((dir) => deleteLogFile(dir.id)))
    
    store.set('directories', [])
  }
}