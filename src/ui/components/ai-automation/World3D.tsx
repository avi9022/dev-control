import { type FC } from 'react'
import { Canvas } from '@react-three/fiber'
import { Sky, OrbitControls } from '@react-three/drei'

function Terrain() {
  const size = 40
  const cubes: JSX.Element[] = []

  for (let x = -size / 2; x < size / 2; x++) {
    for (let z = -size / 2; z < size / 2; z++) {
      cubes.push(
        <mesh key={`${x}-${z}`} position={[x + 0.5, -0.5, z + 0.5]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={Math.random() > 0.05 ? '#5a8f3c' : '#4a7a2e'} />
        </mesh>
      )
    }
  }

  // Dirt layer below
  return (
    <group>
      {cubes}
      <mesh position={[0, -1.5, 0]}>
        <boxGeometry args={[size, 1, size]} />
        <meshStandardMaterial color="#8B6F47" />
      </mesh>
    </group>
  )
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <Sky sunPosition={[100, 60, 100]} />
      <OrbitControls
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={60}
        enableDamping
        dampingFactor={0.1}
      />
      <Terrain />
    </>
  )
}

export const World3D: FC = () => {
  return (
    <div className="h-full w-full" style={{ background: '#87CEEB' }}>
      <Canvas
        camera={{
          position: [25, 20, 25],
          fov: 50,
          near: 0.1,
          far: 200,
        }}
      >
        <Scene />
      </Canvas>
    </div>
  )
}
