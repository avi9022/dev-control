import isPortReachable from "is-port-reachable";
import { store } from "../storage/store.js";
import { ipcWebContentsSend } from "../utils/ipc-handle.js";
import { BrowserWindow } from "electron";
import { updateDirectoryData } from "./update-directory-data.js";
import { DirectoryStatus, PORT_POLL_INTERVAL_MS } from '../../shared/constants.js';

export const pollPorts = (mainWindow: BrowserWindow): NodeJS.Timeout => {
  return setInterval(async () => {
    const directories = store.get('directories')
    const stateMap: DirectoryMapByState = {}

    const promises = directories.map(async ({ port, id, isInitializing }) => {
      let stateToSet: DirectoryState = DirectoryStatus.Unknown
      if (port) {
        const isRunning = await isPortReachable(+port, { host: 'localhost' });

        if (!isRunning) {
          stateToSet = isInitializing ? DirectoryStatus.Initializing : DirectoryStatus.Stopped
        } else {
          if (isInitializing) {
            updateDirectoryData(id, { isInitializing: false })
          }

          stateToSet = DirectoryStatus.Running
        }
      }

      stateMap[id] = stateToSet
    })

    await Promise.all(promises)
    ipcWebContentsSend('directoriesMapByState', mainWindow.webContents, stateMap);
  }, PORT_POLL_INTERVAL_MS);
}