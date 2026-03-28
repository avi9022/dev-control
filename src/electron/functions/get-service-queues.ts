import fs from 'fs';
import yaml from 'js-yaml';
import { getDirectoryById } from '../storage/get-directory-by-id.js';

interface ServerlessFunction {
  events?: Array<{
    sqs?: {
      arn?: string
    }
  }>
}

interface ServerlessConfig {
  functions?: Record<string, ServerlessFunction>
  custom?: {
    'serverless-offline-sqs'?: {
      endpoint?: string
    }
  }
}

function isServerlessConfig(value: unknown): value is ServerlessConfig {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  if (obj.functions !== undefined && typeof obj.functions !== 'object') return false
  return true
}

export const getServiceQueues = async (id: string): Promise<QueueSettings[]> => {
  const directory = getDirectoryById(id)
  if (!directory) return []
  let file: string = ''
  try {
    file = await fs.promises.readFile(`${directory.path}/serverless.yml`, 'utf8');
  } catch {
    return []
  }

  if (!file) return []
  const raw: unknown = yaml.load(file);
  if (!isServerlessConfig(raw)) return []
  const parsed = raw
  const queues: QueueSettings[] = []

  if (parsed.functions) {
    let offlineSqsEndpoint = ''
    if (parsed.custom?.["serverless-offline-sqs"]) {
      offlineSqsEndpoint = parsed.custom["serverless-offline-sqs"].endpoint || ''
    }

    for (const [funcName, data] of Object.entries(parsed.functions)) {
      if (data?.events?.[0]?.sqs?.arn) {
        const arn = data.events[0].sqs.arn
        const match = arn.match(/:([a-zA-Z0-9_-]+?_)[$][{]/);
        const result = match ? match[1] : null;
        const queue: QueueSettings = {
          funcName,
          funcAlias: `${result}development`,
          offlineSqsEndpoint,
        }

        queues.push(queue)
      }
    }
  }

  return queues
}
