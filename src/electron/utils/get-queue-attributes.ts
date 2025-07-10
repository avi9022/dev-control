import { GetQueueAttributesCommand, QueueAttributeName } from "@aws-sdk/client-sqs"
import { client } from "./sqs.js"

export const getQueueAttributes = async (queueUrl: string): Promise<Partial<Record<QueueAttributeName, string>>> => {
  const command = new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['All']
  })

  const attributes = await client.send(command)
  return attributes.Attributes || {}
}