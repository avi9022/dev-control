import type { BrokerClient, BrokerConfig, BrokerConnectionState } from "../types.js"
import { store } from "../../storage/store.js"

export class RabbitMQClient implements BrokerClient {
  readonly type = 'rabbitmq' as const
  private config: BrokerConfig
  private baseUrl: string
  private authHeader: string

  constructor(config: BrokerConfig) {
    this.config = config
    this.baseUrl = this.buildBaseUrl(config)
    this.authHeader = this.buildAuthHeader(config)
  }

  private buildBaseUrl(config: BrokerConfig): string {
    const protocol = config.useHttps ? 'https' : 'http'
    return `${protocol}://${config.host}:${config.port}/api`
  }

  private buildAuthHeader(config: BrokerConfig): string {
    return 'Basic ' + Buffer.from(`${config.username}:${config.password}`).toString('base64')
  }

  updateConfig(config: BrokerConfig): void {
    this.config = config
    this.baseUrl = this.buildBaseUrl(config)
    this.authHeader = this.buildAuthHeader(config)
  }

  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`

    const headers = {
      'Authorization': this.authHeader,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }

    if (this.config.useHttps) {
      // Use https module for self-signed certificate support
      return this.httpsRequest(url, {
        method: options.method || 'GET',
        headers,
        body: options.body as string | undefined
      })
    }

    return fetch(url, {
      ...options,
      headers,
    })
  }

  private httpsRequest(url: string, options: { method: string; headers: Record<string, string>; body?: string }): Promise<Response> {
    return new Promise((resolve, reject) => {
      import('https').then((https) => {
        const urlObj = new URL(url)
        const req = https.request({
          hostname: urlObj.hostname,
          port: urlObj.port,
          path: urlObj.pathname + urlObj.search,
          method: options.method,
          headers: options.headers,
          rejectUnauthorized: false
        }, (res) => {
          let data = ''
          res.on('data', (chunk) => { data += chunk })
          res.on('end', () => {
            resolve({
              ok: res.statusCode !== undefined && res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              json: () => Promise.resolve(JSON.parse(data)),
              text: () => Promise.resolve(data),
            } as Response)
          })
        })

        req.on('error', reject)

        if (options.body) {
          req.write(options.body)
        }
        req.end()
      })
    })
  }

  async testConnection(): Promise<BrokerConnectionState> {
    try {
      const response = await this.fetch('/overview')
      if (response.ok) {
        return {
          type: 'rabbitmq',
          isConnected: true,
          lastChecked: Date.now()
        }
      }
      return {
        type: 'rabbitmq',
        isConnected: false,
        lastError: `HTTP ${response.status}: ${response.statusText}`,
        lastChecked: Date.now()
      }
    } catch (error) {
      return {
        type: 'rabbitmq',
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Connection failed',
        lastChecked: Date.now()
      }
    }
  }

  async listQueues(): Promise<string[]> {
    try {
      const response = await this.fetch('/queues')
      if (!response.ok) return []

      const queues = await response.json() as Array<{ name: string; vhost: string }>
      return queues.map(q => this.buildQueueUrl(q.vhost, q.name))
    } catch (error) {
      console.error("RabbitMQ: Error listing queues:", error)
      return []
    }
  }

  private buildQueueUrl(vhost: string, name: string): string {
    const encodedVhost = encodeURIComponent(vhost)
    return `rabbitmq://${this.config.host}:${this.config.port}/${encodedVhost}/${name}`
  }

  private parseQueueUrl(queueUrl: string): { vhost: string; name: string } {
    const parts = queueUrl.replace('rabbitmq://', '').split('/')
    return {
      vhost: decodeURIComponent(parts[1] || '%2F'),
      name: parts[2] || ''
    }
  }

  async createQueue(name: string, options: CreateQueueOptions = {}): Promise<string | undefined> {
    const vhost = '%2F'
    try {
      const body: Record<string, unknown> = {
        durable: true,
        auto_delete: false,
      }

      if (options.deadLetterTargetArn) {
        body.arguments = {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': options.deadLetterTargetArn,
        }
      }

      const response = await this.fetch(`/queues/${vhost}/${encodeURIComponent(name)}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })

      if (response.ok || response.status === 204) {
        return this.buildQueueUrl(decodeURIComponent(vhost), name)
      }
      console.error("RabbitMQ: Failed to create queue:", response.statusText)
      return undefined
    } catch (error) {
      console.error("RabbitMQ: Failed to create queue:", error)
      return undefined
    }
  }

  async deleteQueue(queueUrl: string): Promise<void> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)
    try {
      await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error("RabbitMQ: Failed to delete queue:", error)
    }
  }

  async purgeQueue(queueUrl: string): Promise<void> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)
    try {
      await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/contents`, {
        method: 'DELETE',
      })
    } catch (error) {
      console.error("RabbitMQ: Failed to purge queue:", error)
    }
  }

  async sendMessage(queueUrl: string, message: string): Promise<void> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)
    try {
      const response = await this.fetch(`/exchanges/${encodeURIComponent(vhost)}/amq.default/publish`, {
        method: 'POST',
        body: JSON.stringify({
          routing_key: name,
          payload: message,
          payload_encoding: 'string',
          properties: {},
        }),
      })

      if (response.ok) {
        this.archiveMessage(queueUrl, message)
      }
    } catch (error) {
      console.error("RabbitMQ: Failed to send message:", error)
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
    archived[queueUrl] = [newMessage, ...queueMessages].slice(0, 5)
    store.set('archivedMessages', archived)
  }

  async getQueueData(queueUrl: string): Promise<QueueData> {
    const { vhost, name } = this.parseQueueUrl(queueUrl)

    const [queueInfo, waitingMessages] = await Promise.all([
      this.getQueueInfo(vhost, name),
      this.getWaitingMessages(vhost, name, queueUrl),
    ])

    return {
      queueAttributes: this.mapToSQSAttributes(queueInfo),
      waitingMessages,
      lastFiveMessages: this.getArchivedMessages(queueUrl)
    }
  }

  private async getQueueInfo(vhost: string, name: string): Promise<Record<string, unknown>> {
    try {
      const response = await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}`)
      if (!response.ok) return {}
      return await response.json()
    } catch (error) {
      console.error("RabbitMQ: Failed to get queue info:", error)
      return {}
    }
  }

  private mapToSQSAttributes(info: Record<string, unknown>): Partial<Record<string, string>> {
    return {
      ApproximateNumberOfMessages: String(info.messages ?? 0),
      ApproximateNumberOfMessagesNotVisible: String(info.messages_unacknowledged ?? 0),
      CreatedTimestamp: String(Math.floor(Date.now() / 1000)),
      LastModifiedTimestamp: String(Math.floor(Date.now() / 1000)),
    }
  }

  private async getWaitingMessages(vhost: string, name: string, queueUrl: string): Promise<QueueMessage[]> {
    try {
      const response = await this.fetch(`/queues/${encodeURIComponent(vhost)}/${encodeURIComponent(name)}/get`, {
        method: 'POST',
        body: JSON.stringify({
          count: 10,
          ackmode: 'ack_requeue_true',
          encoding: 'auto',
        }),
      })

      if (!response.ok) return []

      const messages = await response.json() as Array<{
        message_count: number
        payload: string
        properties: Record<string, unknown>
      }>

      return messages.map((msg) => ({
        id: crypto.randomUUID(),
        queueUrl,
        createdAt: Date.now(),
        message: msg.payload,
      }))
    } catch (error) {
      console.error("RabbitMQ: Failed to get waiting messages:", error)
      return []
    }
  }

  private getArchivedMessages(queueUrl: string): QueueMessage[] {
    const archived = store.get('archivedMessages') || {}
    return archived[queueUrl] || []
  }
}
