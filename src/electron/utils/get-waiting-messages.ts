import { ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { client } from "./sqs.js";
import { getCachedWaitingMessages } from "../storage/get-cached-waiting-messages.js";
import { store } from "../storage/store.js";

export const VISIBILITY_TIMEOUT_SECS = 60

export const getWaitingMessages = async (queueUrl: string): Promise<QueueMessage[]> => {
  const cache = getCachedWaitingMessages(queueUrl)
  if (cache) {
    return cache
  }
  const receiveMessageCommand = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    VisibilityTimeout: VISIBILITY_TIMEOUT_SECS,
    WaitTimeSeconds: 0,
    AttributeNames: ["All",]
  })
  let gotAllMessages = false
  const messagesToReturn: QueueMessage[] = []
  while (!gotAllMessages) {
    const result = await client.send(receiveMessageCommand);

    const messages = result.Messages || [];

    if (messages.length === 0) {
      console.log('Done scanning.');
      gotAllMessages = true
    }

    messages.forEach(({
      MessageId,
      ReceiptHandle,
      Body,
      Attributes
    }) => {
      messagesToReturn.push({
        attributes: Attributes ? Attributes : {},
        createdAt: +(Attributes?.SentTimestamp || 0),
        id: MessageId || '',
        message: Body || '',
        queueUrl,
        receiptHandle: ReceiptHandle
      })
    })

  }

  const cachedMessagesMap = store.get('waitingMessagesCache')
  cachedMessagesMap[queueUrl] = {
    createdAt: Date.now(),
    messages: messagesToReturn
  }
  store.set('waitingMessagesCache', cachedMessagesMap)

  return messagesToReturn
}