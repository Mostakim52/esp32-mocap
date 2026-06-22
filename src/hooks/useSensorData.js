import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_ANGLES = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 }
const DEFAULT_CALIBRATION = { ax: 0, ay: 0, az: 0, gx: 0, gy: 0, gz: 0 }

function applyCalibration(data, calibration) {
  return {
    ax: data.ax - calibration.ax,
    ay: data.ay - calibration.ay,
    az: data.az - calibration.az,
    gx: data.gx - calibration.gx,
    gy: data.gy - calibration.gy,
    gz: data.gz - calibration.gz,
  }
}

function parseSerialLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Handle ESP32 timestamp prefix (e.g., ":0.333081{"ax":...}")
  let jsonStr = trimmed
  const braceIndex = trimmed.indexOf('{')
  if (braceIndex > 0) {
    jsonStr = trimmed.substring(braceIndex)
  }

  // Handle double curly braces (e.g., "{{"ax":...}}")
  if (jsonStr.startsWith('{{') && jsonStr.endsWith('}}')) {
    jsonStr = jsonStr.substring(1, jsonStr.length - 1)
  }

  // Also handle stray leading/trailing braces from partial reads
  // e.g. "}{"ax":...}" → strip leading "}"
  while (jsonStr.startsWith('}{') || (jsonStr.startsWith('}') && !jsonStr.startsWith('}{'))) {
    jsonStr = jsonStr.substring(1)
  }

  try {
    const json = JSON.parse(jsonStr)
    if (typeof json.ax === 'number' && typeof json.ay === 'number' && 
        typeof json.az === 'number' && typeof json.gx === 'number' &&
        typeof json.gy === 'number' && typeof json.gz === 'number') {
      return { ax: json.ax, ay: json.ay, az: json.az, gx: json.gx, gy: json.gy, gz: json.gz }
    }
  } catch {
    // fall through to text parsers
  }

  // Try extracting just the first {...} JSON object from the line
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const json = JSON.parse(jsonStr.substring(firstBrace, lastBrace + 1))
      if (typeof json.ax === 'number' && typeof json.ay === 'number' && 
          typeof json.az === 'number' && typeof json.gx === 'number' &&
          typeof json.gy === 'number' && typeof json.gz === 'number') {
        return { ax: json.ax, ay: json.ay, az: json.az, gx: json.gx, gy: json.gy, gz: json.gz }
      }
    } catch {
      // fall through
    }
  }

  const csv = trimmed.split(/[,\s]+/).map(Number).filter((n) => !Number.isNaN(n))
  if (csv.length >= 6) {
    return { ax: csv[0], ay: csv[1], az: csv[2], gx: csv[3], gy: csv[4], gz: csv[5] }
  }

  return null
}

