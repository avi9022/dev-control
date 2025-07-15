import { BrowserWindow } from "electron";
import { getWorkflowById } from "../storage/get-workflow-by-id.js";
import { runService } from "./run-service.js";
import { getDirectoryById } from "../storage/get-directory-by-id.js";
import isPortReachable from "is-port-reachable";

export const startWorkflow = async (id: string, mainWindow: BrowserWindow) => {
  const workflow = getWorkflowById(id)

  if (!workflow) {
    console.log('Workflow not found');
    return
  }

  const promises = workflow.services.map(async (serviceId) => {
    const service = getDirectoryById(serviceId)
    if (service?.port) {
      const isRunning = await isPortReachable(+service?.port, { host: 'localhost' });

      if (isRunning) {
        console.log('Service is already running');
        return
      }

    }
    runService(serviceId, mainWindow)
  })

  Promise.all(promises)
}