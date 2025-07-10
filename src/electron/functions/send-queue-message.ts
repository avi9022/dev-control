import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { client } from '../utils/sqs.js';
import { archiveQueueMessage } from '../utils/archive-queue-message.js';

export const sendSqsMessage = async (queueUrl: string, message: string) => {
  const command = new SendMessageCommand({
    QueueUrl: queueUrl,
    MessageBody: message
  });

  try {
    const data = await client.send(command);
    archiveQueueMessage({
      queueUrl,
      createdAt: Date.now(),
      id: data.MessageId || '',
      message,
    })
  } catch (err) {
    console.error('❌ Failed to send', err);
  }
};
