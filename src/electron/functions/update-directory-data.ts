import { store } from "../storage/store.js"

export const updateDirectoryData = (id: string, data: DataToUpdate) => {
  const directories = store.get('directories')
  const directoryToUpdateIndex = directories.findIndex(({ id: currId }) => currId === id)

  if (directoryToUpdateIndex === -1) {
    throw new Error('Directory not found')
  }

  directories[directoryToUpdateIndex] = {
    ...directories[directoryToUpdateIndex],
    ...data
  }

  store.set('directories', directories)
}