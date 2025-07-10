import { store } from "../storage/store.js"

export const removeDirectory = (id?: string) => {
  if (id) {
    const directories = store.get('directories')
    const indexToRemove = directories.findIndex(({ id: currId }) => currId === id)
    directories.splice(indexToRemove, 1)
    store.set('directories', directories)
  } else {
    store.set('directories', [])
  }
}