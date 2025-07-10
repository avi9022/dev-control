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
import { useEffect, type FC } from "react"
import { useDirectories } from "../contexts/directories"
import { RemoveDirectoryButton } from "./RemoveDirectoryButton"

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  runCommand: z.string().optional(),
  port: z.string(),
})

export const ServiceSettings: FC = () => {
  const { directoryToView, updateDirectory } = useDirectories()
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: directoryToView?.name || '',
      port: directoryToView?.port ? `${directoryToView.port}` : '',
      runCommand: directoryToView?.runCommand || ''
    },
  })

  useEffect(() => {
    form.reset({
      name: directoryToView?.name,
      port: directoryToView?.port ? `${directoryToView.port}` : '',
      runCommand: directoryToView?.runCommand || ''
    })
  }, [directoryToView, form])

  function onSubmit(data: z.infer<typeof FormSchema>) {
    updateDirectory(data)
    toast("You submitted the following values:", {
      description: JSON.stringify(data || {})
    })
  }

  return (
    <Form {...form}>
      <div className="mb-5">
        <FormItem>
          <FormLabel>Id</FormLabel>
          <Input placeholder="Item id" value={directoryToView?.id} disabled />
        </FormItem>
      </div>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Project name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Directory path</FormLabel>
          <Input placeholder="The path here" value={directoryToView?.path} disabled />
        </FormItem>

        <FormField
          control={form.control}
          name="port"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Port</FormLabel>
              <FormControl>
                <Input placeholder="8888" {...field} />
              </FormControl>
              <FormDescription>
                The port on which the project is running
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="runCommand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Run command</FormLabel>
              <FormControl>
                <Input placeholder="npm run dev" {...field} />
              </FormControl>
              <FormDescription>
                The command to run to start the project
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-3">
          <Button type="submit">Submit</Button>
          <RemoveDirectoryButton />
        </div>
      </form>
    </Form>
  )
}
