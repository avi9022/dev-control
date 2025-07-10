/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import yaml from 'js-yaml';
import { getDirectoryById } from '../storage/get-directory-by-id.js';

export const getServiceQueues = (id: string): QueueSettings[] => {
  const directory = getDirectoryById(id)
  if (!directory) return []
  let file: string = ''
  try {
    file = fs.readFileSync(`${directory.path}/serverless.yml`, 'utf8');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (err) {
    return []
  }

  if (!file) return []
  const parsed = yaml.load(file) as any;
  const queues: QueueSettings[] = []

  if (parsed.functions) {
    let offlineSqsEndpoint = ''
    if (parsed?.custom?.["serverless-offline-sqs"]) {
      offlineSqsEndpoint = parsed?.custom?.["serverless-offline-sqs"].endpoint
    }

    Object.entries<any>(parsed.functions).forEach(([funcName, data]) => {
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
    })
  }

  return queues
}