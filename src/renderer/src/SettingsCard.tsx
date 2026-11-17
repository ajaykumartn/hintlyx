import { useEffect, useState } from 'react'
import {
  formatHotkey,
  HOTKEY_LABELS,
  HOTKEYS,
  PROVIDER_INFO,
  PROVIDERS,
  type AppState,
  type HotkeyAction,
  type Provider,
  type SettingsView
} from '@shared/ipc'
import type { TimingReport } from '@shared/timing'
import { Back } from './icons'

interface Props {
  appState: AppState
  onBack(): void
}

export function SettingsCard({ appState, onBack }: Props) {
  const [settings, setSettings] = useState<SettingsView | null>(null)
  const [drafts, setDrafts] = useState<Record<Provider, string>>({ groq: '', gemini: '' })
  const [error, setError] = useState<string | null>(null)
  const [timings, setTimings] = useState<TimingReport[]>([])

  useEffect(() => {
    void window.hintlyx.getSettings().then(setSettings)
    void window.hintlyx.getTimings().then(setTimings)
  }, [])

  const run = async (fn: () => Promise<SettingsView>) => {
    setError(null)
    try {
      setSettings(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(e))
    }
  }

  const save = (p: Provider) =>
    run(async () => {
      const view = await window.hintlyx.setApiKey(p, drafts[p])
      setDrafts((d) => ({ ...d, [p]: '' }))
      return view
    })

  return (
    <div className="card glass settings" data-hit>
      <div className="card-head">
        <button className="text-btn back" onClick={onBack}>
          <Back size={16} /> Back
        </button>
        <span className="title">Settings</span>
        <button className="text-btn danger" onClick={() => window.hintlyx.quit()}>
          Quit Hintlyx
        </button>
      </div>

      <div className="card-body">
        <section>
          <h3>API keys</h3>
          <p className="muted">
            Keys are encrypted on this PC with Windows data protection and never shown again in full.
          </p>
          {settings && !settings.encryptionAvailable && (
            <p className="warn">Secure storage is unavailable, so keys cannot be saved.</p>
          )}
          {PROVIDERS.map((p) => {
            const status = settings?.keys[p]
            return (
              <div key={p} className="key-row">
                <div className="key-label">
                  <strong>{PROVIDER_INFO[p].name}</strong>
                  <span className="muted">{PROVIDER_INFO[p].hint}</span>
                  <span className="muted small">Get a free key: {PROVIDER_INFO[p].keyUrl}</span>
                </div>
                {status?.set ? (
                  <div className="key-set">
                    <code>{status.masked}</code>
                    <button className="text-btn danger" onClick={() => void run(() => window.hintlyx.clearApiKey(p))}>
                      Remove
                    </button>
                  </div>
                ) : (
                  <form
                    className="key-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void save(p)
                    }}
                  >
                    <input
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={`Paste ${PROVIDER_INFO[p].name} key`}
                      value={drafts[p]}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p]: e.target.value }))}
                    />
                    <button className="primary-btn" type="submit" disabled={!drafts[p].trim()}>
                      Save
                    </button>
                  </form>
                )}
              </div>
            )
          })}
          {error && <p className="warn">{error}</p>}
        </section>

        <section>
          <h3>Keyboard shortcuts</h3>
          <ul className="hotkeys">
            {(Object.keys(HOTKEYS) as HotkeyAction[]).map((a) => (
              <li key={a}>
                <span>{HOTKEY_LABELS[a]}</span>
                <span>
                  <kbd>{formatHotkey(HOTKEYS[a])}</kbd>
                  {appState.failedHotkeys.includes(a) && <span className="warn small"> in use by another app</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3>Speed log</h3>
          {timings.length === 0 ? (
            <p className="muted">No timings yet.</p>
          ) : (
            <ul className="timings">
              {[...timings].reverse().slice(0, 8).map((t) => (
                <li key={t.at + t.label}>
                  <span>{t.label}</span>
                  <span className={t.totalMs > 3000 ? 'warn' : 'muted'}>{t.totalMs} ms</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
