import { ChildProcess, spawn } from 'child_process';
import treeKill from 'tree-kill';
import { ipcWebContentsSend } from '../utils/ipc-handle.js';
import { BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { getDirectoryById } from '../storage/get-directory-by-id.js';
import { updateDirectoryData } from './update-directory-data.js';
import { appendLogToFile } from '../utils/log-file-manager.js';

export const runningProcesses = new Map<string, ChildProcess>();

/**
 * Stops all running service processes - call this on app quit
 */
export const stopAllProcesses = (): Promise<void[]> => {
  const stopPromises: Promise<void>[] = [];

  for (const [id, process] of runningProcesses.entries()) {
    if (process && process.pid !== undefined) {
      stopPromises.push(
        new Promise<void>((resolve) => {
          treeKill(process.pid!, 'SIGTERM', (err) => {
            if (err) {
              // Force kill if SIGTERM fails
              treeKill(process.pid!, 'SIGKILL', () => resolve());
            } else {
              resolve();
            }
            runningProcesses.delete(id);
          });
        })
      );
    }
  }

  return Promise.all(stopPromises);
};

export const runService = (
  id: string,
  mainWindow: BrowserWindow
) => {
  if (runningProcesses.has(id)) {
    stopProcess(id)
  }

  const currDirectory = getDirectoryById(id)

  if (!currDirectory) {
    throw new Error('Directory was not found')
  }

  updateDirectoryData(id, { isInitializing: true })

  const child = spawn(currDirectory.runCommand || '', [], {
    cwd: currDirectory.path,
    shell: true,
    env: process.env,
  });

  runningProcesses.set(id, child);

  child.stdout.on('data', (data) => {
    const line = data.toString();
    ipcWebContentsSend('logs', mainWindow.webContents, { dirId: id, line });
    // Persist to file (non-blocking)
    appendLogToFile(id, line).catch((error) => {
      console.error(`Failed to write log to file for ${id}:`, error);
    });
  });

  child.stderr.on('data', (data) => {
    const line = data.toString();
    ipcWebContentsSend('logs', mainWindow.webContents, { dirId: id, line });
    // Persist to file (non-blocking)
    appendLogToFile(id, line).catch((error) => {
      console.error(`Failed to write log to file for ${id}:`, error);
    });
  });

  child.on('exit', (code) => {
    console.log(`Process exited with code ${code}`);
  });
};

export const stopProcess = (id: string) => {
  const process = runningProcesses.get(id);

  if (!process || process.pid === undefined) {
    console.log('Process not found or has no PID. Attempting to kill port 3000');
    const service = getDirectoryById(id)

    if (!service || !service.port) {
      console.log('Directory not found');
      return
    }

    exec(`lsof -ti:${service.port} | xargs kill -9`, (err) => {
      if (err) {
        console.error('Failed to kill process on port 3000:', err.message || err);
      } else {
        console.log('Process on port 3000 killed successfully');
      }
    });
    updateDirectoryData(id, { isInitializing: false })
    return;
  }

  treeKill(process.pid, 'SIGKILL', (err) => {
    if (err) {
      console.error(`Failed to kill process ${id}`, err);
    } else {
      updateDirectoryData(id, { isInitializing: false })
      runningProcesses.delete(id);
    }
  });
};
