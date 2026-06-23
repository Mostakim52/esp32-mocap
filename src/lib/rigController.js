import { Euler, Quaternion, Vector3 } from 'three'

// ─── Tuning constants ─────────────────────────────────────────────────────────

// Arms hang naturally at the sides. -30° from T-pose brings them to a
// relaxed standing position. Sensor roll then swings them forward/back
// within the ROLL_RANGE window — matching the ±23° the legs already use.
const ARM_HANG_OFFSET_DEG = -90
const ARM_ROLL_SCALE      = 120.0   // Increased for larger movements

// Two-Bone IK constants
const UPPER_ARM_LENGTH = 3.0       // Length of upper arm (shoulder to elbow)
const FOREARM_LENGTH = 2.5         // Length of forearm (elbow to hand)
const POLE_VECTOR = new Vector3(0, -1, 0)  // Elbow bends downward by default

// Palm-held sensor orientation constants
const SENSOR_FORWARD_AXIS = 'ay'   // Which axis corresponds to forward/backward swing
const SENSOR_SCALE = 6.0           // Scale factor for sensor sensitivity (increased)
const ARM_SWING_AMPLITUDE = 2.0    // Maximum arm swing amplitude (increased)

// Legs: UpLeg bind is ~180° flipped on Z, so we negate both axes to
// make positive roll = leg swings forward.
const LEG_PITCH_SIGN = -1
const LEG_ROLL_SIGN  = -1
const LEG_ROLL_SCALE = 120.0       // Increased for larger movements

// ─── Euler/Quaternion order per limb type ─────────────────────────────────────
export const LIMB_ROTATION_CONFIG = {
  arm: { order: 'YXZ', pitchAxis: 'z', rollAxis: 'x' },
  leg: { order: 'XZY', pitchAxis: 'x', rollAxis: 'z' },
}

// Static pre-allocated — no GC pressure in the render loop
const _euler = new Euler()
const _quat  = new Quaternion()

// ─── Bone resolution ─────────────────────────────────────────────────────────

const BONE_CANDIDATES = {
  leftArm:    ['mixamorig:LeftArm',    'mixamorigLeftArm',    'LeftArm'],
  rightArm:   ['mixamorig:RightArm',   'mixamorigRightArm',   'RightArm'],
  leftForeArm: ['mixamorig:LeftForeArm', 'mixamorigLeftForeArm', 'LeftForeArm'],
  rightForeArm: ['mixamorig:RightForeArm', 'mixamorigRightForeArm', 'RightForeArm'],
  leftUpLeg:  ['mixamorig:LeftUpLeg',  'mixamorigLeftUpLeg',  'LeftUpLeg'],
  rightUpLeg: ['mixamorig:RightUpLeg', 'mixamorigRightUpLeg', 'RightUpLeg'],
}

export function createBindQuats(skeleton) {
  const bindQuats = {}
  for (const bone of skeleton.bones) {
    bindQuats[bone.name] = bone.quaternion.clone()
  }
  return bindQuats
}

export function resolveBones(root) {
  const allNodes = []
  root.traverse((n) => { if (n.name) allNodes.push(n) })
  console.log('[rig] All nodes:', allNodes.map(n => n.name).join(' | '))

  const bones = {}
  for (const [key, candidates] of Object.entries(BONE_CANDIDATES)) {
    let found = null
    for (const name of candidates) {
      found = allNodes.find(n => n.name === name) ?? null
      if (found) { console.log(`[rig] ${key} → "${name}"`); break }
    }
    if (!found) {
      // Fuzzy: ends with the core name, case-insensitive
      const core = candidates[candidates.length - 1].toLowerCase()
      found = allNodes.find(n => n.name.toLowerCase().endsWith(core)) ?? null
      if (found) console.log(`[rig] ${key} → fuzzy "${found.name}"`)
      else       console.warn(`[rig] MISSING: ${key}`)
    }
    bones[key] = found
  }
  return bones
}

// ─── Two-Bone IK Solver ─────────────────────────────────────────────────────

/**
 * Two-Bone IK solver using Law of Cosines.
 * Automatically rotates shoulder and elbow to match hand position.
 * 
 * @param {import('three').Bone} shoulder - Upper arm bone
 * @param {import('three').Bone} elbow - Forearm bone
 * @param {import('three').Vector3} target - Target position for hand
 * @param {import('three').Vector3} poleVector - Controls elbow bend direction
 * @param {number} upperArmLength - Length of upper arm
 * @param {number} forearmLength - Length of forearm
 * @param {Record<string, import('three').Quaternion>} bindQuats
 */
