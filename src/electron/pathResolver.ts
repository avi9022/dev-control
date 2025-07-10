import { app } from 'electron'
import path from 'path'
import { isDev } from './utils/is-dev.js'

export const getPreloadPath = () => {
  return path.join(
    app.getAppPath(),
    isDev() ? '.' : '..',
    '/dist-electron/preload.cjs'
  )
}

export const getUIPath = () => path.join(app.getAppPath(), '/dist-react/index.html')