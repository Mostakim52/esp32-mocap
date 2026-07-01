import { useEffect, useMemo, useRef, useState } from 'react'
import MocapViewer from './components/MocapViewer'
import SensorPanel from './components/SensorPanel'
import { useSensorData } from './hooks/useSensorData'
import { useTheme } from './context/ThemeContext'

export default function App() {
  const { theme, toggleTheme } = useTheme()
  const [model, setModel] = useState('female')
  const [cameraQuat, setCameraQuat] = useState(null)
  const [armScale, setArmScale] = useState(1.0)
  const [legScale, setLegScale] = useState(1.0)
  const [pathSpeed, setPathSpeed] = useState(1.0)
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

  useEffect(() => {
    if (serialEndRef.current) {
      serialEndRef.current.scrollTop = serialEndRef.current.scrollHeight
    }
  }, [serialOutput])

  const isDark = theme === 'dark'

  return (
    <div className={`flex min-h-screen flex-col ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-gray-100 text-gray-900'}`}>
      <header className={`flex items-center gap-3 border-b px-5 py-3 backdrop-blur-md ${isDark ? 'border-slate-800/80 bg-slate-950/80' : 'border-gray-200 bg-white/80'}`}>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-100 text-cyan-600'}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="2" />
            <path d="M10 22V17L7 14V10l5-1 5 1v4l-3 3v5" />
            <circle cx="7" cy="14" r="1" fill="currentColor" stroke="none" />
            <circle cx="17" cy="10" r="1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div>
          <h1 className={`text-sm font-semibold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>ESP32 Mocap Visualizer</h1>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-500'}`}>Real-time motion capture from ESP32C3 Supermini</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${isDark ? 'border-slate-700 bg-slate-800 text-yellow-400 hover:bg-slate-700' : 'border-gray-300 bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse-dot' : (isDark ? 'bg-slate-600' : 'bg-gray-400')}`} />
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{connected ? 'Connected' : 'Disconnected'}</span>
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
          armScale={armScale}
          legScale={legScale}
          pathSpeed={pathSpeed}
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
          onArmScaleChange={setArmScale}
          onLegScaleChange={setLegScale}
          onPathSpeedChange={setPathSpeed}
        />

        <main className={`relative flex flex-1 flex-col p-4 ${isDark ? '' : 'bg-gray-50'}`}>
          <MocapViewer
            key={modelPath}
            modelPath={modelPath}
            sensorData={angles}
            previewMode={previewMode}
            isPlayingTogether={isPlayingTogether}
            recordedArm={recordedArm}
            recordedLeg={recordedLeg}
            playbackFrame={playbackFrame}
            armScale={armScale}
            legScale={legScale}
            pathSpeed={pathSpeed}
            onCameraChange={setCameraQuat}
          />

          {connected && serialOutput && (
            <div
              ref={serialEndRef}
              className={`pointer-events-none absolute left-4 top-4 z-10 max-h-[140px] max-w-[45%] overflow-y-auto rounded-lg border p-3 font-mono text-[11px] leading-relaxed backdrop-blur-sm ${isDark ? 'border-slate-700/40 bg-slate-950/70 text-emerald-400/80' : 'border-gray-300/40 bg-white/70 text-emerald-600/80'}`}
            >
              <pre className="whitespace-pre-wrap">{serialOutput}</pre>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
