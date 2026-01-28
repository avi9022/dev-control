import { useState, useEffect, type FC } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { RequestAuthEditor } from './RequestAuthEditor'
import { useApiClient } from '@/ui/contexts/api-client'
import { ArrowLeft, Save, FolderOpen } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface FolderSettingsPanelProps {
  collectionId: string
  folderId: string
  onBack: () => void
  onNavigateToCollection: () => void
}

function findFolderInItems(
  items: ApiCollectionItem[],
  folderId: string
): ApiCollectionItem | null {
  for (const item of items) {
    if (item.id === folderId) return item
    if (item.type === 'folder' && item.items) {
      const found = findFolderInItems(item.items, folderId)
      if (found) return found
    }
  }
  return null
}

export const FolderSettingsPanel: FC<FolderSettingsPanelProps> = ({
  collectionId,
  folderId,
  onBack,
  onNavigateToCollection,
}) => {
  const { activeWorkspace, activeWorkspaceId } = useApiClient()
  const collection = activeWorkspace?.collections.find((c) => c.id === collectionId)
  const folder = collection ? findFolderInItems(collection.items, folderId) : null

  const [auth, setAuth] = useState<ApiAuth>(folder?.auth ?? { type: 'inherit' })
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    if (folder) {
      setAuth(folder.auth ?? { type: 'inherit' })
      setHasChanges(false)
    }
  }, [folder])

  const handleAuthChange = (newAuth: ApiAuth) => {
    setAuth(newAuth)
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!activeWorkspaceId || !collectionId || !folderId) return

    await window.electron.apiUpdateFolderAuth(activeWorkspaceId, collectionId, folderId, auth)
    setHasChanges(false)
  }

  const handleNavigateToSource = (source: 'collection' | 'folder', sourceId: string) => {
    if (source === 'collection') {
      onNavigateToCollection()
    }
    // For nested folders, we'd need additional navigation logic
  }

  if (!folder || !collection) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p className="text-sm">Folder not found</p>
      </div>
    )
  }

  // Get resolved auth info for display when using inherit
  const resolvedAuthInfo: ResolvedAuthInfo | null = auth.type === 'inherit' && collection.auth && collection.auth.type !== 'none'
    ? {
        auth: collection.auth,
        source: 'collection',
        sourceId: collection.id,
        sourceName: collection.name,
      }
    : null

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-medium truncate">{folder.name}</h2>
          <p className="text-[10px] text-muted-foreground">Folder Settings in {collection.name}</p>
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
        </TabsList>

        <TabsContent value="auth" className="flex-1 m-0 min-h-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="mb-3">
                <p className="text-xs text-muted-foreground">
                  Configure authentication for all requests in this folder.
                  Use "Inherit from parent" to use the collection's auth settings.
                </p>
              </div>
              <RequestAuthEditor
                auth={auth}
                onChange={handleAuthChange}
                showInheritOption={true}
                resolvedAuthInfo={resolvedAuthInfo}
                onNavigateToSource={handleNavigateToSource}
              />
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}
