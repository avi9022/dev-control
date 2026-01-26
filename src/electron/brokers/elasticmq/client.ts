import {
  SQSClient,
  ListQueuesCommand,
  CreateQueueCommand,
  DeleteQueueCommand,
  PurgeQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  GetQueueAttributesCommand,
  QueueAttributeName
} from "@aws-sdk/client-sqs"
import { BrokerClient } from "../types.js"
import { store } from "../../storage/store.js"

export class ElasticMQClient implements BrokerClient {
  readonly type = 'elasticmq' as const
  private client: SQSClient
  private config: BrokerConfig

  constructor(config: BrokerConfig) {
    this.config = config
    this.client = this.createSQSClient(config)
  }

  private createSQSClient(config: BrokerConfig): SQSClient {
    const protocol = config.useHttps ? 'https' : 'http'
    return new SQSClient({
      region: "eu-west-1",
      endpoint: `${protocol}://${config.host}:${config.port}`,
      credentials: {
        accessKeyId: config.username,
        secretAccessKey: config.password,
      },
    })
  }

  updateConfig(config: BrokerConfig): void {
    this.config = config
    this.client = this.createSQSClient(config)
  }

  async testConnection(): Promise<BrokerConnectionState> {
    try {
      await this.client.send(new ListQueuesCommand({}))
      return {
        type: 'elasticmq',
        isConnected: true,
        lastChecked: Date.now()
      }
    } catch (error) {
      return {
        type: 'elasticmq',
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: Date.now()
      }
    }
  }

  async listQueues(): Promise<string[]> {
    try {
      const response = await this.client.send(new ListQueuesCommand({}))
      return response.QueueUrls || []
    } catch (error) {
      console.error("ElasticMQ: Error listing queues:", error)
      return []
    }
  }

  async createQueue(name: string, options: CreateQueueOptions = {}): Promise<string | undefined> {
    const isFifo = options.fifoQueue ?? name.endsWith(".fifo")
    const attributes: Record<string, string> = {
      DelaySeconds: String(options.delaySeconds ?? 0),
      VisibilityTimeout: String(options.visibilityTimeout ?? 30),
      MessageRetentionPeriod: String(options.messageRetentionPeriod ?? 345600),
      MaximumMessageSize: String(options.maxMessageSize ?? 262144),
      ReceiveMessageWaitTimeSeconds: String(options.receiveMessageWaitTimeSeconds ?? 0),
    }

    if (isFifo) {
      attributes.FifoQueue = "true"
      attributes.ContentBasedDeduplication = String(options.contentBasedDeduplication ?? true)
    }

    if (options.deadLetterTargetArn && options.maxReceiveCount) {
      attributes.RedrivePolicy = JSON.stringify({
        deadLetterTargetArn: options.deadLetterTargetArn,
        maxReceiveCount: options.maxReceiveCount,
      })
    }

    try {
      const result = await this.client.send(new CreateQueueCommand({
        QueueName: name,
        Attributes: attributes,
        tags: options.tags,
      }))
      return result.QueueUrl
    } catch (error) {
      console.error("ElasticMQ: Failed to create queue:", error)
      return undefined
    }
  }

  async deleteQueue(queueUrl: string): Promise<void> {
    try {
      await this.client.send(new DeleteQueueCommand({ QueueUrl: queueUrl }))
    } catch (error) {
      console.error("ElasticMQ: Failed to delete queue:", error)
    }
  }

  async purgeQueue(queueUrl: string): Promise<void> {
    try {
      await this.client.send(new PurgeQueueCommand({ QueueUrl: queueUrl }))
    } catch (error) {
      console.error("ElasticMQ: Failed to purge queue:", error)
    }
  }

  async sendMessage(queueUrl: string, message: string): Promise<void> {
    try {
      await this.client.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: message,
      }))
      this.archiveMessage(queueUrl, message)
    } catch (error) {
      console.error("ElasticMQ: Failed to send message:", error)
    }
  }

  private archiveMessage(queueUrl: string, message: string): void {
    const archived = store.get('archivedMessages') || {}
    const queueMessages = archived[queueUrl] || []
    const newMessage: QueueMessage = {
      id: crypto.randomUUID(),
      queueUrl,
      createdAt: Date.now(),
      message
    }
    const updatedMessages = [newMessage, ...queueMessages].slice(0, 5)
    store.set('archivedMessages', {
      ...archived,
      [queueUrl]: updatedMessages
    })
  }

  async getQueueData(queueUrl: string): Promise<QueueData> {
    const [attributes, waitingMessages, lastFiveMessages] = await Promise.all([
      this.getQueueAttributes(queueUrl),
      this.getWaitingMessages(queueUrl),
      Promise.resolve(this.getArchivedMessages(queueUrl))
    ])

    return {
      queueAttributes: attributes,
      waitingMessages,
      lastFiveMessages
    }
  }

  private async getQueueAttributes(queueUrl: string): Promise<Partial<Record<QueueAttributeName, string>>> {
    try {
      const response = await this.client.send(new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['All']
      }))
      return response.Attributes || {}
    } catch (error) {
      console.error("ElasticMQ: Failed to get queue attributes:", error)
      return {}
    }
  }

  private async getWaitingMessages(queueUrl: string): Promise<QueueMessage[]> {
    const messages: QueueMessage[] = []
    const MAX_TRIES = 3
    let currentTry = 0

    try {
      while (currentTry < MAX_TRIES) {
        const response = await this.client.send(new ReceiveMessageCommand({
          QueueUrl: queueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 0,
          VisibilityTimeout: 0,
          AttributeNames: ['All']
        }))

        const received = response.Messages || []
        if (received.length === 0) break

        for (const msg of received) {
          if (!messages.some(m => m.id === msg.MessageId)) {
            messages.push({
              id: msg.MessageId || crypto.randomUUID(),
              queueUrl,
              createdAt: Date.now(),
              message: msg.Body || '',
              receiptHandle: msg.ReceiptHandle,
              attributes: msg.Attributes as QueueMessage['attributes']
            })
          }
        }
        currentTry++
      }
    } catch (error) {
      console.error("ElasticMQ: Failed to get waiting messages:", error)
    }

    return messages
  }

  private getArchivedMessages(queueUrl: string): QueueMessage[] {
    const archived = store.get('archivedMessages') || {}
    return archived[queueUrl] || []
  }
}
