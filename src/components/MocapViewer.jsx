import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { applyFrameRotations, createBindQuats, resolveBones } from '../lib/rigController'
import { useTheme } from '../context/ThemeContext'

export default function MocapViewer({ modelPath, sensorData, previewMode, isPlayingTogether, recordedArm, recordedLeg, playbackFrame, armScale, legScale, pathSpeed, onCameraChange }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const containerRef = useRef(null)
  // Use a ref so the animation loop always reads the latest sensor data
  // without needing to re-run the Three.js setup effect.
  const sensorDataRef = useRef({ ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 })
  const armScaleRef = useRef(armScale)
  const legScaleRef = useRef(legScale)
  const pathSpeedRef = useRef(pathSpeed)

  useEffect(() => {
    sensorDataRef.current = sensorData || { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 }
  }, [sensorData])

  useEffect(() => { armScaleRef.current = armScale }, [armScale])
  useEffect(() => { legScaleRef.current = legScale }, [legScale])
  useEffect(() => { pathSpeedRef.current = pathSpeed }, [pathSpeed])

  // Track state for pathway animation logic
  useEffect(() => {
    const container = containerRef.current
    if (container) {
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
    scene.background = new THREE.Color(isDark ? 0x0a0f1e : 0xf0f4f8)

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

    // ── Axis overlay (renders xyz_axis.glb via main renderer) ──────────
    const axisScene = new THREE.Scene()
    axisScene.background = new THREE.Color(isDark ? 0x0a0f1e : 0xf0f4f8)
    const axisFrustum = 2
    const axisCamera = new THREE.OrthographicCamera(
      -axisFrustum, axisFrustum, axisFrustum, -axisFrustum, 0.1, 100,
    )
    axisCamera.position.set(0, 0, 3)
    axisScene.add(axisCamera)
    axisScene.add(new THREE.AmbientLight(0xffffff, 1.0))
    const axisDirLight = new THREE.DirectionalLight(0xffffff, 1.0)
    axisDirLight.position.set(2, 3, 4)
    axisScene.add(axisDirLight)

    let axisModel = null
    const axisOverlayGroup = new THREE.Group()
    axisScene.add(axisOverlayGroup)
    const axisLoader = new GLTFLoader()
    axisLoader.load(
      '/models/xyz_axis.glb',
      (gltf) => {
        axisModel = gltf.scene
        axisModel.traverse((child) => {
          if (child.isMesh) {
            const srcMat = child.material
            const color = srcMat.color || new THREE.Color(0xffffff)
            child.material = new THREE.MeshBasicMaterial({ color })
          }
        })
        const box = new THREE.Box3().setFromObject(axisModel)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const targetSize = 1.8
        axisModel.scale.setScalar(targetSize / maxDim)
        axisModel.position.set(
          -center.x * (targetSize / maxDim),
          -center.y * (targetSize / maxDim),
          -center.z * (targetSize / maxDim),
        )
        axisOverlayGroup.add(axisModel)
      },
      undefined,
      (err) => console.error('[MocapViewer] Failed to load axis model:', err),
    )

    // ── 3D Axis Helper (in-scene, thick lines + labels) ───────────────
    const axisGroup = new THREE.Group()
    const axisLen = 1.5
    const axisRadius = 0.02
    const axes = [
      { label: 'X', color: 0xef4444, dir: new THREE.Vector3(1, 0, 0) },
      { label: 'Y', color: 0x3b82f6, dir: new THREE.Vector3(0, 1, 0) },
      { label: 'Z', color: 0x22c55e, dir: new THREE.Vector3(0, 0, 1) },
    ]
    for (const { label, color, dir } of axes) {
      const geo = new THREE.CylinderGeometry(axisRadius, axisRadius, axisLen, 8)
      geo.translate(0, axisLen / 2, 0)
      const mat = new THREE.MeshBasicMaterial({ color })
      const line = new THREE.Mesh(geo, mat)
      if (dir.x) line.rotation.z = -Math.PI / 2
      if (dir.z) line.rotation.x = Math.PI / 2
      axisGroup.add(line)

      // Tip sphere
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(axisRadius * 1.8, 8, 8),
        new THREE.MeshBasicMaterial({ color }),
      )
      tip.position.copy(dir).multiplyScalar(axisLen)
      axisGroup.add(tip)

      // Text label via canvas sprite
      const canvas = document.createElement('canvas')
      canvas.width = 64
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#' + color.toString(16).padStart(6, '0')
      ctx.font = 'bold 48px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, 32, 32)
      const tex = new THREE.CanvasTexture(canvas)
      const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(0.25, 0.25, 1)
      sprite.position.copy(dir).multiplyScalar(axisLen + 0.2)
      axisGroup.add(sprite)
    }
    scene.add(axisGroup)
    axisGroup.position.set(-2.5, 0, -2.5)

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
    const grid = new THREE.GridHelper(6, 24, isDark ? 0x334155 : 0xcbd5e1, isDark ? 0x1e293b : 0xe2e8f0)
    scene.add(grid)

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
        
        applyFrameRotations(bones, bindQuats, data, previewMode, armSensorData, legSensorData, armScaleRef.current, legScaleRef.current)
        character?.updateMatrixWorld(true)

        // Animate pathway only during playback
        if (isPlayingTogether) {
          const speed = pathSpeedRef.current
          pathwayOffset += 0.02 * speed
          arrowGroup.position.x = pathwayOffset % 4
        }
      }

      controls.update()
      renderer.render(scene, camera)

      // Render axis overlay in top-right corner using same renderer
      if (axisModel) {
        axisOverlayGroup.quaternion.copy(camera.quaternion).invert()
        const overlaySize = 120
        const margin = 12
        const dpr = window.devicePixelRatio
        const overlayW = overlaySize * dpr
        const overlayH = overlaySize * dpr
        const overlayX = renderer.domElement.width - (margin + overlaySize) * dpr
        const overlayY = renderer.domElement.height - (margin + overlaySize) * dpr
        renderer.autoClear = false
        renderer.setScissorTest(true)
        renderer.setScissor(overlayX, overlayY, overlayW, overlayH)
        renderer.setViewport(overlayX, overlayY, overlayW, overlayH)
        renderer.clear(true, true, false)
        renderer.render(axisScene, axisCamera)
        renderer.setScissorTest(false)
        renderer.setViewport(0, 0, renderer.domElement.width, renderer.domElement.height)
        renderer.autoClear = true
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
  }, [modelPath, isDark])

  return (
    <div
      ref={containerRef}
      className={`relative h-full min-h-[500px] w-full flex-1 overflow-hidden rounded-xl border shadow-2xl ${isDark ? 'border-slate-800/80 bg-slate-950 shadow-black/30' : 'border-gray-200 bg-gray-100 shadow-gray-300/30'}`}
    >
      <div
        className={`pointer-events-none absolute right-3 top-3 z-10 overflow-hidden rounded-lg border ${isDark ? 'border-slate-700/50' : 'border-gray-300/50'}`}
        style={{ width: 120, height: 120 }}
      />
    </div>
  )
}
