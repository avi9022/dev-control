import { getUpdateNotificationSettings } from "../storage/get-update-notification-settings.js"
import { store } from "../storage/store.js"

export const refuseUpdates = (): void => {
  const settings = getUpdateNotificationSettings()
  store.set('updateNotificationSettings', {
    ...settings,
    userRefusedUpdates: true
  })
}