export function useSensorData() {
  const [mode, setMode] = useState('simulate')
  const [autoSimulate, setAutoSimulate] = useState(false)
  const [angles, setAngles] = useState(DEFAULT_ANGLES)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('Ready — adjust sliders or enable idle motion')
  const [sampleCount, setSampleCount] = useState(0)
  const [serialOutput, setSerialOutput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordedArm, setRecordedArm] = useState(null)
  const [recordedLeg, setRecordedLeg] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackFrame, setPlaybackFrame] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(5)
  const [previewMode, setPreviewMode] = useState('arm')
  const [isPlayingTogether, setIsPlayingTogether] = useState(false)
  const [serialSupported, setSerialSupported] = useState(true)
  const [calibration, setCalibration] = useState(DEFAULT_CALIBRATION)

  const portRef = useRef(null)
  const readerRef = useRef(null)
  const abortRef = useRef(null)
  const lineBufferRef = useRef('')
  const recordingRef = useRef([])
  const playbackIntervalRef = useRef(null)
  const recordingTimeoutRef = useRef(null)
  const isRecordingRef = useRef(false)
  const calibrationRef = useRef(DEFAULT_CALIBRATION)
  const modeRef = useRef('simulate')

  // Keep refs in sync with state so serial read loop always sees latest values
  useEffect(() => { isRecordingRef.current = isRecording }, [isRecording])
  useEffect(() => { calibrationRef.current = calibration }, [calibration])
  useEffect(() => { modeRef.current = mode }, [mode])

  const disconnectSerial = useCallback(async () => {
    abortRef.current?.abort()
    abortRef.current = null

    if (readerRef.current) {
      try {
        await readerRef.current.cancel()
      } catch {
        // reader may already be released
      }
      readerRef.current = null
    }

    if (portRef.current) {
      try {
        await portRef.current.close()
      } catch {
        // port may already be closed
      }
      portRef.current = null
    }

    setConnected(false)
    setStatus('Serial disconnected')
  }, [])

  const connectSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      setStatus('Web Serial not supported in this browser')
      return
    }

    try {
      await disconnectSerial()

      const port = await navigator.serial.requestPort()
      await port.open({ baudRate: 115200 })
      portRef.current = port

      const abortController = new AbortController()
      abortRef.current = abortController

      const reader = port.readable.getReader()
      readerRef.current = reader
      const decoder = new TextDecoder()

      setMode('serial')
      setConnected(true)
      setStatus('Streaming from ESP32')

      ;(async () => {
        while (!abortController.signal.aborted) {
          const { value, done } = await reader.read()
          if (done) break
          if (!value) continue

          lineBufferRef.current += decoder.decode(value, { stream: true })
          const lines = lineBufferRef.current.split(/\r?\n/)
          lineBufferRef.current = lines.pop() ?? ''

          for (const line of lines) {
            const parsed = parseSerialLine(line)
            if (parsed) {
              const calibrated = applyCalibration(parsed, calibrationRef.current)
              
              // Don't overwrite angles during playback — the playback effect owns them
              if (modeRef.current !== 'playback') {
                setAngles(calibrated)
              }
              setSampleCount((count) => count + 1)
              
              // Add to serial output display
              setSerialOutput((prev) => {
                const newOutput = prev + line + '\n'
                return newOutput.slice(-1000) // Keep last 1000 chars
              })
              
              // Record if recording is active (store calibrated data)
              if (isRecordingRef.current && recordingRef.current) {
                console.log('[Recording] Pushing data, total frames:', recordingRef.current.data.length + 1)
                recordingRef.current.data.push(calibrated)
              }
            } else {
              console.log('[Parsing] Failed to parse line:', line)
            }
          }
        }
      })().catch(() => {
        setStatus('Serial stream ended')
        setConnected(false)
      })
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Serial connection failed')
      setConnected(false)
    }
  }, [disconnectSerial])

  const setSimulatedAngles = useCallback((ax) => {
    setMode('simulate')
    setAutoSimulate(false)
    const ay = 0
    const az = 1.0
    const gx = 0
    const gy = 0
    const gz = 0
    const simulatedData = { ax, ay, az, gx, gy, gz }
    setAngles(simulatedData)
    setSampleCount((count) => count + 1)
    
    // Record if recording is active
    if (isRecording && recordingRef.current) {
      recordingRef.current.data.push(simulatedData)
    }
    
    setStatus('Manual simulation')
  }, [isRecording])

  const enableAutoSimulation = useCallback(() => {
    setMode('simulate')
    setAutoSimulate(true)
    setStatus('Idle motion active')
  }, [])

  const selectSimulateMode = useCallback(() => {
    setMode('simulate')
    setAutoSimulate(false)
    setIsPlaying(false)
    setStatus('Manual simulation — use sliders')
  }, [])

  const calibrateSensor = useCallback(() => {
    setCalibration(angles)
    setStatus('Calibration saved - current position is now zero')
  }, [angles])

  const resetCalibration = useCallback(() => {
    setCalibration(DEFAULT_CALIBRATION)
    setStatus('Calibration reset to default')
  }, [])

  const stopRecording = useCallback(() => {
    setIsRecording(false)
    if (recordingTimeoutRef.current) {
      window.clearTimeout(recordingTimeoutRef.current)
      recordingTimeoutRef.current = null
    }
    const recording = recordingRef.current
    
    // Always set recorded state so playback UI shows up
    if (recording) {
      const data = recording.data || []
      if (recording.type === 'arm') {
        setRecordedArm(data)
        setStatus(data.length > 0 ? 'Arm movement saved' : 'Arm recording stopped — no data captured')
      } else if (recording.type === 'leg') {
        setRecordedLeg(data)
        setStatus(data.length > 0 ? 'Leg movement saved' : 'Leg recording stopped — no data captured')
      }
    } else {
      setStatus('Recording stopped — no data')
    }
    recordingRef.current = []
  }, [])

  const startRecording = useCallback((type) => {
    console.log('[startRecording] Starting recording for:', type)
    setIsRecording(true)
    recordingRef.current = { type: type, data: [] }
    setStatus(`Recording ${type}...`)
    
    // Auto-stop after specified duration
    recordingTimeoutRef.current = window.setTimeout(() => {
      stopRecording()
    }, recordingDuration * 1000)
  }, [recordingDuration, stopRecording])

  const playRecording = useCallback(() => {
    const recording = recordedArm || recordedLeg
    if (!recording || recording.length === 0) {
      setStatus('No recording to play')
      return
    }
    
    setIsPlaying(true)
    setPlaybackFrame(0)
    setMode('playback')
    setStatus('Playing recording...')
    
    playbackIntervalRef.current = window.setInterval(() => {
      setPlaybackFrame((frame) => {
        const nextFrame = frame + 1
        if (nextFrame >= recording.length) {
          return 0 // Loop
        }
        return nextFrame
      })
    }, 50) // 20Hz playback
  }, [recordedArm, recordedLeg])

  const stopPlayback = useCallback(() => {
    setIsPlaying(false)
    setIsPlayingTogether(false)
    setPlaybackFrame(0)
    if (playbackIntervalRef.current) {
      window.clearInterval(playbackIntervalRef.current)
      playbackIntervalRef.current = null
    }
    setMode('simulate')
    setStatus('Playback stopped')
  }, [])

  const playTogether = useCallback(() => {
    if (!recordedArm || !recordedLeg) {
      setStatus('Need both arm and leg recordings to play together')
      return
    }
    
    setIsPlaying(true)
    setIsPlayingTogether(true)
    setPlaybackFrame(0)
    setMode('playback')
    setStatus('Playing arm and leg together...')
    
    const maxLength = Math.max(recordedArm.length, recordedLeg.length)
    
    playbackIntervalRef.current = window.setInterval(() => {
      setPlaybackFrame((frame) => {
        const nextFrame = frame + 1
        if (nextFrame >= maxLength) {
          return 0 // Loop
        }
        return nextFrame
      })
    }, 50) // 20Hz playback
  }, [recordedArm, recordedLeg])

  useEffect(() => {
    if (mode !== 'simulate' || !autoSimulate) return undefined

    let frame = 0
    const id = window.setInterval(() => {
      frame += 1
      // Generate raw x, y, z values for simulation
      const roll = Math.sin(frame * 0.04) * 14
      const ax = Math.sin(frame * 0.03) * 0.5
      const ay = Math.cos(frame * 0.03) * 0.5
      const az = 1.0
      const gx = Math.sin(frame * 0.05) * 10
      const gy = Math.cos(frame * 0.05) * 10
      const gz = 0
      const simulatedData = { ax, ay, az, gx, gy, gz }
      setAngles(simulatedData)
      setSampleCount((count) => count + 1)
      
      // Record if recording is active
      if (isRecording && recordingRef.current) {
        recordingRef.current.data.push(simulatedData)
      }
    }, 50)

    return () => window.clearInterval(id)
  }, [mode, autoSimulate, isRecording])

  // Check Web Serial API support on mount
  useEffect(() => {
    setSerialSupported('serial' in navigator)
    if (!('serial' in navigator)) {
      setStatus('Web Serial not supported in this browser. Use Chrome, Edge, or Opera on desktop.')
    }
  }, [])

  // Playback mode effect
  useEffect(() => {
    if (mode !== 'playback' || !isPlaying) return undefined

    const recording = recordedArm || recordedLeg
    if (!recording || recording.length === 0) return undefined

    // If playing together, use separate arm and leg angles
    if (isPlayingTogether && recordedArm && recordedLeg) {
      const armFrame = recordedArm[playbackFrame] || recordedArm[0]
      const legFrame = recordedLeg[playbackFrame] || recordedLeg[0]
      // Set angles to arm frame (leg frame will be passed separately via container)
      setAngles(armFrame)
    } else {
      setAngles(recording[playbackFrame])
    }
    setSampleCount((count) => count + 1)

    return undefined
  }, [mode, isPlaying, isPlayingTogether, playbackFrame, recordedArm, recordedLeg])

  useEffect(() => () => {
    disconnectSerial()
  }, [disconnectSerial])

  return {
    mode,
    angles,
    connected,
    status,
    sampleCount,
    autoSimulate,
    serialOutput,
    isRecording,
    recordedArm,
    recordedLeg,
    isPlaying,
    isPlayingTogether,
    playbackFrame,
    recordingDuration,
    previewMode,
    serialSupported,
    calibration,
    setMode,
    setSimulatedAngles,
    selectSimulateMode,
    enableAutoSimulation,
    connectSerial,
    disconnectSerial,
    startRecording,
    stopRecording,
    playRecording,
    playTogether,
    stopPlayback,
    setRecordingDuration,
    setPreviewMode,
    calibrateSensor,
    resetCalibration,
  }
}
