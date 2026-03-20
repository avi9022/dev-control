import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from "@/components/ui/sonner"
import { DirectoriesProvider } from './contexts/directories'
import { LoggerProvider } from './contexts/logger'
import { QueuesProvider } from './contexts/queues'
import { useEffect, useState } from 'react'
import { ViewsProvider } from './contexts/views'
import { MainContent } from './components/MainContent'
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
import { AppNavbar } from './components/AppNavbar'
import { AppTopBar } from './components/AppTopBar'


function AppContent() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<string | undefined>()

  return (
    <div className="h-screen flex flex-col bg-background text-foreground pl-12">
      <AppNavbar onOpenLayoutSettings={() => {
        setSettingsTab('appearance')
        setSettingsOpen(true)
      }} />
      <AppTopBar
        onNavigateToTask={(taskId) => {
          setSelectedTaskId(taskId)
        }}
        settingsOpen={settingsOpen}
        onSettingsOpenChange={(open) => {
          setSettingsOpen(open)
          if (!open) setSettingsTab(undefined)
        }}
        defaultSettingsTab={settingsTab}
      />

      <div className="flex-1 min-h-0 overflow-hidden">
        <MainContent selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId} />
      </div>
      <Toaster />
    </div>
  )
}

function App() {
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
        <ViewsProvider>
          <TooltipProvider>
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
                                <ToolsProvider>
                                  <AppContent />
                                </ToolsProvider>
                              </SQLProvider>
                            </MongoDBProvider>
                          </DockerProvider>
                        </ApiClientProvider>
                      </DynamoDBProvider>
                    </QueuesProvider>
                  </BrokerProvider>
                </LoggerProvider>
              </DirectoriesProvider>
            </WorkflowsProvider>
          </TooltipProvider>
        </ViewsProvider>
      </AIAutomationProvider>
    </ErrorBoundary>
  )
}

export default App
