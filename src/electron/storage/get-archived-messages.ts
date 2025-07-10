import { store } from "./store.js"

export const getArchivedMessages = (queueUrl: string): QueueMessage[] => {
  const messagesMap = store.get('archivedMessages')
  const messages = messagesMap[queueUrl]

  return messages || []
}