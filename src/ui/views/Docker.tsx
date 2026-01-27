import { useState, type FC } from 'react'
import { useDocker } from '../contexts/docker'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContainerList } from '../components/docker/ContainerList'
import { ImageList } from '../components/docker/ImageList'
import { VolumeList } from '../components/docker/VolumeList'
import { NetworkList } from '../components/docker/NetworkList'
import { ContainerDetail } from '../components/docker/ContainerDetail'

interface DockerViewProps {
  itemId: string | null
}

export const DockerView: FC<DockerViewProps> = ({ itemId }) => {
  const { isAvailable, containers } = useDocker()
  const [activeTab, setActiveTab] = useState('containers')

  if (!isAvailable) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">Docker not available</p>
          <p className="text-sm mt-1">Make sure Docker is installed and running</p>
        </div>
      </div>
    )
  }

  if (itemId) {
    const container = containers.find(c => c.id === itemId)
    if (container) {
      return <ContainerDetail container={container} />
    }
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 px-4 pt-2">
          <TabsList>
            <TabsTrigger value="containers">Containers</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="volumes">Volumes</TabsTrigger>
            <TabsTrigger value="networks">Networks</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="containers" className="flex-1 min-h-0 overflow-hidden flex flex-col mt-0">
          <ContainerList />
        </TabsContent>
        <TabsContent value="images" className="flex-1 min-h-0 overflow-auto mt-0">
          <ImageList />
        </TabsContent>
        <TabsContent value="volumes" className="flex-1 min-h-0 overflow-auto mt-0">
          <VolumeList />
        </TabsContent>
        <TabsContent value="networks" className="flex-1 min-h-0 overflow-auto mt-0">
          <NetworkList />
        </TabsContent>
      </Tabs>
    </div>
  )
}
