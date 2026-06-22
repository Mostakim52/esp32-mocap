import { useEffect, useMemo, useRef, useState } from 'react'
import MocapViewer from './components/MocapViewer'
import SensorPanel from './components/SensorPanel'
import AxisIndicator from './components/AxisIndicator'
import { useSensorData } from './hooks/useSensorData'

export default function App() {
  const [model, setModel] = useState('female')
  const [cameraQuat, setCameraQuat] = useState(null)
  const serialEndRef = useRef(null)

  const {
    angles,
    connected,
    status,
    sampleCount,
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
    connectSerial,
    disconnectSerial,
    startRecording,
    stopRecording,
    playRecording,
    playTogether,
    stopPlayback,
    setRecordingDuration,
    setPreviewMode,
  } = useSensorData()

  const modelPath = useMemo(
    () => `/models/${model}.glb`,
    [model],
  )

  // Auto-scroll serial output
  useEffect(() => {
    if (serialEndRef.current) {
      serialEndRef.current.scrollTop = serialEndRef.current.scrollHeight
    }
  }, [serialOutput])

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center gap-3 border-b border-slate-800/80 bg-slate-950/80 px-5 py-3 backdrop-blur-md">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a4 4 0 0 0-4 4v2a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4z" />
            <path d="M6 10v1a6 6 0 0 0 12 0v-1" />
            <line x1="12" y1="17" x2="12" y2="22" />
          </svg>
        </div>
        <div>
          <h1 className="text-sm font-semibold tracking-tight text-white">ESP32 Mocap Visualizer</h1>
          <p className="text-xs text-slate-500">Real-time motion capture from Arduino Nano</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse-dot' : 'bg-slate-600'}`} />
          <span className="text-xs text-slate-400">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden lg:flex-row">
        <SensorPanel
          angles={angles}
          connected={connected}
          status={status}
          sampleCount={sampleCount}
          model={model}
          isRecording={isRecording}
          recordedArm={recordedArm}
          recordedLeg={recordedLeg}
          isPlaying={isPlaying}
          playbackFrame={playbackFrame}
          recordingDuration={recordingDuration}
          previewMode={previewMode}
          serialSupported={serialSupported}
          onModelChange={setModel}
          onConnectSerial={connectSerial}
          onDisconnectSerial={disconnectSerial}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onPlayRecording={playRecording}
          onPlayTogether={playTogether}
          onStopPlayback={stopPlayback}
          onRecordingDurationChange={setRecordingDuration}
          onPreviewModeChange={setPreviewMode}
        />

        <main className="relative flex flex-1 flex-col p-4">
          <MocapViewer
            key={modelPath}
            modelPath={modelPath}
            sensorData={angles}
            previewMode={previewMode}
            isPlayingTogether={isPlayingTogether}
            recordedArm={recordedArm}
            recordedLeg={recordedLeg}
            playbackFrame={playbackFrame}
            onCameraChange={setCameraQuat}
          />

          {/* Serial output overlay — top of 3D view */}
          {connected && serialOutput && (
            <div
              ref={serialEndRef}
              className="pointer-events-none absolute inset-x-4 top-4 z-10 max-h-[140px] overflow-y-auto rounded-lg border border-slate-700/40 bg-slate-950/70 p-3 font-mono text-[11px] leading-relaxed text-emerald-400/80 backdrop-blur-sm"
            >
              <pre className="whitespace-pre-wrap">{serialOutput}</pre>
            </div>
          )}

          {/* 3D axis indicator — bottom-left */}
          <AxisIndicator cameraQuat={cameraQuat} />
        </main>
      </div>
    </div>
  )
}
