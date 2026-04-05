import { X, Moon, Sun, Monitor } from 'lucide-react'
import { useSettingsStore } from '../../stores/settingsStore'
import { Button } from '../ui/Button'
import { wobblyMd, wobbly } from '../../lib/utils'
import type { ThemeMode, UIDensity, VocabViewMode, ExportFormat, HighlightBehavior } from '../../types'
import { LANGUAGES } from '../../types'

export function SettingsPanel() {
  const settings = useSettingsStore((s) => s.settings)
  const settingsOpen = useSettingsStore((s) => s.settingsOpen)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const toggleSettings = useSettingsStore((s) => s.toggleSettings)

  if (!settingsOpen) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-pencil/20 dark:bg-black/40"
        onClick={toggleSettings}
      />

      {/* Panel */}
      <div
        className="relative bg-paper dark:bg-paper-dark border-[3px] border-pencil dark:border-pencil-dark w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-hard-lg dark:shadow-hard-lg-dark animate-pop-in z-50"
        style={{ borderRadius: wobblyMd }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-dashed border-pencil/20 dark:border-pencil-dark/20">
          <h2
            className="font-heading text-3xl text-pencil dark:text-pencil-dark"
            style={{ transform: 'rotate(-1deg)' }}
          >
            ⚙️ Settings
          </h2>
          <button
            onClick={toggleSettings}
            className="text-pencil/60 dark:text-pencil-dark/60 hover:text-marker transition-colors"
          >
            <X size={24} strokeWidth={2.5} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* ── Appearance ── */}
          <Section title="Appearance">
            <SettingRow label="Theme">
              <div className="flex gap-2">
                {(['light', 'dark', 'neutral'] as ThemeMode[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => updateSettings({ theme: t })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-body text-sm border-2 border-pencil dark:border-pencil-dark transition-colors ${
                      settings.theme === t
                        ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
                        : 'bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark'
                    }`}
                    style={{ borderRadius: wobbly }}
                  >
                    {t === 'light' && <Sun size={14} />}
                    {t === 'dark' && <Moon size={14} />}
                    {t === 'neutral' && <Monitor size={14} />}
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </SettingRow>

            <SettingRow label="Accent color">
              <input
                type="color"
                value={settings.accentColor}
                onChange={(e) => updateSettings({ accentColor: e.target.value })}
                className="w-10 h-8 border-2 border-pencil cursor-pointer"
              />
            </SettingRow>

            <SettingRow label="Highlight color">
              <input
                type="color"
                value={settings.highlightColor}
                onChange={(e) => updateSettings({ highlightColor: e.target.value })}
                className="w-10 h-8 border-2 border-pencil cursor-pointer"
              />
            </SettingRow>

            <SettingRow label="Font size">
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={14}
                  max={24}
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-32"
                />
                <span className="font-body text-sm w-8">{settings.fontSize}px</span>
              </div>
            </SettingRow>

            <SettingRow label="Density">
              <ToggleGroup<UIDensity>
                options={['compact', 'comfortable']}
                value={settings.density}
                onChange={(v) => updateSettings({ density: v })}
              />
            </SettingRow>
          </Section>

          {/* ── Editor ── */}
          <Section title="Editor">
            <SettingRow label="Auto-save">
              <Toggle
                checked={settings.autoSave}
                onChange={(v) => updateSettings({ autoSave: v })}
              />
            </SettingRow>

            <SettingRow label="Default view mode">
              <ToggleGroup<VocabViewMode>
                options={['table', 'cards']}
                value={settings.defaultViewMode}
                onChange={(v) => updateSettings({ defaultViewMode: v })}
              />
            </SettingRow>

            <SettingRow label="Language detection">
              <Toggle
                checked={settings.languageDetection}
                onChange={(v) => updateSettings({ languageDetection: v })}
              />
            </SettingRow>
          </Section>

          {/* ── Vocabulary ── */}
          <Section title="Vocabulary">
            <SettingRow label="Auto-add on highlight">
              <Toggle
                checked={settings.autoAddOnHighlight}
                onChange={(v) => updateSettings({ autoAddOnHighlight: v })}
              />
            </SettingRow>

            <SettingRow label="Require confirmation">
              <Toggle
                checked={settings.requireConfirmation}
                onChange={(v) => updateSettings({ requireConfirmation: v })}
              />
            </SettingRow>

            <SettingRow label="Daily goal (words)">
              <input
                type="number"
                min={0}
                max={100}
                value={settings.dailyGoal}
                onChange={(e) => updateSettings({ dailyGoal: Math.max(0, parseInt(e.target.value) || 0) })}
                className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1 w-20 outline-none"
                style={{ borderRadius: wobbly }}
              />
            </SettingRow>
          </Section>

          {/* ── Translation ── */}
          <Section title="Translation">
            <SettingRow label="Translate from">
              <select
                value={settings.translateFrom}
                onChange={(e) => updateSettings({ translateFrom: e.target.value })}
                className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1 outline-none"
                style={{ borderRadius: wobbly }}
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Translate to">
              <select
                value={settings.translateTo}
                onChange={(e) => updateSettings({ translateTo: e.target.value })}
                className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1 outline-none"
                style={{ borderRadius: wobbly }}
              >
                {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingRow label="Auto-accept translations">
              <Toggle
                checked={settings.autoAcceptTranslation}
                onChange={(v) => updateSettings({ autoAcceptTranslation: v })}
              />
            </SettingRow>
          </Section>

          {/* ── Export ── */}
          <Section title="Export">
            <SettingRow label="Default format">
              <ToggleGroup<ExportFormat>
                options={['csv', 'table', 'text']}
                value={settings.defaultExportFormat}
                onChange={(v) => updateSettings({ defaultExportFormat: v })}
              />
            </SettingRow>

            <SettingRow label="CSV delimiter">
              <select
                value={settings.csvDelimiter}
                onChange={(e) => updateSettings({ csvDelimiter: e.target.value })}
                className="font-body text-sm bg-white dark:bg-paper-dark border-2 border-pencil dark:border-pencil-dark px-3 py-1 outline-none"
                style={{ borderRadius: wobbly }}
              >
                <option value=",">Comma (,)</option>
                <option value=";">Semicolon (;)</option>
                <option value="	">Tab</option>
              </select>
            </SettingRow>
          </Section>

          {/* ── Data ── */}
          <Section title="Data">
            <SettingRow label="Clear all data">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
                    localStorage.clear()
                    window.location.reload()
                  }
                }}
              >
                Clear Cache
              </Button>
            </SettingRow>
          </Section>
        </div>
      </div>
    </div>
  )
}

// ── Helper components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="font-heading text-xl text-pencil dark:text-pencil-dark mb-3 border-b-2 border-dashed border-pencil/15 dark:border-pencil-dark/15 pb-1"
        style={{ transform: 'rotate(-0.5deg)' }}
      >
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-body text-base text-pencil dark:text-pencil-dark">{label}</span>
      {children}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 border-2 border-pencil dark:border-pencil-dark relative transition-colors ${
        checked ? 'bg-pen' : 'bg-erased dark:bg-erased-dark'
      }`}
      style={{ borderRadius: '999px' }}
    >
      <div
        className={`absolute top-0.5 w-5 h-5 bg-white border-2 border-pencil dark:border-pencil-dark rounded-full transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div
      className="flex border-2 border-pencil dark:border-pencil-dark overflow-hidden"
      style={{ borderRadius: wobbly }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1 font-body text-sm capitalize transition-colors ${
            value === opt
              ? 'bg-pencil text-white dark:bg-pencil-dark dark:text-paper-dark'
              : 'bg-white dark:bg-paper-dark hover:bg-erased dark:hover:bg-erased-dark'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}
