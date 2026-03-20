import type { FC } from 'react'

interface LanternProps {
  position: [number, number, number]
}

/** Small hanging lantern — iron frame with glowing center */
export const Lantern: FC<LanternProps> = ({ position }) => {
  const [x, y, z] = position

  return (
    <group position={[x, y, z]}>
      {/* Top cap — dark iron */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.4]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* Hook ring */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[0.15, 0.1, 0.15]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>
      {/* Bottom cap */}
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.4, 0.1, 0.4]} />
        <meshStandardMaterial color="#3a3a3a" />
      </mesh>
      {/* Corner posts — 4 thin iron bars */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([cx, cz], i) => (
        <mesh key={i} position={[cx * 0.18, 0, cz * 0.18]}>
          <boxGeometry args={[0.06, 0.6, 0.06]} />
          <meshStandardMaterial color="#4a4a4a" />
        </mesh>
      ))}
      {/* Glowing center */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.25, 0.4, 0.25]} />
        <meshStandardMaterial color="#F0C848" emissive="#E8A020" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}
