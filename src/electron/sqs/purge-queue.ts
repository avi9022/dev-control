import { PurgeQueueCommand } from "@aws-sdk/client-sqs";
import { client } from "../utils/sqs.js";

export const purgeQueue = async (queueUrl: string) => {
  console.log('purging', queueUrl);

  const command = new PurgeQueueCommand({
    QueueUrl: queueUrl,
  });

  try {
    await client.send(command);
  } catch (err) {
    console.error("Failed to purge queue:", err);
  }
};
