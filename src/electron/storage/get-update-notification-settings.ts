import { store } from "./store.js"

export const getUpdateNotificationSettings = (): UpdateNotificationSettings => {
  return store.get('updateNotificationSettings')
}