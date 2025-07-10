import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from "@/components/ui/sonner"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { Service } from './views/Service'
import { AppSidebar } from './components/AppSidebar'
import { DirectoriesProvider } from './contexts/directories'
import { LoggerProvider } from './contexts/logger'
import { QueuesContext, QueuesProvider } from './contexts/queues'
import { Queue } from './views/Queue'

function App() {
  return (
    <div>
      <DirectoriesProvider>
        <LoggerProvider>
          <QueuesProvider>
            <TooltipProvider>
              <ResizablePanelGroup
                style={{
                  height: '100vh'
                }}
                direction="horizontal"
                className="w-full"
              >
                <ResizablePanel className='flex flex-col' defaultSize={20}>
                  <AppSidebar />
                </ResizablePanel>
                <ResizableHandle />
                <ResizablePanel defaultSize={50}>
                  <QueuesContext.Consumer>
                    {({ chosenQueue }) => chosenQueue ? <Queue /> : <Service />}
                  </QueuesContext.Consumer>
                </ResizablePanel>
              </ResizablePanelGroup>
            </TooltipProvider>
          </QueuesProvider>
          <Toaster />
        </LoggerProvider>
      </DirectoriesProvider>
    </div>
  )
}

export default App
