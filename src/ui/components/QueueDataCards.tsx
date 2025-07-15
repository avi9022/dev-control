import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CaseSensitive, CircleCheck, CirclePower, ClockAlert, ClockArrowUp, DatabaseBackup, FileText, Hourglass } from "lucide-react";
import type { FC } from "react";
import moment from 'moment'

interface QueueDataCardsProps {
  data: QueueData | null
}

export const QueueDataCards: FC<QueueDataCardsProps> = ({ data }) => {
  return <div>
    <div className="flex gap-2 mb-4">
      <Card className="border-none flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex gap-1 items-center">
              <Hourglass size={18} className="text-yellow-400" />
              <p>Messages in queue</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-5xl text-yellow-400">{data?.queueAttributes.ApproximateNumberOfMessages || 0}</p>
        </CardContent>
      </Card>
      <Card className="border-none flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex gap-2 items-center">
              <CircleCheck size={18} className="text-green-400" />
              <p>Messages in process</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-5xl text-green-400">{data?.queueAttributes.ApproximateNumberOfMessagesNotVisible || 0}</p>
        </CardContent>
      </Card>
      <Card className="border-none flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex gap-2 items-center">
              <ClockAlert size={18} className="text-orange-400" />
              <p>Delayed messages</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-5xl text-orange-400">{data?.queueAttributes.ApproximateNumberOfMessagesDelayed || 0}</p>
        </CardContent>
      </Card>
    </div>
    <Card className="border-none">
      <CardHeader>
        <CardTitle>
          <div className="flex gap-1 items-center">
            <FileText size={24} className="text-blue-400" />
            <p className="text-2xl">Queue metadata</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <div className="flex gap-2 flex-1">
            <CirclePower />
            <div>
              <p className="text-lg">Created at</p>
              <p className="text-gray-400">{moment.unix(+(data?.queueAttributes.CreatedTimestamp || 0)).format('DD/MM/YYYY')}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-1">
            <DatabaseBackup />
            <div>
              <p className="text-lg">Updated at</p>
              <p className="text-gray-400">{moment.unix(+(data?.queueAttributes.LastModifiedTimestamp || 0)).format('DD/MM/YYYY')}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-1">
            <ClockArrowUp />
            <div>
              <p className="text-lg">Visibility timeout</p>
              <p className="text-gray-400">{data?.queueAttributes.VisibilityTimeout}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-1 h-[50px]">
          <CaseSensitive />
          <div>
            <p className="text-lg">Queue ARN</p>
            <p className="text-gray-400 font-bold max-w-[200px] text-sm truncate overflow-hidden whitespace-nowrap">{data?.queueAttributes.QueueArn || ' '}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
}