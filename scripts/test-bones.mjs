import { readFileSync } from 'fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { Euler, Quaternion, Vector3 } from 'three'

function singleAxis(bone, bindQ, axis, deg) {
  bone.quaternion.copy(bindQ)
  const e = new Euler()
  e[axis] = (deg * Math.PI) / 180
  bone.quaternion.multiply(new Quaternion().setFromEuler(e))
  bone.updateMatrixWorld(true)
  return new Vector3(0, bone.position.length(), 0).applyMatrix4(bone.matrixWorld)
}

function buildEuler(pitchDeg, rollDeg, pitchAxis, rollAxis, order) {
  const e = new Euler(0, 0, 0, order)
  e[pitchAxis] = (pitchDeg * Math.PI) / 180
  e[rollAxis] = (rollDeg * Math.PI) / 180
  return e
}

function applyMapping(bone, bindQ, pitch, roll, pitchAxis, rollAxis, order) {
  bone.quaternion.copy(bindQ)
  const e = buildEuler(pitch, roll, pitchAxis, rollAxis, order)
  bone.quaternion.multiply(new Quaternion().setFromEuler(e))
  bone.updateMatrixWorld(true)
  return new Vector3(0, bone.position.length(), 0).applyMatrix4(bone.matrixWorld)
}

const loader = new GLTFLoader()
const buf = readFileSync('public/models/male.glb')
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  gltf.scene.updateMatrixWorld(true)

  const configs = [
    ['arm spec x/z YXZ', 'mixamorigLeftArm', 'x', 'z', 'YXZ'],
    ['arm z/x YXZ', 'mixamorigLeftArm', 'z', 'x', 'YXZ'],
    ['arm z/x XYZ', 'mixamorigLeftArm', 'z', 'x', 'XYZ'],
    ['leg spec x/z XZY', 'mixamorigLeftUpLeg', 'x', 'z', 'XZY'],
    ['leg y/x XZY', 'mixamorigLeftUpLeg', 'y', 'x', 'XZY'],
    ['leg y/x YXZ', 'mixamorigLeftUpLeg', 'y', 'x', 'YXZ'],
  ]

  for (const [label, name, pa, ra, order] of configs) {
    const bone = gltf.scene.getObjectByName(name)
    const bindQ = bone.quaternion.clone()
    const rest = new Vector3(0, bone.position.length(), 0).applyMatrix4(bone.matrixWorld)
    const tip = applyMapping(bone, bindQ, 35, 25, pa, ra, order)
    console.log(label, 'delta', tip.distanceTo(rest).toFixed(3), 'tipY', tip.y.toFixed(2), 'tipZ', tip.z.toFixed(2))
  }
})
