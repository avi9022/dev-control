import Store from 'electron-store';

type Schema = {
  directories: DirectorySettings[];
  archivedMessages: QueueMessageMapByQueue
  waitingMessagesCache: Record<string, {
    createdAt: number,
    messages: QueueMessage[]
  }>
};

export const store = new Store<Schema>({
  defaults: {
    directories: [],
    archivedMessages: {},
    waitingMessagesCache: {}
  },
});
