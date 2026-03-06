import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from './components/AppSidebar/AppSidebar'
import { DirectoriesProvider } from './contexts/directories'
import { LoggerProvider } from './contexts/logger'
import { QueuesProvider } from './contexts/queues'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PanelLeftOpen, PanelRightOpen, Bot } from 'lucide-react'
import { ViewsProvider } from './contexts/views'
import { MainContent } from './components/MainContent'
import { SplitScreenChoice } from './components/SplitScreenChoice'
import { WorkflowsProvider } from './contexts/workflows'
import { ToolsProvider } from './contexts/tools'
import { DynamoDBProvider } from './contexts/dynamodb'
import { BrokerProvider } from './contexts/broker'
import { ApiClientProvider } from './contexts/api-client'
import { DockerProvider } from './contexts/docker'
import { MongoDBProvider } from './contexts/mongodb'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AIAutomationProvider } from './contexts/ai-automation'
import { AIKanban } from './views/AIKanban'


function App() {
  const [open, setOpen] = useState(true)
  const [updateSettings, setUpdateSettings] = useState<UpdateNotificationSettings>()
  const [aiMode, setAiMode] = useState(false)

  useEffect(() => {
    const unsubscribe = window.electron.subscribeUpdateNotificationSettings((settings) => {
      setUpdateSettings(settings)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  return (
    <ErrorBoundary>
      <AIAutomationProvider>
        <div>
          {aiMode ? (
            <div className="h-screen flex flex-col bg-background text-foreground">
              <AIKanban onOpenSettings={() => {}} />
            </div>
          ) : (
            <ViewsProvider>
              <ToolsProvider>
              <SidebarProvider open={open} onOpenChange={setOpen} style={{
                // @ts-expect-error not sure why
                "--sidebar-width": "400px",
                "--sidebar-width-mobile": "20rem",
              }}
              >
                <WorkflowsProvider>
                  <DirectoriesProvider>
                    <LoggerProvider>
                      <BrokerProvider>
                        <QueuesProvider>
                          <DynamoDBProvider>
                            <ApiClientProvider>
                              <DockerProvider>
                                <MongoDBProvider>
                                  <TooltipProvider>
                                    <AppSidebar />
                                    <main className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col">
                                      <div className='h-[40px] flex-shrink-0 flex justify-between items-center'>
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
                                      <div className='flex-1 min-h-0 overflow-hidden'>
                                        <MainContent />
                                      </div>
                                    </main>
                                  </TooltipProvider>
                                </MongoDBProvider>
                              </DockerProvider>
                            </ApiClientProvider>
                          </DynamoDBProvider>
                        </QueuesProvider>
                      </BrokerProvider>
                      <Toaster />
                    </LoggerProvider>
                  </DirectoriesProvider>
                </WorkflowsProvider>
              </SidebarProvider>
              </ToolsProvider>
            </ViewsProvider>
          )}
          <Button
            className="fixed bottom-4 right-4 z-50 rounded-full h-10 w-10 p-0 bg-neutral-800 hover:bg-neutral-700 text-white"
            onClick={() => setAiMode(!aiMode)}
            title={aiMode ? 'Switch to DevControl' : 'Switch to AI Kanban'}
          >
            <Bot className="h-5 w-5" />
          </Button>
        </div>
      </AIAutomationProvider>
    </ErrorBoundary>
  )
}

export default App
