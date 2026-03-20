import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from "@/components/ui/sonner"
import { AppSidebar } from './components/AppSidebar/AppSidebar'
import { DirectoriesProvider } from './contexts/directories'
import { LoggerProvider } from './contexts/logger'
import { QueuesProvider } from './contexts/queues'
import { SidebarProvider } from '@/components/ui/sidebar'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { PanelLeftOpen, PanelRightOpen } from 'lucide-react'
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
import { SQLProvider } from './contexts/sql'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AIAutomationProvider } from './contexts/ai-automation'
import { AIKanban } from './views/AIKanban'
import { AppNavbar, type AppView } from './components/AppNavbar'


function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [updateSettings, setUpdateSettings] = useState<UpdateNotificationSettings>()
  const [activeView, setActiveView] = useState<AppView>('kanban')

  useEffect(() => {
    const unsubscribe = window.electron.subscribeUpdateNotificationSettings((settings) => {
      setUpdateSettings(settings)
    })

    return () => {
      unsubscribe?.()
    }
  }, [])

  // Apply theme on app load so all views get themed
  useEffect(() => {
    window.electron.aiGetSettings?.().then((s: AIAutomationSettings) => {
      if (s?.theme === 'light') {
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.remove('light')
      }
    })

    const unsubscribe = window.electron.subscribeAISettings?.((s: AIAutomationSettings) => {
      if (s?.theme === 'light') {
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.remove('light')
      }
    })

    return () => unsubscribe?.()
  }, [])

  return (
    <ErrorBoundary>
      <AIAutomationProvider>
        <TooltipProvider>
          <div className="h-screen bg-background text-foreground pl-12">
            <AppNavbar activeView={activeView} onViewChange={setActiveView} />

            {activeView === 'kanban' ? (
              <div className="h-full flex flex-col">
                <DirectoriesProvider>
                  <LoggerProvider>
                    <AIKanban />
                  </LoggerProvider>
                </DirectoriesProvider>
              </div>
            ) : (
              <div className="h-full overflow-hidden [&_[data-slot=sidebar-wrapper]]:min-h-0 [&_[data-slot=sidebar-wrapper]]:h-full [&_[data-slot=sidebar-container]]:!sticky [&_[data-slot=sidebar-container]]:!left-auto [&_[data-slot=sidebar-gap]]:!hidden">
              <ViewsProvider>
                <ToolsProvider>
                  <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen} style={{
                    // @ts-expect-error not sure why
                    "--sidebar-width": "400px",
                    "--sidebar-width-mobile": "20rem",
                  }}>
                    <WorkflowsProvider>
                      <DirectoriesProvider>
                        <LoggerProvider>
                          <BrokerProvider>
                            <QueuesProvider>
                              <DynamoDBProvider>
                                <ApiClientProvider>
                                  <DockerProvider>
                                    <MongoDBProvider>
                                      <SQLProvider>
                                      <AppSidebar />
                                      <main className="flex-1 min-w-0 h-screen overflow-hidden flex flex-col">
                                        <div className='h-[40px] flex-shrink-0 flex justify-between items-center'>
                                          <Button className='bg-transparent hover:bg-accent text-foreground' onClick={() => setSidebarOpen(!sidebarOpen)}>
                                            {sidebarOpen ?
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
                                      </SQLProvider>
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
            </div>
            )}
          </div>
        </TooltipProvider>
      </AIAutomationProvider>
    </ErrorBoundary>
  )
}

export default App
