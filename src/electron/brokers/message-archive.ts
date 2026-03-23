import { store } from '../storage/store.js'
import { MESSAGE_ARCHIVE_LIMIT } from '../../shared/constants.js'

export function archiveMessage(queueUrl: string, message: string): void {
  const archived = store.get('archivedMessages') || {}
  const queueMessages = archived[queueUrl] || []
  const newMessage: QueueMessage = {
    id: crypto.randomUUID(),
    queueUrl,
    createdAt: Date.now(),
    message
  }
  const updatedMessages = [newMessage, ...queueMessages].slice(0, MESSAGE_ARCHIVE_LIMIT)
  store.set('archivedMessages', {
    ...archived,
    [queueUrl]: updatedMessages
  })
}

export function getArchivedMessages(queueUrl: string): QueueMessage[] {
  const archived = store.get('archivedMessages') || {}
  return archived[queueUrl] || []
}
