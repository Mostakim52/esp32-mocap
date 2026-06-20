import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Color,
  AmbientLight,
  DirectionalLight,
  Box3,
  Vector3,
  Euler,
  Quaternion,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createBindQuats, applyFrameRotations, resolveBones } from '../src/lib/rigController.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function renderPose(pitch, roll, outFile) {
  const scene = new Scene()
  scene.background = new Color(0x0f172a)

  const camera = new PerspectiveCamera(45, 1280 / 720, 0.1, 100)
  camera.position.set(0, 1.4, 3.2)
  camera.lookAt(0, 1, 0)

  const renderer = new WebGLRenderer({ antialias: true })
  renderer.setSize(1280, 720)

  scene.add(new AmbientLight(0xffffff, 0.55))
  const key = new DirectionalLight(0xffffff, 1.1)
  key.position.set(2, 4, 3)
  scene.add(key)

  const loader = new GLTFLoader()
  const buf = readFileSync(join(__dirname, '../public/models/male.glb'))
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)

  return new Promise((resolve, reject) => {
    loader.parse(ab, '', (gltf) => {
      const character = gltf.scene
      const box = new Box3().setFromObject(character)
      const center = box.getCenter(new Vector3())
      const scale = 1.75 / Math.max(box.getSize(new Vector3()).y, 0.001)
      character.scale.setScalar(scale)
      character.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
      scene.add(character)

      let skeleton = null
      character.traverse((child) => {
        if (child.isSkinnedMesh && child.skeleton) skeleton = child.skeleton
      })

      const bindQuats = createBindQuats(skeleton)
      const bones = resolveBones(character)
      applyFrameRotations(bones, bindQuats, pitch, roll)
      character.updateMatrixWorld(true)

      renderer.render(scene, camera)
      const png = renderer.domElement.toDataURL('image/png').split(',')[1]
      writeFileSync(outFile, Buffer.from(png, 'base64'))
      renderer.dispose()
      resolve()
    }, undefined, reject)
  })
}

mkdirSync(join(__dirname, '../test-output'), { recursive: true })
await renderPose(0, 0, join(__dirname, '../test-output/rest.png'))
await renderPose(-29, -25, join(__dirname, '../test-output/pose-manual.png'))
await renderPose(1, -17, join(__dirname, '../test-output/pose-auto.png'))
console.log('rendered test-output/*.png')
