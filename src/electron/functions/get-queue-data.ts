import { getArchivedMessages } from "../storage/get-archived-messages.js"
import { getQueueAttributes } from "../utils/get-queue-attributes.js"
import { getWaitingMessages } from "../utils/get-waiting-messages.js"

export const getQueueData = async (queueUrl: string) => {
  const queueAttributes = await getQueueAttributes(queueUrl)
  const waitingMessages = await getWaitingMessages(queueUrl)
  const lastFiveMessages = getArchivedMessages(queueUrl)

  return {
    lastFiveMessages,
    waitingMessages,
    queueAttributes
  }
}