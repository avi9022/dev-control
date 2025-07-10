import { store } from "./store.js"

export const getCachedWaitingMessages = (queueUrl: string): QueueMessage[] | undefined => {
  const cachedMessagesMap = store.get('waitingMessagesCache')
  const currQueueCache = cachedMessagesMap[queueUrl]

  console.log({ currQueueCache });

  if (!currQueueCache) {
    return
  }

  const cachePassedSecs = (Date.now() - currQueueCache.createdAt) / 1000
  console.log({ cachePassedSecs });


  if (cachePassedSecs > 60) {
    delete cachedMessagesMap.queueUrl
    console.log({ cachedMessagesMap });

    store.set('waitingMessagesCache', cachedMessagesMap)
    return
  }

  return currQueueCache.messages
}