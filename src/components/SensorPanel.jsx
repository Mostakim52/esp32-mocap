function TrackCard({ label, sensorData, accent }) {
  return (
    <div className={`rounded-lg border p-3 ${accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 text-sm space-y-1">
        <div>
          <span className="text-slate-500">AX</span>
          <p className="font-mono text-lg text-slate-100">{sensorData.ax.toFixed(3)}</p>
        </div>
        <div>
          <span className="text-slate-500">AY</span>
          <p className="font-mono text-lg text-slate-100">{sensorData.ay.toFixed(3)}</p>
        </div>
        <div>
          <span className="text-slate-500">AZ</span>
          <p className="font-mono text-lg text-slate-100">{sensorData.az.toFixed(3)}</p>
        </div>
      </div>
    </div>
  )
}

export default function SensorPanel({
  mode,
  autoSimulate,
  angles,
  connected,
  status,
  sampleCount,
  model,
  pathSpeed,
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
  onModelChange,
  onSelectSimulate,
  onIdleMotion,
  onManualChange,
  onPathSpeedChange,
  onConnectSerial,
  onDisconnectSerial,
  onStartRecording,
  onStopRecording,
  onPlayRecording,
  onPlayTogether,
  onStopPlayback,
  onRecordingDurationChange,
  onPreviewModeChange,
}) {
  return (
    <aside className="flex h-full flex-col gap-4 rounded-xl border border-slate-700/80 bg-slate-900/90 p-4 text-slate-200 shadow-xl backdrop-blur">
      <div>
        <h1 className="text-xl font-semibold text-white">Arduino Nano Mocap</h1>
        <p className="mt-1 text-sm text-slate-400">
          Raw accelerometer and gyroscope data from Arduino Nano with Kalman filtering.
        </p>
      </div>

      {!serialSupported && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm font-semibold text-red-400">
            ⚠️ Web Serial API not supported
          </p>
          <p className="mt-1 text-xs text-red-300">
            Web Serial API is only supported in Chrome, Edge, and Opera on desktop. 
            Use simulation mode instead.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Character
        </label>
        <select
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Input Source
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onSelectSimulate}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === 'simulate' && !autoSimulate
                ? 'bg-cyan-500 text-slate-950'
                : 'border border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-500'
            }`}
          >
            Manual
          </button>
          <button
            type="button"
            onClick={onIdleMotion}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              mode === 'simulate' && autoSimulate
                ? 'bg-cyan-500 text-slate-950'
                : 'border border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-500'
            }`}
          >
            Idle Motion
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={connected ? onDisconnectSerial : onConnectSerial}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              connected
                ? 'bg-rose-500 text-white'
                : 'border border-slate-600 bg-slate-950 text-slate-300 hover:border-slate-500'
            }`}
          >
            {connected ? 'Disconnect Serial' : 'Web Serial'}
          </button>
        </div>
        <p className="text-xs text-slate-500">{status}</p>
      </div>

      {connected && (
        <div className="space-y-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Serial Output
          </label>
          <div className="h-24 overflow-y-auto rounded-lg border border-slate-600 bg-slate-950 p-2 font-mono text-xs text-green-400">
            <pre className="whitespace-pre-wrap">{serialOutput || 'Waiting for data...'}</pre>
          </div>
        </div>
      )}

      {connected && (
        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Recording
          </label>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>Duration (seconds)</span>
                <span className="font-mono">{recordingDuration}s</span>
              </div>
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                value={recordingDuration}
                onChange={(event) => onRecordingDurationChange(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Preview Mode</label>
              <select
                value={previewMode}
                onChange={(event) => onPreviewModeChange(event.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
              >
                <option value="arm">Arm Only</option>
                <option value="leg">Leg Only</option>
              </select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Palm (Arm):</span>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => onStartRecording('arm')}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition"
                  >
                    Record Arm
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStopRecording}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-medium bg-slate-600 text-white hover:bg-slate-500 transition"
                  >
                    Stop Recording
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Foot (Leg):</span>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => onStartRecording('leg')}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition"
                  >
                    Record Leg
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStopRecording}
                    className="flex-1 rounded-lg px-3 py-2 text-sm font-medium bg-slate-600 text-white hover:bg-slate-500 transition"
                  >
                    Stop Recording
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {(recordedArm || recordedLeg) && (
        <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Playback
          </label>
          <div className="text-xs text-slate-400 mb-2">
            {recordedArm && <span>Arm: {recordedArm.length} frames</span>}
            {recordedArm && recordedLeg && <span> | </span>}
            {recordedLeg && <span>Leg: {recordedLeg.length} frames</span>}
          </div>
          <div className="grid grid-cols-1 gap-2">
            {!isPlaying ? (
              <>
                <button
                  type="button"
                  onClick={onPlayRecording}
                  className="rounded-lg px-3 py-2 text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition"
                >
                  Play Recording
                </button>
                {recordedArm && recordedLeg && (
                  <button
                    type="button"
                    onClick={onPlayTogether}
                    className="rounded-lg px-3 py-2 text-sm font-medium bg-purple-500 text-white hover:bg-purple-600 transition"
                  >
                    Play Together
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onStopPlayback}
                className="rounded-lg px-3 py-2 text-sm font-medium bg-slate-600 text-white hover:bg-slate-500 transition"
              >
                Stop Playback
              </button>
            )}
            {isPlaying && (
              <div className="text-xs text-slate-400 text-center">
                Frame: {playbackFrame}
              </div>
            )}
          </div>
        </div>
      )}

      {mode === 'simulate' && (
        <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-950/70 p-3">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Manual AX</span>
              <span className="font-mono">{angles.ax.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={angles.ax}
              onChange={(event) =>
                onManualChange(Number(event.target.value))
              }
              className="w-full accent-cyan-400"
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
              <span>Path Speed</span>
              <span className="font-mono">{pathSpeed.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={pathSpeed}
              onChange={(event) =>
                onPathSpeedChange(Number(event.target.value))
              }
              className="w-full accent-cyan-400"
            />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Live Tracks
        </h2>
        <TrackCard
          label="Primary (Left)"
          sensorData={angles}
          accent="border-cyan-500/30 bg-cyan-500/5"
        />
        <TrackCard
          label="Mirrored (Right)"
          sensorData={angles}
          accent="border-violet-500/30 bg-violet-500/5"
        />
      </div>

      <div className="mt-auto rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-xs text-slate-400">
        <p>
          Samples: <span className="font-mono text-slate-200">{sampleCount}</span>
        </p>
        <p className="mt-2 leading-relaxed">
          Roll-only drive: arms ±14° · legs ±23°. Natural gait mirroring.
          Bind pose reset every frame.
        </p>
      </div>
    </aside>
  )
}
