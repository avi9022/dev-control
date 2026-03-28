import { exec } from 'child_process';
import util from 'util';
import { store } from '../storage/store.js';
import { getUpdateNotificationSettings } from '../storage/get-update-notification-settings.js';

const execAsync = util.promisify(exec);

const POLLING_INTERVAL_MS = 600_000; // 10 minutes
const BEHIND_REMOTE_INDICATOR = 'Your branch is behind';

export const pollUpdates = (): void => {
  setInterval(async () => {
    const settings = getUpdateNotificationSettings()

    try {
      await execAsync('git fetch');
      const { stdout } = await execAsync('git status -uno');
      console.log(stdout);

      const hasUpdates = stdout.includes(BEHIND_REMOTE_INDICATOR);

      if (hasUpdates) {
        store.set('updateNotificationSettings', {
          hasUpdates,
          userWasPrompted: false,
          userRefusedUpdates: settings.userRefusedUpdates
        })
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }, POLLING_INTERVAL_MS);
}
