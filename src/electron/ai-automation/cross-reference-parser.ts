/**
 * Extract #shortId references from text and resolve to full task UUIDs.
 * Short IDs are the first 8 hex chars of a UUID.
 */
export function parseLinkedTaskIds(
  text: string,
  allTasks: AITask[],
  selfId?: string
): string[] {
  const regex = /#([a-f0-9]{8})\b/g
  const shortIds = new Set<string>()
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    shortIds.add(match[1])
  }

  const resolved: string[] = []
  for (const shortId of shortIds) {
    const task = allTasks.find(t => t.id.startsWith(shortId) && t.id !== selfId)
    if (task) resolved.push(task.id)
  }
  return resolved
}

/**
 * Extract linked task IDs from a task's description + amendments.
 */
export function extractLinkedTaskIds(
  task: { id: string; description: string; amendments?: AITaskAmendment[] },
  allTasks: AITask[]
): string[] {
  const texts = [task.description]
  if (task.amendments) {
    for (const a of task.amendments) {
      if (!a.hidden) texts.push(a.text)
    }
  }
  const combined = texts.join('\n')
  return parseLinkedTaskIds(combined, allTasks, task.id)
}
