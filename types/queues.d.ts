interface QueueMessage {
  id: string
  queueUrl: string
  createdAt: number
  message: string
  receiptHandle?: string,
  attributes?: {
    AWSTraceHeader?: string
    All?: string
    ApproximateFirstReceiveTimestamp?: string
    ApproximateReceiveCount?: string
    DeadLetterQueueSourceArn?: string
    MessageDeduplicationId?: string
    MessageGroupId?: string
    SenderId?: string
    SentTimestamp?: string
    SequenceNumber?: string
  }
}

type QueueMessageMapByQueue = Record<string, QueueMessage[]>

interface QueueSettings {
  funcName: string
  funcAlias: string
  offlineSqsEndpoint: string
}

interface CreateQueueOptions {
  delaySeconds?: number;                  // Default delay for messages
  visibilityTimeout?: number;            // Time a message is invisible after being received
  messageRetentionPeriod?: number;       // How long to keep messages (in seconds)
  maxMessageSize?: number;               // Max size in bytes (1024 - 262144)
  receiveMessageWaitTimeSeconds?: number; // For long polling
  fifoQueue?: boolean;                   // True for FIFO queue
  contentBasedDeduplication?: boolean;   // Auto deduplication (FIFO only)
  deadLetterTargetArn?: string;          // DLQ target
  maxReceiveCount?: number;              // For DLQ redrive policy
  tags?: Record<string, string>;         // Optional metadata tags
}

interface QueueData {
  lastFiveMessages: QueueMessage[],
  waitingMessages: QueueMessage[],
  queueAttributes: Partial<Record<QueueAttributeName, string>>
}
