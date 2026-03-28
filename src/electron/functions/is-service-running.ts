import isPortReachable from 'is-port-reachable';
import { getDirectoryById } from '../storage/get-directory-by-id.js';
import { updateDirectoryData } from './update-directory-data.js';
import { DirectoryStatus } from '../../shared/constants.js';

export const isServiceRunning = async (id: string): Promise<DirectoryState> => {
  const directory = getDirectoryById(id)
  if (!directory) {
    throw new Error('Directory not found')
  }

  if (!directory.port) return DirectoryStatus.Unknown

  const isRunning = await isPortReachable(+directory.port, { host: 'localhost' });

  if (!isRunning) {
    return directory.isInitializing ? DirectoryStatus.Initializing : DirectoryStatus.Stopped
  }

  if (directory.isInitializing) {
    updateDirectoryData(id, { isInitializing: false })
  }

  return DirectoryStatus.Running
};