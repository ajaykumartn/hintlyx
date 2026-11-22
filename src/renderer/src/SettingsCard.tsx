import { useEffect, useState } from 'react'
import {
  formatHotkey,
  HOTKEY_LABELS,
  HOTKEYS,
  PROVIDER_INFO,
  PROVIDERS,
  type AppState,
  type HotkeyAction,
  type Preferences,
  type Provider,
  type SettingsView
} from '@shared/ipc'
import type { TimingReport } from '@shared/timing'
import { Back } from './icons'

interface Props {
  appState: AppState
  onPrefs(patch: Partial<Preferences>): void
  onBack(): void
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange(v: boolean): void; label: string; hint: string }) {
  return (
    <div className="pref-row">
      <div className="key-label">
        <strong>{label}</strong>
        <span className="muted small">{hint}</span>
      </div>
      <button className={`switch small${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={() => onChange(!on)}>
        <span className="knob" />
      </button>
    </div>
  )
}

function invisibilityText({ prefs, invisibility }: AppState): string {
  if (!invisibility.supported) return 'not supported on this Windows version'
  if (invisibility.failed) return 'failed, Hintlyx is visible in screen shares'
  if (invisibility.active) return 'on, confirmed by Windows'
  return prefs.invisible ? 'turning on…' : 'off, visible in screen shares'
}

function invisibilityClass({ invisibility }: AppState): string {
  if (!invisibility.supported || invisibility.failed) return 'warn'
  return invisibility.active ? 'ok' : 'muted'
}

export function SettingsCard({ appState, onPrefs, onBack }: Props) {
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
          <h3>Invisibility</h3>
          <Toggle
            label="Invisible to screen share"
            hint="Hidden from screen sharing, recordings and screenshots. Needs Windows 10 (2004) or newer."
            on={appState.prefs.invisible}
            onChange={(v) => onPrefs({ invisible: v })}
          />
          <p className={`small ${invisibilityClass(appState)}`}>Status: {invisibilityText(appState)}</p>
          <Toggle
            label="Hide from taskbar"
            hint="Use Ctrl + \ to show Hintlyx again."
            on={appState.prefs.hideFromTaskbar}
            onChange={(v) => onPrefs({ hideFromTaskbar: v })}
          />
        </section>

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
          <h3>Offline fallback (Ollama)</h3>
          <Toggle
            label="Use local Ollama when cloud fails"
            hint="Runs answers on your own PC via Ollama. Needs Ollama installed and the model pulled."
            on={appState.prefs.ollama.enabled}
            onChange={(v) => onPrefs({ ollama: { ...appState.prefs.ollama, enabled: v } })}
          />
          {appState.prefs.ollama.enabled && (
            <div className="ollama-fields">
              <label>
                <span className="muted small">Server URL</span>
                <input
                  value={appState.prefs.ollama.baseUrl}
                  spellCheck={false}
                  onChange={(e) => onPrefs({ ollama: { ...appState.prefs.ollama, baseUrl: e.target.value } })}
                />
              </label>
              <label>
                <span className="muted small">Model</span>
                <input
                  value={appState.prefs.ollama.model}
                  spellCheck={false}
                  onChange={(e) => onPrefs({ ollama: { ...appState.prefs.ollama, model: e.target.value } })}
                />
              </label>
            </div>
          )}
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