function solveTwoBoneIK(shoulder, elbow, target, poleVector, upperArmLength, forearmLength, bindQuats) {
  if (!shoulder || !elbow) return

  // Get shoulder position in world space
  const shoulderPos = new Vector3()
  shoulder.getWorldPosition(shoulderPos)

  // Calculate vector from shoulder to target
  const shoulderToTarget = new Vector3().subVectors(target, shoulderPos)
  const targetDistance = shoulderToTarget.length()

  // Combined arm length
  const totalArmLength = upperArmLength + forearmLength

  // If target is out of reach, stretch arm completely straight
  let stretchFactor = 1.0
  if (targetDistance > totalArmLength) {
    stretchFactor = targetDistance / totalArmLength
    shoulderToTarget.normalize().multiplyScalar(totalArmLength)
  }

  // Use Law of Cosines to find elbow angle
  // c^2 = a^2 + b^2 - 2ab*cos(C)
  // cos(elbowAngle) = (upperArmLength^2 + forearmLength^2 - targetDistance^2) / (2 * upperArmLength * forearmLength)
  const cosElbowAngle = (upperArmLength * upperArmLength + forearmLength * forearmLength - targetDistance * targetDistance) / (2 * upperArmLength * forearmLength)
  const elbowAngle = Math.acos(Math.max(-1, Math.min(1, cosElbowAngle)))

  // Calculate shoulder angle using Law of Cosines
  // cos(shoulderAngle) = (upperArmLength^2 + targetDistance^2 - forearmLength^2) / (2 * upperArmLength * targetDistance)
  const cosShoulderAngle = (upperArmLength * upperArmLength + targetDistance * targetDistance - forearmLength * forearmLength) / (2 * upperArmLength * targetDistance)
  const shoulderAngle = Math.acos(Math.max(-1, Math.min(1, cosShoulderAngle)))

  // Calculate elbow position using Law of Cosines
  const elbowDistance = upperArmLength
  const elbowPos = new Vector3()
    .copy(shoulderToTarget)
    .normalize()
    .multiplyScalar(elbowDistance)

  // Apply pole vector to control elbow bend direction
  const shoulderToElbow = new Vector3().subVectors(elbowPos, shoulderPos).normalize()
  const shoulderToTargetNorm = shoulderToTarget.clone().normalize()
  const crossProduct = new Vector3().crossVectors(shoulderToTargetNorm, poleVector).normalize()
  const elbowBendDir = new Vector3().crossVectors(crossProduct, shoulderToTargetNorm).normalize()

  // Adjust elbow position based on pole vector
  const elbowOffset = elbowBendDir.multiplyScalar(Math.sin(elbowAngle) * upperArmLength)
  elbowPos.add(elbowOffset)

  // Rotate shoulder to point toward elbow
  const shoulderDirection = new Vector3().subVectors(elbowPos, shoulderPos).normalize()
  const shoulderQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), shoulderDirection)
  shoulder.quaternion.copy(bindQuats[shoulder.name]).multiply(shoulderQuaternion)

  // Rotate elbow to point toward target
  const elbowDirection = new Vector3().subVectors(target, elbowPos).normalize()
  const elbowQuaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), elbowDirection)
  elbow.quaternion.copy(bindQuats[elbow.name]).multiply(elbowQuaternion)
}

// ─── Per-frame application ────────────────────────────────────────────────────

/**
 * Apply a single axis rotation on top of the bind pose quaternion.
 * Pitch is always forced to 0 — only roll drives limb movement.
 *
 * @param {import('three').Bone|null} bone
 * @param {Record<string, import('three').Quaternion>} bindQuats
 * @param {number} rollDeg   — sensor roll in degrees
 * @param {{ order:string, pitchAxis:string, rollAxis:string }} config
 * @param {{ hangOffsetDeg?:number, rollScale?:number, rollSign?:number }} opts
 */
function applyRoll(bone, bindQuats, rollDeg, config, opts = {}) {
  if (!bone) return
  const { hangOffsetDeg = 0, rollScale = 1, rollSign = 1 } = opts

  // Reset to bind pose every frame — no drift
  bone.quaternion.copy(bindQuats[bone.name])

  // Optional static offset (e.g. bring arms down from T-pose)
  if (hangOffsetDeg !== 0) {
    _euler.set(0, 0, 0, config.order)
    _euler[config.pitchAxis] = (hangOffsetDeg * Math.PI) / 180
    bone.quaternion.multiply(_quat.setFromEuler(_euler))
  }

  // Sensor roll delta — pitch is always 0
  const rollRad = (rollSign * rollScale * rollDeg * Math.PI) / 180
  _euler.set(0, 0, 0, config.order)
  _euler[config.rollAxis] = rollRad
  bone.quaternion.multiply(_quat.setFromEuler(_euler))
}

/**
 * Drive all four limbs from raw sensor x, y, z values.
 * Arms use direct rotation for natural swing motion with straight elbows.
 * Legs use direct rotation.
 */
