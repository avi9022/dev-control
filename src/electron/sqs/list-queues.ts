import { ListQueuesCommand } from "@aws-sdk/client-sqs";
import { client } from "../utils/sqs.js";

export const listQueues = async () => {
  try {
    const command = new ListQueuesCommand();
    const response = await client.send(command);
    return response.QueueUrls
  } catch (err) {
    console.error("Error listing queues:", err);
  }
}