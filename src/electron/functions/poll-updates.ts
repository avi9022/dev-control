import { exec } from 'child_process';
import util from 'util';
import { store } from '../storage/store.js';
import { getUpdateNotificationSettings } from '../storage/get-update-notification-settings.js';

const execAsync = util.promisify(exec);


const POLLING_INTERVAL = 1000; // 10 minutes
// const POLLING_INTERVAL = 1000 * 60 * 10; // 10 minutes

export const pollUpdates = () => {
  setInterval(async () => {
    const settings = getUpdateNotificationSettings()


    try {
      await execAsync('git fetch');
      const { stdout } = await execAsync('git status -uno');
      console.log(stdout);

      const hasUpdates = stdout.includes('Your branch is behind');

      if (hasUpdates) {
        store.set('updateNotification', {
          hasUpdates,
          userWasPrompted: false,
          userRefusedUpdates: settings.userRefusedUpdates
        })
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      return false;
    }
  }, POLLING_INTERVAL);
}