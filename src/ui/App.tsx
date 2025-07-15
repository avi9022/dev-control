import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from './components/AppSidebar/AppSidebar'
import { DirectoriesProvider } from './contexts/directories'
import { LoggerProvider } from './contexts/logger'
import { QueuesProvider } from './contexts/queues'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
import { ViewsProvider } from './contexts/views'
import { MainContent } from './components/MainContent'
import { SplitScreenChoice } from './components/SplitScreenChoice'
import { WorkflowsProvider } from './contexts/workflows'


function App() {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <ViewsProvider>
        <SidebarProvider open={open} onOpenChange={setOpen} style={{
          // @ts-expect-error not sure why
          "--sidebar-width": "400px",
          "--sidebar-width-mobile": "20rem",
        }}
        >
          <WorkflowsProvider>
            <DirectoriesProvider>
              <LoggerProvider>
                <QueuesProvider>
                  <TooltipProvider>
                    <AppSidebar />
                    <main className={`flex w-full relative h-screen`}>
                      <div className='w-full'>
                        <div className='h-[40px] flex justify-between items-center'>
                          <Button className='bg-transparent hover:bg-neutral-500 text-white' onClick={() => setOpen(!open)}>
                            {open ?
                              <div className='flex gap-1 items-center'>
                                <PanelRightOpen />
                                <p className='text-sm'>Close sidebar</p>
                              </div> :
                              <div className='flex gap-1 items-center'>
                                <PanelLeftOpen />
                                <p className='text-sm'>Open sidebar</p>
                              </div>}
                          </Button>
                          <div className='pr-5'>
                            <SplitScreenChoice />
                          </div>
                        </div>
                        <div className='h-[calc(100vh-40px)]'>
                          <MainContent />
                        </div>
                      </div>

                    </main>
                  </TooltipProvider>
                </QueuesProvider>
                <Toaster />
              </LoggerProvider>
            </DirectoriesProvider>
          </WorkflowsProvider>
        </SidebarProvider>
      </ViewsProvider>

    </div>
  )
}

export default App
