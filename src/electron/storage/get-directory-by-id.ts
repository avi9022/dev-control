import { store } from "./store.js"

export const getDirectoryById = (id: string): DirectorySettings | undefined => {
  const directories = store.get('directories')
  const directory = directories.find(({ id: currId }) => currId === id)

  return directory
}