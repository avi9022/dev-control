"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { type FC } from "react"
import { DialogClose, DialogFooter } from "@/components/ui/dialog"

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "Queue name must be at least 2 characters.",
  }),
  delaySeconds: z.number().min(0).max(900).default(0).optional(),
  visibilityTimeout: z.number().min(0).max(43200).default(30).optional(),
  messageRetentionPeriod: z.number().min(60).max(1209600).default(345600).optional(),
  maxMessageSize: z.number().min(1024).max(262144).default(262144).optional(),
  receiveMessageWaitTimeSeconds: z.number().min(0).max(20).default(0).optional(),
  fifoQueue: z.boolean().default(false).optional(),
  contentBasedDeduplication: z.boolean().optional(),
})

export const NewQueueForm: FC = () => {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: '',
      delaySeconds: 0,
      visibilityTimeout: 30,
      messageRetentionPeriod: 345600,
      maxMessageSize: 262144,
      receiveMessageWaitTimeSeconds: 0,
      fifoQueue: false,
      contentBasedDeduplication: false,
    },
  })

  const onSubmit = (data: z.infer<typeof FormSchema>) => {
    if (data.fifoQueue && !data.name.endsWith('.fifo')) {
      data.name += '.fifo';
    }

    toast("Creating queue:", {
      description: JSON.stringify(data, null, 2),
    })

    const { name, ...options } = data

    window.electron.createQueue(name, options)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Queue Name</FormLabel>
              <FormControl>
                <Input placeholder="my-queue" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="delaySeconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delay Seconds</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>0–900 seconds</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="visibilityTimeout"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Visibility Timeout</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>0–43200 seconds</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="messageRetentionPeriod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Message Retention (seconds)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>60–1209600 seconds</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxMessageSize"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Message Size (bytes)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>1024–262144 bytes</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="receiveMessageWaitTimeSeconds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Receive Wait Time</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormDescription>0–20 seconds</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="fifoQueue"
          render={({ field }) => (
            <FormItem className="flex items-center gap-4">
              <FormLabel>FIFO Queue</FormLabel>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormDescription>Enable first-in-first-out behavior</FormDescription>
            </FormItem>
          )}
        />

        {form.watch("fifoQueue") && (
          <FormField
            control={form.control}
            name="contentBasedDeduplication"
            render={({ field }) => (
              <FormItem className="flex items-center gap-4">
                <FormLabel>Content-Based Deduplication</FormLabel>
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormDescription>
                  Automatically deduplicate messages with the same body
                </FormDescription>
              </FormItem>
            )}
          />
        )}
        <DialogFooter className="sm:justify-start">
          <DialogClose asChild>
            <Button onClick={() => { }} variant='default' type="submit">Submit</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </form>
    </Form>
  )
}
