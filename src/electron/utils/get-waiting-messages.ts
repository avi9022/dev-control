import { ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import { client } from "./sqs.js";

export const VISIBILITY_TIMEOUT_SECS = 3
export const MAX_TRIES = 10

export const getWaitingMessages = async (queueUrl: string): Promise<QueueMessage[]> => {
  const receiveMessageCommand = new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    VisibilityTimeout: VISIBILITY_TIMEOUT_SECS,
    WaitTimeSeconds: 0,
    AttributeNames: ["All",]
  })
  let gotAllMessages = false
  const messagesToReturn: QueueMessage[] = []
  let currentTry = 1
  while (!gotAllMessages) {
    const result = await client.send(receiveMessageCommand);

    const messages = result.Messages || [];

    if (messages.length === 0) {
      gotAllMessages = true
    } else if (currentTry === MAX_TRIES) {
      console.log('Got to max tries, ending fetch');
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
    currentTry++
  }

  const { finalMessages } = messagesToReturn.reduce<{
    idsMap: Record<string, boolean>,
    finalMessages: QueueMessage[]
  }>((acc, message) => {
    if (!acc.idsMap[message.id]) {
      acc.idsMap[message.id] = true
      acc.finalMessages.push(message)
    }
    return acc
  }, {
    idsMap: {},
    finalMessages: []
  })

  return finalMessages
}