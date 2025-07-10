import isPortReachable from "is-port-reachable";
import { store } from "../storage/store.js";
import { ipcWebContentsSend } from "../utils/ipc-handle.js";
import { BrowserWindow } from "electron";
import { updateDirectoryData } from "./update-directory-data.js";

const POLLING_INTERVAL = 500;

export const pollPorts = (mainWindow: BrowserWindow) => {
  setInterval(async () => {
    const directories = store.get('directories')
    const stateMap: DirectoryMapByState = {}

    const promises = directories.map(async ({ port, id, isInitializing }) => {
      let stateToSet: DirectoryState = 'UNKNOWN'
      if (port) {
        const isRunning = await isPortReachable(+port, { host: 'localhost' });

        if (!isRunning) {
          stateToSet = isInitializing ? 'INITIALIZING' : 'STOPPED'
        } else {
          if (isInitializing) {
            updateDirectoryData(id, { isInitializing: false })
          }

          stateToSet = 'RUNNING'
        }
      }

      stateMap[id] = stateToSet
    })

    await Promise.all(promises)
    ipcWebContentsSend('directoriesMapByState', mainWindow.webContents, stateMap);
  }, POLLING_INTERVAL);
}