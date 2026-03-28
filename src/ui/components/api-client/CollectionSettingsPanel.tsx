import { useState, useEffect, type FC } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RequestAuthEditor } from './RequestAuthEditor'
import { KeyValueTable } from './KeyValueTable'
import { useApiClient } from '@/ui/contexts/api-client'
import { ArrowLeft, Save, Settings2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface CollectionSettingsPanelProps {
  collectionId: string
  onBack: () => void
}

export const CollectionSettingsPanel: FC<CollectionSettingsPanelProps> = ({
  collectionId,
  onBack,
}) => {
  const { activeWorkspace, activeWorkspaceId } = useApiClient()
  const collection = activeWorkspace?.collections.find((c) => c.id === collectionId)

  const [auth, setAuth] = useState<ApiAuth>(collection?.auth ?? { type: 'none' })
  const [variables, setVariables] = useState<ApiVariable[]>(collection?.variables ?? [])
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (collection) {
      setAuth(collection.auth ?? { type: 'none' })
      setVariables(collection.variables ?? [])
      setHasChanges(false)
    }
  }, [collection])

  const handleAuthChange = (newAuth: ApiAuth) => {
    setAuth(newAuth)
    setHasChanges(true)
  }

  const handleVariablesChange = (newVariables: ApiKeyValue[]) => {
    const converted: ApiVariable[] = newVariables.map((v) => ({
      key: v.key,
      value: v.value,
      type: 'default' as const,
      enabled: v.enabled,
    }))
    setVariables(converted)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!activeWorkspaceId || !collectionId) return

    await window.electron.apiUpdateCollectionAuth(activeWorkspaceId, collectionId, auth)
    await window.electron.apiUpdateCollection(activeWorkspaceId, collectionId, { variables })
    setHasChanges(false)
  }

  if (!collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Collection not found</p>
      </div>
    )
  }

  const variablesAsKeyValue: ApiKeyValue[] = variables.map((v) => ({
    key: v.key,
    value: v.value,
    enabled: v.enabled,
  }))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium truncate">{collection.name}</h2>
          <p className="text-[10px] text-muted-foreground">Collection Settings</p>
        </div>
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          <Save className="h-3 w-3" />
          Save
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="auth" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-3 h-8">
          <TabsTrigger value="auth" className="text-xs h-7 px-3 data-[state=active]:bg-background">
            Authorization
          </TabsTrigger>
          <TabsTrigger value="variables" className="text-xs h-7 px-3 data-[state=active]:bg-background">
            Variables
          </TabsTrigger>
        </TabsList>

        <TabsContent value="auth" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="mb-3">
                <p className="text-xs text-muted-foreground">
                  Configure default authentication for all requests in this collection.
                  Requests can override this by setting their own auth or use "Inherit from parent".
                </p>
              </div>
              <RequestAuthEditor
                auth={auth}
                onChange={handleAuthChange}
                showInheritOption={false}
              />
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="variables" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="mb-3">
                <p className="text-xs text-muted-foreground">
                  Collection variables are available in all requests within this collection.
                  Use <code className="px-1 py-0.5 bg-muted rounded text-[10px]">{'{{variable}}'}</code> syntax to reference them.
                </p>
              </div>
              <KeyValueTable
                items={variablesAsKeyValue}
                onChange={handleVariablesChange}
              />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
