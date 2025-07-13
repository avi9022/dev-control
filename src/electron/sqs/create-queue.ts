import { CreateQueueCommand } from "@aws-sdk/client-sqs";
import { client } from "../utils/sqs.js";

export const createQueue = async (
  queueName: string,
  options: CreateQueueOptions = {}
): Promise<string | undefined> => {
  console.log("creating queue", queueName);

  const isFifo = options.fifoQueue ?? queueName.endsWith(".fifo");
  const attributes: Record<string, string> = {
    DelaySeconds: String(options.delaySeconds ?? 0),
    VisibilityTimeout: String(options.visibilityTimeout ?? 30),
    MessageRetentionPeriod: String(options.messageRetentionPeriod ?? 345600), // 4 days
    MaximumMessageSize: String(options.maxMessageSize ?? 262144), // 256 KB
    ReceiveMessageWaitTimeSeconds: String(options.receiveMessageWaitTimeSeconds ?? 0),
  };

  if (isFifo) {
    attributes.FifoQueue = "true";
    attributes.ContentBasedDeduplication = String(options.contentBasedDeduplication ?? true);
  }

  if (options.deadLetterTargetArn && options.maxReceiveCount) {
    attributes.RedrivePolicy = JSON.stringify({
      deadLetterTargetArn: options.deadLetterTargetArn,
      maxReceiveCount: options.maxReceiveCount,
    });
  }

  const command = new CreateQueueCommand({
    QueueName: queueName,
    Attributes: attributes,
    tags: options.tags,
  });

  try {
    const result = await client.send(command);
    console.log("Queue created:", result.QueueUrl);
    return result.QueueUrl;
  } catch (err) {
    console.error("Failed to create queue:", err);
  }
};
