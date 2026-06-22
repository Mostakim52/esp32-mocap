import { useMemo } from 'react'
import * as THREE from 'three'

const _quat = new THREE.Quaternion()
const _euler = new THREE.Euler()

const axes = [
  { label: 'X', color: '#ef4444', dir: [1, 0, 0] },
  { label: 'Y', color: '#22c55e', dir: [0, 1, 0] },
  { label: 'Z', color: '#3b82f6', dir: [0, 0, 1] },
]

export default function AxisIndicator({ cameraQuat }) {
  const transform = useMemo(() => {
    if (!cameraQuat) return ''
    _quat.set(cameraQuat.x, cameraQuat.y, cameraQuat.z, cameraQuat.w)
    // The axis gizmo should rotate opposite to the camera so it stays
    // aligned with world axes from the camera's perspective.
    _quat.invert()
    _euler.setFromQuaternion(_quat, 'YXZ')
    const rx = THREE.MathUtils.radToDeg(_euler.x)
    const ry = THREE.MathUtils.radToDeg(_euler.y)
    const rz = THREE.MathUtils.radToDeg(_euler.z)
    return `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`
  }, [cameraQuat])

  return (
    <div
      className="pointer-events-none absolute bottom-4 left-4 z-10"
      style={{ perspective: '200px', width: 80, height: 80 }}
    >
      <div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d', transform }}
      >
        {axes.map(({ label, color, dir }) => {
          const [dx, dy, dz] = dir
          // Project 3D direction onto 2D with simple perspective
          const len = 30
          const x = 40 + dx * len
          const y = 40 - dy * len
          const labelX = 40 + dx * (len + 12)
          const labelY = 40 - dy * (len + 12)
          // Depth-based opacity for pseudo-3D feel
          const depth = (dz + 1) / 2
          const opacity = 0.5 + depth * 0.5

          return (
            <svg
              key={label}
              className="absolute inset-0"
              width="80"
              height="80"
              viewBox="0 0 80 80"
              style={{ opacity }}
            >
              <line
                x1="40" y1="40"
                x2={x} y2={y}
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx={x} cy={y} r="3" fill={color} />
              <text
                x={labelX} y={labelY}
                fill={color}
                fontSize="11"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
            </svg>
          )
        })}
      </div>
    </div>
  )
}
