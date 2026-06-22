function SectionLabel({ children, icon }) {
  return (
    <div className="flex items-center gap-2">
      {icon && <span className="text-slate-500">{icon}</span>}
      <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">{children}</span>
    </div>
  )
}

function TrackCard({ label, sensorData, accent }) {
  return (
    <div className={`rounded-lg border p-3 ${accent}`}>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="mt-2 flex gap-4">
        {[
          { key: 'ax', name: 'AX' },
          { key: 'ay', name: 'AY' },
          { key: 'az', name: 'AZ' },
        ].map(({ key, name }) => (
          <div key={key}>
            <span className="text-[10px] font-medium text-slate-500">{name}</span>
            <p className="font-mono text-base tabular-nums text-slate-100">{sensorData[key].toFixed(3)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SensorPanel({
  angles,
  connected,
  status,
  sampleCount,
  model,
  isRecording,
  recordedArm,
  recordedLeg,
  isPlaying,
  playbackFrame,
  recordingDuration,
  previewMode,
  serialSupported,
  onModelChange,
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
    <aside className="flex w-full flex-col gap-5 overflow-y-auto border-r border-slate-800/80 bg-slate-900/60 p-5 text-slate-200 backdrop-blur-sm lg:w-[340px]">
      {!serialSupported && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-400">
            Web Serial API not supported
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-amber-300/70">
            Use Chrome, Edge, or Opera on desktop for serial connection.
          </p>
        </div>
      )}

      <div className="space-y-3">
        <SectionLabel>Character</SectionLabel>
        <select
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          className="w-full rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20"
        >
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <div className="space-y-3">
        <SectionLabel>Input Source</SectionLabel>
        <button
          type="button"
          onClick={connected ? onDisconnectSerial : onConnectSerial}
          className={`w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
            connected
              ? 'bg-gradient-to-r from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30'
              : 'border border-slate-700/80 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <span className="flex items-center justify-center gap-2">
            {connected ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse-dot" />
                Disconnect Serial
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v6" /><path d="m12 14 4-4" /><path d="M12 14V8" />
                </svg>
                Web Serial
              </>
            )}
          </span>
        </button>
        {status && (
          <p className="text-[11px] text-slate-500">{status}</p>
        )}
      </div>

      {connected && (
        <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
          <SectionLabel icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>}>
            Recording
          </SectionLabel>

          <div className="space-y-3">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Duration</span>
                <span className="font-mono tabular-nums text-slate-300">{recordingDuration}s</span>
              </div>
              <input
                type="number"
                min="1"
                max="60"
                step="1"
                value={recordingDuration}
                onChange={(event) => onRecordingDurationChange(Number(event.target.value))}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] text-slate-400">Preview Mode</label>
              <select
                value={previewMode}
                onChange={(event) => onPreviewModeChange(event.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20"
              >
                <option value="arm">Arm Only</option>
                <option value="leg">Leg Only</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="min-w-[70px] text-[11px] text-slate-400">Arm:</span>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => onStartRecording('arm')}
                    className="flex-1 rounded-lg bg-gradient-to-r from-red-500 to-red-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-red-500/20 transition-all hover:shadow-lg hover:shadow-red-500/30"
                  >
                    Record
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStopRecording}
                    className="flex-1 rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-slate-500"
                  >
                    Stop
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="min-w-[70px] text-[11px] text-slate-400">Leg:</span>
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={() => onStartRecording('leg')}
                    className="flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/30"
                  >
                    Record
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onStopRecording}
                    className="flex-1 rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-slate-500"
                  >
                    Stop
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {(recordedArm || recordedLeg) && (
        <div className="space-y-3 rounded-xl border border-slate-700/60 bg-slate-800/30 p-4">
          <SectionLabel icon={<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3" /></svg>}>
            Playback
          </SectionLabel>
          <div className="text-[11px] text-slate-500">
            {recordedArm && <span>{recordedArm.length} arm frames</span>}
            {recordedArm && recordedLeg && <span> &middot; </span>}
            {recordedLeg && <span>{recordedLeg.length} leg frames</span>}
          </div>
          <div className="space-y-2">
            {!isPlaying ? (
              <>
                <button
                  type="button"
                  onClick={onPlayRecording}
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-emerald-500/20 transition-all hover:shadow-lg hover:shadow-emerald-500/30"
                >
                  Play Recording
                </button>
                {recordedArm && recordedLeg && (
                  <button
                    type="button"
                    onClick={onPlayTogether}
                    className="w-full rounded-lg bg-gradient-to-r from-purple-500 to-purple-600 px-3 py-2 text-sm font-medium text-white shadow-md shadow-purple-500/20 transition-all hover:shadow-lg hover:shadow-purple-500/30"
                  >
                    Play Together
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onStopPlayback}
                className="w-full rounded-lg bg-slate-600 px-3 py-2 text-sm font-medium text-white transition-all hover:bg-slate-500"
              >
                Stop Playback
              </button>
            )}
            {isPlaying && (
              <div className="text-center text-[11px] text-slate-400">
                Frame <span className="font-mono tabular-nums text-slate-300">{playbackFrame}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <SectionLabel>Live Tracks</SectionLabel>
        <TrackCard
          label="Primary (Left)"
          sensorData={angles}
          accent="border-cyan-500/20 bg-cyan-500/5"
        />
        <TrackCard
          label="Mirrored (Right)"
          sensorData={angles}
          accent="border-violet-500/20 bg-violet-500/5"
        />
      </div>

      <div className="mt-auto border-t border-slate-800/60 pt-4 text-[11px] text-slate-500">
        <div className="flex items-center justify-between">
          <span>Samples</span>
          <span className="font-mono tabular-nums text-slate-400">{sampleCount}</span>
        </div>
      </div>
    </aside>
  )
}
