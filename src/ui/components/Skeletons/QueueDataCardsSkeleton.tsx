import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { FC } from "react";

export const QueueDataCardsSkeleton: FC = () => {
  return <div>
    <div className="flex gap-2 mb-4">
      <Card className="border-none flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex gap-3 items-center">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-8 w-[250px]" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-15 w-[100px]" />
        </CardContent>
      </Card>
      <Card className="border-none flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex gap-3 items-center">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-8 w-[250px]" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-15 w-[100px]" />
        </CardContent>
      </Card>
      <Card className="border-none flex-1">
        <CardHeader>
          <CardTitle>
            <div className="flex gap-3 items-center">
              <Skeleton className="h-12 w-12 rounded-full" />
              <Skeleton className="h-8 w-[250px]" />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-15 w-[100px]" />
        </CardContent>
      </Card>
    </div>
    <Card className="border-none">
      <CardHeader>
        <CardTitle>
          <div className="flex gap-1 items-center">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-8 w-[250px]" />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <div className="flex gap-2 flex-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-8 w-[250px] mb-2" />
              <Skeleton className="h-6 w-[100px]" />
            </div>
          </div>
          <div className="flex gap-2 flex-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-8 w-[250px] mb-2" />
              <Skeleton className="h-6 w-[100px]" />              </div>
          </div>
          <div className="flex gap-2 flex-1">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div>
              <Skeleton className="h-8 w-[250px] mb-2" />
              <Skeleton className="h-6 w-[100px]" />              </div>
          </div>
        </div>
        <div className="flex gap-2 flex-1 h-[50px]">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div>
            <Skeleton className="h-8 w-[250px] mb-2" />
            <Skeleton className="h-6 w-[100px]" />            </div>
        </div>
      </CardContent>
    </Card>
  </div>
}