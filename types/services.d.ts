interface DirectorySettings {
  id: string
  customLabel?: string;
  path: string
  name: string
  isInitializing?: boolean
  port?: string
  packageJsonExists: boolean
  isFrontendProj: boolean
  runCommand?: string
}

interface DataToUpdate {
  name?: string
  port?: string
  runCommand?: string
  isInitializing?: boolean
}

type DirectoryMapByState = Record<string, DirectoryState>
type DirectoryState = 'RUNNING' | 'UNKNOWN' | 'STOPPED' | 'INITIALIZING'

interface Log {
  dirId: string
  line: string
}
