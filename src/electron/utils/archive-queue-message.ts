import { getArchivedMessages } from "../storage/get-archived-messages.js"
import { store } from "../storage/store.js"

export const archiveQueueMessage = async (messageToArchive: QueueMessage) => {
  const { queueUrl } = messageToArchive
  const messagesMap = store.get('archivedMessages') || {}
  const messages = getArchivedMessages(queueUrl)

  if (!messages?.length) {
    messagesMap[queueUrl] = [messageToArchive]
    store.set('archivedMessages', messagesMap)
  } else {
    const newMessages = [messageToArchive, ...messages.slice(0, 4)]
    store.set('archivedMessages', {
      ...messagesMap,
      [queueUrl]: newMessages
    })
  }
}