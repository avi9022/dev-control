import { type FC } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface CommandStepFieldsProps {
  command: string
  workingDirectory: string
  onCommandChange: (value: string) => void
  onWorkingDirectoryChange: (value: string) => void
}

export const CommandStepFields: FC<CommandStepFieldsProps> = ({
  command,
  workingDirectory,
  onCommandChange,
  onWorkingDirectoryChange,
}) => {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-xs mb-1.5">Command</Label>
        <Textarea
          placeholder="e.g., colima start --arch x86_64 --vm-type qemu --memory 4"
          value={command}
          onChange={(e) => onCommandChange(e.target.value)}
          className="font-mono text-sm min-h-[60px]"
        />
      </div>
      <div>
        <Label className="text-xs mb-1.5">Working Directory (optional)</Label>
        <Input
          placeholder="Leave empty for default"
          value={workingDirectory}
          onChange={(e) => onWorkingDirectoryChange(e.target.value)}
          className="font-mono text-sm"
        />
      </div>
    </div>
  )
}
