import { store } from "../storage/store.js"
import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

export const updateSystem = async () => {
  try {
    await execAsync('git pull');
    store.set('updateNotificationSettings', {
      hasUpdates: false,
      useWasPrompted: false,
      userRefusedUpdates: false
    })
  } catch (error) {
    console.error('❌ Git pull failed:', error);
  }
}