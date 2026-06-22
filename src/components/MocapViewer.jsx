import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { applyFrameRotations, createBindQuats, resolveBones } from '../lib/rigController'

export default function MocapViewer({ modelPath, sensorData, previewMode, isPlayingTogether, recordedArm, recordedLeg, playbackFrame, onCameraChange }) {
  const containerRef = useRef(null)
  // Use a ref so the animation loop always reads the latest sensor data
  // without needing to re-run the Three.js setup effect.
  const sensorDataRef = useRef({ ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 })
  const prevAxRef = useRef(0)

  useEffect(() => {
    sensorDataRef.current = sensorData || { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 }
  }, [sensorData])

  // Track state for pathway animation logic
  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container._pathSpeed = 1.0
      container._previewMode = previewMode
      container._isPlayingTogether = isPlayingTogether
      container._recordedArm = recordedArm
      container._recordedLeg = recordedLeg
      container._playbackFrame = playbackFrame
    }
  }, [previewMode, isPlayingTogether, recordedArm, recordedLeg, playbackFrame])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0a0f1e)

    // ── Camera ─────────────────────────────────────────────────────────────
    // Target: chest height ≈ 1.4 m on a ~1.75 m character (scale applied below).
    // Position: slightly above and back to frame the full body.
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100,
    )
    camera.position.set(0, 1.6, 4.5)

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    container.appendChild(renderer.domElement)

    // ── Controls ───────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1.2, 0)   // orbit around chest height
    controls.enableDamping = true
    controls.minDistance = 1.5
    controls.maxDistance = 8
    controls.update()

    // ── Lighting ───────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2)
    keyLight.position.set(2, 4, 3)
    keyLight.castShadow = true
    scene.add(keyLight)
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.4)
    fillLight.position.set(-3, 2, -2)
    scene.add(fillLight)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.3)
    rimLight.position.set(0, 3, -4)
    scene.add(rimLight)

    // ── Grid ───────────────────────────────────────────────────────────────
    const grid = new THREE.GridHelper(6, 24, 0x334155, 0x1e293b)
    scene.add(grid)

    // ── Axes ────────────────────────────────────────────────────────────────
    const axes = new THREE.AxesHelper(2)
    scene.add(axes)

    // Add axis labels
    function createTextLabel(text, color) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      canvas.width = 64
      canvas.height = 64
      context.font = 'bold 48px Arial'
      context.fillStyle = color
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(text, 32, 32)

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.scale.set(0.5, 0.5, 0.5)
      return sprite
    }

    const axisLabelX = createTextLabel('X', '#ff0000')
    const axisLabelY = createTextLabel('Y', '#00ff00')
    const axisLabelZ = createTextLabel('Z', '#0000ff')
    scene.add(axisLabelX, axisLabelY, axisLabelZ)

    // Add directional arrows to pathway
    function createArrowTexture() {
      const canvas = document.createElement('canvas')
      canvas.width = 128
      canvas.height = 128
      const context = canvas.getContext('2d')
      
      // Draw arrow pointing in walking direction
      context.fillStyle = '#64748b'
      context.beginPath()
      context.moveTo(64, 20)
      context.lineTo(44, 80)
      context.lineTo(64, 60)
      context.lineTo(84, 80)
      context.closePath()
      context.fill()
      
      return new THREE.CanvasTexture(canvas)
    }

    const arrowTexture = createArrowTexture()
    const arrowMaterial = new THREE.MeshStandardMaterial({
      map: arrowTexture,
      transparent: true,
      side: THREE.DoubleSide,
    })

    // Create arrow tiles along the pathway
    const arrowGroup = new THREE.Group()
    for (let i = -20; i <= 20; i++) {
      const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), arrowMaterial)
      arrow.rotation.x = -Math.PI / 2
      arrow.rotation.z = Math.PI / 2
      arrow.position.set(i * 2, 0.02, 0)
      arrowGroup.add(arrow)
    }
    scene.add(arrowGroup)

    // ── Model state ────────────────────────────────────────────────────────
    let character = null
    let bones     = null
    let bindQuats = null
    let animId    = 0
    let pathwayOffset = 0

    // ── Load GLB ───────────────────────────────────────────────────────────
    const loader = new GLTFLoader()
    loader.load(
      modelPath,
      (gltf) => {
        character = gltf.scene

        character.traverse((child) => {
          if (child.isMesh) {
            child.castShadow    = true
            child.receiveShadow = true
          }
        })

        // Scale the character to a consistent 1.75 m height and place feet on
        // the grid (Y = 0). The GLB origin is already at foot-level center, so
        // we only need to scale — no manual Y nudging required.
        const box    = new THREE.Box3().setFromObject(character)
        const size   = box.getSize(new THREE.Vector3())
        const scale  = 1.75 / Math.max(size.y, 0.001)
        character.scale.setScalar(scale)

        // After scaling, recalculate the box to position feet exactly on Y=0.
        const box2 = new THREE.Box3().setFromObject(character)
        character.position.set(0, -box2.min.y, 0)

        // Face toward the viewer (+Z direction in glTF = toward camera).
        character.rotation.y = Math.PI

        scene.add(character)

        // Resolve skeleton for animation
        let skeleton = null
        character.traverse((child) => {
          if (child.isSkinnedMesh && child.skeleton) skeleton = child.skeleton
        })

        if (skeleton) {
          // Dump ALL bone names so we can see exactly what the model contains
          console.log('[MocapViewer] All bones:', skeleton.bones.map(b => b.name).join(', '))
          bindQuats = createBindQuats(skeleton)
          bones     = resolveBones(character)
          console.log('[MocapViewer] Resolved:', Object.entries(bones).map(([k,v]) => `${k}=${v?.name ?? 'MISSING'}`).join(', '))
        } else {
          console.warn('[MocapViewer] No skeleton found — dumping all nodes:')
          character.traverse(n => { if (n.name) console.warn(' node:', n.name) })
        }
      },
      undefined,
      (err) => console.error('[MocapViewer] Failed to load model:', modelPath, err),
    )

    // ── Render loop ────────────────────────────────────────────────────────
    const animate = () => {
      animId = requestAnimationFrame(animate)

      if (bones && bindQuats) {
        const data = sensorDataRef.current
        const previewMode = container._previewMode || 'arm'
        const isPlayingTogether = container._isPlayingTogether || false
        const recordedArm = container._recordedArm || null
        const recordedLeg = container._recordedLeg || null
        const playbackFrame = container._playbackFrame || 0
        
        let armSensorData = null
        let legSensorData = null
        
        if (isPlayingTogether && recordedArm && recordedLeg) {
          armSensorData = recordedArm[playbackFrame] || recordedArm[0]
          legSensorData = recordedLeg[playbackFrame] || recordedLeg[0]
        }
        
        applyFrameRotations(bones, bindQuats, data, previewMode, armSensorData, legSensorData)
        character?.updateMatrixWorld(true)

        // Update axes position to edge of floor where model is standing
        axes.position.set(3, 0, 0)
        
        axisLabelX.position.copy(axes.position).add(new THREE.Vector3(1.2, 0, 0))
        axisLabelY.position.copy(axes.position).add(new THREE.Vector3(0, 1.2, 0))
        axisLabelZ.position.copy(axes.position).add(new THREE.Vector3(0, 0, 1.2))

        // Animate pathway based on raw ax to simulate walking
        const axDelta = data.ax - prevAxRef.current
        const speed = container._pathSpeed || 1.0
        if (Math.abs(axDelta) > 0.01) {
          // Use constant speed when ax is non-zero
          const movement = (Math.abs(data.ax) > 0.1 ? 0.02 : 0) * speed
          pathwayOffset += movement
          // Use modulo to create infinite looping effect
          arrowGroup.position.x = pathwayOffset % 4
        }
        prevAxRef.current = data.ax
      }

      controls.update()
      renderer.render(scene, camera)

      // Emit camera quaternion for the axis indicator overlay
      if (onCameraChange) {
        const q = camera.quaternion
        onCameraChange({ x: q.x, y: q.y, z: q.z, w: q.w })
      }
    }
    animate()

    // ── Resize handler ─────────────────────────────────────────────────────
    const onResize = () => {
      const { clientWidth: w, clientHeight: h } = container
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    const resizeObserver = new ResizeObserver(onResize)
    resizeObserver.observe(container)

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId)
      resizeObserver.disconnect()
      controls.dispose()
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [modelPath])

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-[500px] w-full flex-1 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950 shadow-2xl shadow-black/30"
    />
  )
}
