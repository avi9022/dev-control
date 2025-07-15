import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogHeader, Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDirectories } from "@/ui/contexts/directories";
import { zodResolver } from "@hookform/resolvers/zod";
import { CirclePlus, Monitor, Pencil, Server } from "lucide-react";
import { useState, type FC } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { SearchInput } from "../Inputs/SearchInput";
import { useWorkflows } from "@/ui/contexts/workflows";

interface SaveWorkflowButtonProps {
  id?: string
}

const FormSchema = z.object({
  name: z.string().min(2, {
    message: "Workflow name must be at least 2 characters.",
  }),
  services: z.array(z.string())
})

export const SaveWorkflowButton: FC<SaveWorkflowButtonProps> = ({ id }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { directories } = useDirectories()
  const { getWorkflowById } = useWorkflows()
  const workflowToEdit = id ? getWorkflowById(id) : null

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: workflowToEdit ? workflowToEdit.name : '',
      services: workflowToEdit ? workflowToEdit.services : []
    },
  })

  const onSubmit = (data: z.infer<typeof FormSchema>) => {
    toast(`${id ? 'Updating' : 'Creating'} workflow:`, {
      description: JSON.stringify(data, null, 2),
    })
    if (id) {
      window.electron.updateWorkflow(id, data)
    } else {
      window.electron.createWorkflow(data.name, data.services)
    }
    setIsOpen(false)
    form.reset()
  }

  const filteredDirectories = directories.filter(({ name }) => name.toLowerCase().includes(searchTerm.toLowerCase()))

  return <div className="w-full">
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        form.reset()
        setSearchTerm('')
        setIsOpen(open)
      }
    }}>
      <DialogTrigger asChild>
        <Button onClick={() => setIsOpen(true)} className="w-full">
          {workflowToEdit ? <Pencil /> : <CirclePlus />}
          {!workflowToEdit && <p>Add new workflow</p>}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{workflowToEdit ? `Update '${workflowToEdit.name}'` : 'Add new workflow'}</DialogTitle>
          <DialogDescription>
            Please fill in the form and choose the workflow's services
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workflow Name</FormLabel>
                  <FormControl>
                    <Input placeholder="my-workflow" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormLabel className="m-0 mb-1">Select services</FormLabel>
            <FormDescription className="m-0 mb-3">The chosen services will be initialized when this workflow is started</FormDescription>
            <div className="border p-3 rounded-sm">
              <div className="mb-3">
                <SearchInput value={searchTerm} onChange={(ev) => setSearchTerm(ev.target.value)} onClear={() => setSearchTerm('')} />
              </div>
              <ScrollArea className="h-[300px]">
                <div className="flex flex-col gap-5">
                  {filteredDirectories.length ? filteredDirectories.map(({ id, name, isFrontendProj }) => <FormField
                    control={form.control}
                    name="services"
                    render={({ field }) => (
                      <FormItem className="flex items-center">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value, id])
                                : field.onChange(
                                  field.value?.filter(
                                    (value) => value !== id
                                  )
                                )
                            }}
                          />
                        </FormControl>
                        <FormLabel className="capitalize w-full">
                          <div className="flex gap-1 items-center justify-between w-full">
                            {name}
                            {isFrontendProj ? <Monitor className="text-green-500" /> : <Server className="text-blue-500" />}
                          </div>
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />) : <div className="flex justify-center pt-5 font-bold">
                    <p>No services matching this search</p>
                  </div>}
                </div>
              </ScrollArea>
            </div>


            <DialogFooter className="sm:justify-start">
              <Button onClick={() => { }} variant='default' type="submit">Submit</Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Close
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  </div>
}