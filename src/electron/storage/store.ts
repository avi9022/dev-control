import Store from 'electron-store';

type Schema = {
  directories: DirectorySettings[];
  workflows: Workflow[]
  archivedMessages: QueueMessageMapByQueue
  updateNotificationSettings: UpdateNotificationSettings
  waitingMessagesCache: Record<string, {
    createdAt: number,
    messages: QueueMessage[]
  }>
};

export const store = new Store<Schema>({
  defaults: {
    directories: [],
    workflows: [],
    archivedMessages: {},
    waitingMessagesCache: {},
    updateNotificationSettings: {
      hasUpdates: false,
      userRefusedUpdates: false,
      userWasPrompted: false
    }
  },
});