export function applyFrameRotations(bones, bindQuats, sensorData, previewMode = 'both', armSensorData = null, legSensorData = null, armScale = 1.0, legScale = 1.0) {
  const armCfg = LIMB_ROTATION_CONFIG.arm
  const legCfg = LIMB_ROTATION_CONFIG.leg

  // Use raw accelerometer x, y, z values directly
  const data = sensorData || { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 }

  // Arms: use direct rotation for natural swing motion
  // Only apply if previewMode is 'arm' or 'both', or if armSensorData is provided (play together mode)
  if (previewMode === 'arm' || previewMode === 'both' || armSensorData) {
    const armData = armSensorData || data
    
    // Direct rotation mapping for natural arm swing
    // ay controls forward/backward swing (pitch)
    // ax controls lateral movement (roll)
    // az controls vertical movement (additional pitch)
    
    // Left arm: rotate 90° around Y to face Z plane
    applyRawRotation(bones.leftArm, bindQuats, armData, armCfg, { 
      hangOffsetYDeg: 270,
      hangOffsetDeg: -85, 
      scaleX: ARM_ROLL_SCALE * armScale, 
      sign: 1 
    })
    // Roll left arm around shoulder (Y axis)
    _euler.set(0, 0, 0, armCfg.order)
    _euler.y = Math.PI * -1.5
    bones.leftArm.quaternion.multiply(_quat.setFromEuler(_euler))
    
    // Right arm: rotate 90° around Y to face Z plane, opposite movement direction
    const rightArmData = {
      ax: -armData.ax,
      ay: -armData.ay,
      az: -armData.az,
      gx: -armData.gx,
      gy: -armData.gy,
      gz: -armData.gz,
    }
    applyRawRotation(bones.rightArm, bindQuats, rightArmData, armCfg, { 
      hangOffsetYDeg: 270,
      hangOffsetDeg: -85, 
      scaleX: ARM_ROLL_SCALE * armScale, 
      sign: -1 
    })
    // Roll right arm 180° around shoulder (Y axis)
    _euler.set(0, 0, 0, armCfg.order)
    _euler.y = Math.PI*-1.5
    bones.rightArm.quaternion.multiply(_quat.setFromEuler(_euler))
    
    // Keep forearms straight (no rotation) to maintain elbow straight
    if (bones.leftForeArm) {
      bones.leftForeArm.quaternion.copy(bindQuats[bones.leftForeArm.name])
    }
    if (bones.rightForeArm) {
      bones.rightForeArm.quaternion.copy(bindQuats[bones.rightForeArm.name])
    }
  }

  // Legs: use direct rotation
  // Only apply if previewMode is 'leg' or 'both', or if legSensorData is provided (play together mode)
  if (previewMode === 'leg' || previewMode === 'both' || legSensorData) {
    const legData = legSensorData || data
    applyRawRotation(bones.leftUpLeg,  bindQuats, legData, legCfg, { scaleX: LEG_ROLL_SCALE * legScale, sign: LEG_PITCH_SIGN * LEG_ROLL_SIGN * -1 })
    applyRawRotation(bones.rightUpLeg, bindQuats, legData, legCfg, { scaleX: LEG_ROLL_SCALE * legScale, sign: LEG_PITCH_SIGN * LEG_ROLL_SIGN *  1 })
  }
}

// Apply raw accelerometer x, y, z values directly to bone rotation
function applyRawRotation(bone, bindQuats, sensorData, config, opts = {}) {
  if (!bone) return
  const { hangOffsetDeg = 0, hangOffsetYDeg = 0, scaleX = 1, sign = 1 } = opts

  // Reset to bind pose every frame — no drift
  bone.quaternion.copy(bindQuats[bone.name])

  // Optional Y-axis offset (e.g. rotate arms from X plane to Z plane)
  if (hangOffsetYDeg !== 0) {
    _euler.set(0, 0, 0, config.order)
    _euler.y = (hangOffsetYDeg * Math.PI) / 180
    bone.quaternion.multiply(_quat.setFromEuler(_euler))
  }

  // Optional pitch-axis offset (e.g. bring arms down from T-pose)
  if (hangOffsetDeg !== 0) {
    _euler.set(0, 0, 0, config.order)
    _euler[config.pitchAxis] = (hangOffsetDeg * Math.PI) / 180
    bone.quaternion.multiply(_quat.setFromEuler(_euler))
  }

  // Apply raw accelerometer x, y, z values directly
  // Use ax for roll axis, ay for pitch axis (inverted), az for additional rotation
  const rollRad = (sign * scaleX * sensorData.ax * Math.PI) / 180
  const pitchRad = (-sign * scaleX * sensorData.ay * Math.PI) / 180  // Inverted ay
  
  _euler.set(0, 0, 0, config.order)
  _euler[config.rollAxis] = rollRad
  _euler[config.pitchAxis] = pitchRad
  bone.quaternion.multiply(_quat.setFromEuler(_euler))
}

// Kept for SensorPanel display — pitch is always 0 now
export function mirrorAngles(_pitch, roll) {
  return {
    left:  { pitch: 0, roll:  roll },
    right: { pitch: 0, roll: -roll },
  }
}
