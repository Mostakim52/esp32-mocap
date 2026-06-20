import { useMemo, useState } from 'react'
import MocapViewer from './components/MocapViewer'
import SensorPanel from './components/SensorPanel'
import { useSensorData } from './hooks/useSensorData'

export default function App() {
  const [model, setModel] = useState('male')
  const [pathSpeed, setPathSpeed] = useState(1.0)

  const {
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
  } = useSensorData()

  const modelPath = useMemo(
    () => `/models/${model}.glb`,
    [model],
  )

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-4 p-4 lg:grid-cols-[320px_1fr]">
        <SensorPanel
          mode={mode}
          autoSimulate={autoSimulate}
          angles={angles}
          connected={connected}
          status={status}
          sampleCount={sampleCount}
          model={model}
          pathSpeed={pathSpeed}
          serialOutput={serialOutput}
          isRecording={isRecording}
          recordedArm={recordedArm}
          recordedLeg={recordedLeg}
          isPlaying={isPlaying}
          isPlayingTogether={isPlayingTogether}
          playbackFrame={playbackFrame}
          recordingDuration={recordingDuration}
          previewMode={previewMode}
          serialSupported={serialSupported}
          onModelChange={setModel}
          onSelectSimulate={selectSimulateMode}
          onIdleMotion={enableAutoSimulation}
          onManualChange={setSimulatedAngles}
          onPathSpeedChange={setPathSpeed}
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

        <main className="flex min-h-[480px] flex-col gap-3">
          <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3">
            <p className="text-sm text-slate-300">
              Mixamo rig: Hips → Spine → Neck / Arms · Hips → UpLegs. Single left-side pitch
              &amp; roll drives mirrored arm and leg motion without compounding drift.
            </p>
          </div>
          <MocapViewer
            key={modelPath}
            modelPath={modelPath}
            sensorData={angles}
            autoSimulate={autoSimulate}
            pathSpeed={pathSpeed}
            previewMode={previewMode}
            isPlayingTogether={isPlayingTogether}
            recordedArm={recordedArm}
            recordedLeg={recordedLeg}
            playbackFrame={playbackFrame}
          />
        </main>
      </div>
    </div>
  )
}
