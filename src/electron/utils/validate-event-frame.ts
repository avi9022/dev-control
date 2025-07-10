import { WebFrameMain } from "electron";
import { isDev } from "./is-dev.js";
import { pathToFileURL } from 'url'
import { getUIPath } from "../pathResolver.js";

export const validateEventFrame = (frame: WebFrameMain) => {
  if (isDev() && new URL(frame.url).host === 'localhost:5123') {
    return
  }

  if (frame.url !== pathToFileURL(getUIPath()).toString()) {
    throw new Error('Malicious event')
  }
}