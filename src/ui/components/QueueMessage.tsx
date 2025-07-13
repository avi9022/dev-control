import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RotateCcw } from "lucide-react";
import moment from "moment";
import type { FC } from "react";

interface QueueMessageProps {
  createdAt: number
  id: string
  message: string
  onReuseMessage: (message: string) => void
}

export const QueueMessage: FC<QueueMessageProps> = ({
  createdAt,
  id,
  message,
  onReuseMessage
}) => {
  return <Card className="px-5 bg-stone-900">
    <div className="flex justify-between">
      <div>
        <div className="flex gap-2 items-center mb-2">
          <p className="text-sm text-gray-400">{moment.unix(createdAt / 1000).format('DD/MM/YYYY HH:mm:ss')}</p>
          <p>|</p>
          <p className="text-gray-400">{id}</p>
        </div>
        <p>{message}</p>
      </div>
      <div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => {
                onReuseMessage(message)
              }}
              className={'bg-success hover:bg-success/80'}
              size="sm"
            >
              <RotateCcw color="white" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reuse message</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </Card>
}