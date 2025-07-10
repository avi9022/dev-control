import { listQueues } from "../sqs/list-queues.js";
import { ipcWebContentsSend } from "../utils/ipc-handle.js";
import { BrowserWindow } from "electron";

const POLLING_INTERVAL = 500;

export const pollQueues = (mainWindow: BrowserWindow) => {
  setInterval(async () => {
    const queues = await listQueues()
    ipcWebContentsSend('queuesList', mainWindow.webContents, queues || []);
  }, POLLING_INTERVAL);
}