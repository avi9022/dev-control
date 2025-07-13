import { DeleteQueueCommand } from "@aws-sdk/client-sqs";
import { client } from "../utils/sqs.js";

export const deleteQueue = async (queueUrl: string) => {
  console.log('deleting queue', queueUrl);

  const command = new DeleteQueueCommand({
    QueueUrl: queueUrl
  });

  try {
    await client.send(command);
    console.log('Queue deleted');
  } catch (err) {
    console.error("Failed to delete queue:", err);
  }
};
