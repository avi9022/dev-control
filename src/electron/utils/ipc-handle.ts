import { ipcMain, IpcMainInvokeEvent, WebContents } from "electron"
import { validateEventFrame } from "./validate-event-frame.js"

export const ipcMainHandle = <Key extends keyof EventPayloadMapping>(
  key: Key,
  handler: (
    event: IpcMainInvokeEvent,
    ...args: EventPayloadMapping[Key]['args']
  ) => Promise<EventPayloadMapping[Key]['return']> | EventPayloadMapping[Key]['return']
) => {
  ipcMain.handle(key, (event, ...args) => {
    // ✅ Validate the event's frame before executing handler logic
    if (event.senderFrame) {
      validateEventFrame(event.senderFrame);
    } else {
      throw new Error('No main frame found');
    }

    // ✅ Call the typed handler with validated event + args
    return handler(event, ...(args as EventPayloadMapping[Key]['args']));
  });
};


export const ipcWebContentsSend = <Key extends keyof EventPayloadMapping>(
  key: Key,
  webContents: WebContents,
  payload: EventPayloadMapping[Key]['args'][0] // 👈 send the first argument
) => {
  webContents.send(key, payload);
};