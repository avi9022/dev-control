import type { FC } from 'react'

interface ZoneBuildingProps {
  position: [number, number]
  color: string
}

export const ZoneBuilding: FC<ZoneBuildingProps> = ({ position, color }) => {
  const [x, z] = position

  return (
    <group position={[x, 0.5, z]}>
      {/* Floor */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[6, 0.3, 6]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      {/* Walls — 4 sides with a gap in front for the door */}
      {/* Back wall */}
      <mesh position={[0, 2, -2.85]}>
        <boxGeometry args={[6, 4, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-2.85, 2, 0]}>
        <boxGeometry args={[0.3, 4, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Right wall */}
      <mesh position={[2.85, 2, 0]}>
        <boxGeometry args={[0.3, 4, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Front wall — left section */}
      <mesh position={[-1.5, 2, 2.85]}>
        <boxGeometry args={[2.7, 4, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Front wall — right section */}
      <mesh position={[1.5, 2, 2.85]}>
        <boxGeometry args={[2.7, 4, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* Front wall — above door */}
      <mesh position={[0, 3.5, 2.85]}>
        <boxGeometry args={[1.2, 1, 0.3]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Roof — peaked */}
      <mesh position={[0, 4.3, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[7, 0.3, 7]} />
        <meshStandardMaterial color="#6B4A30" />
      </mesh>
      <mesh position={[0, 4.8, 0]}>
        <boxGeometry args={[5, 0.3, 5.5]} />
        <meshStandardMaterial color="#5C3D28" />
      </mesh>
      <mesh position={[0, 5.2, 0]}>
        <boxGeometry args={[3, 0.3, 4]} />
        <meshStandardMaterial color="#4E3220" />
      </mesh>
    </group>
  )
}
