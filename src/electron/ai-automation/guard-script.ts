import fs from 'fs'
import path from 'path'
import { app } from 'electron'

let guardScriptPath: string | null = null

const GUARD_SCRIPT_CONTENT = `#!/bin/bash
INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [ -z "$ALLOWED_WRITE_DIR" ]; then
  exit 0
fi

get_path() {
  echo "$INPUT" | jq -r "$1 // empty"
}

resolve_path() {
  local raw="$1"
  local dir="$raw"
  while [ ! -d "$dir" ] && [ "$dir" != "/" ]; do
    dir=$(dirname "$dir")
  done
  local resolved
  resolved=$(cd "$dir" 2>/dev/null && echo "$(pwd -P)/$(basename "$raw")")
  [ -z "$resolved" ] && resolved=$(realpath -m "$raw" 2>/dev/null || echo "$raw")
  echo "$resolved"
}

check_write() {
  local raw="$1"
  [ -z "$raw" ] && return 0
  local resolved
  resolved=$(resolve_path "$raw")
  local write_real
  write_real=$(cd "$ALLOWED_WRITE_DIR" 2>/dev/null && pwd -P)
  [ -z "$write_real" ] && return 1
  case "$resolved" in
    "$write_real"*) return 0 ;;
    *) return 1 ;;
  esac
}

check_read() {
  local raw="$1"
  [ -z "$raw" ] && return 0
  local resolved
  resolved=$(resolve_path "$raw")

  # Check write dir first
  local write_real
  write_real=$(cd "$ALLOWED_WRITE_DIR" 2>/dev/null && pwd -P)
  if [ -n "$write_real" ]; then
    case "$resolved" in
      "$write_real"*) return 0 ;;
    esac
  fi

  # Check read dirs
  IFS=',' read -ra DIRS <<< "$ALLOWED_READ_DIRS"
  for dir in "\${DIRS[@]}"; do
    [ -z "$dir" ] && continue
    local dir_real
    dir_real=$(cd "$dir" 2>/dev/null && pwd -P)
    [ -z "$dir_real" ] && continue
    case "$resolved" in
      "$dir_real"*) return 0 ;;
    esac
  done
  return 1
}

case "$TOOL" in
  Edit|Write)
    FILE=$(get_path '.tool_input.file_path')
    if ! check_write "$FILE"; then
      echo "Blocked: $FILE is outside writable directory" >&2
      exit 2
    fi
    ;;
  Read)
    FILE=$(get_path '.tool_input.file_path')
    if ! check_read "$FILE"; then
      echo "Blocked: $FILE is outside allowed directories" >&2
      exit 2
    fi
    ;;
  Grep|Glob)
    DIR=$(get_path '.tool_input.path')
    if [ -n "$DIR" ] && ! check_read "$DIR"; then
      echo "Blocked: $DIR is outside allowed directories" >&2
      exit 2
    fi
    ;;
esac

exit 0
`

const SCRIPTS_DIR_NAME = 'ai-scripts'
const GUARD_SCRIPT_NAME = 'ai-guard.sh'
const GUARD_SCRIPT_MODE = 0o755

export function getGuardScriptPath(): string {
  if (guardScriptPath) return guardScriptPath
  const dir = path.join(app.getPath('userData'), SCRIPTS_DIR_NAME)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  guardScriptPath = path.join(dir, GUARD_SCRIPT_NAME)
  fs.writeFileSync(guardScriptPath, GUARD_SCRIPT_CONTENT, { mode: GUARD_SCRIPT_MODE })
  return guardScriptPath
}
