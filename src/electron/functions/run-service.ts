import { ChildProcess, spawn } from 'child_process';
import treeKill from 'tree-kill';
import { ipcWebContentsSend } from '../utils/ipc-handle.js';
import { BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { getDirectoryById } from '../storage/get-directory-by-id.js';
import { updateDirectoryData } from './update-directory-data.js';

const runningProcesses = new Map<string, ChildProcess>();

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
  });

  child.stderr.on('data', (data) => {
    const line = data.toString();
    ipcWebContentsSend('logs', mainWindow.webContents, { dirId: id, line });
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
