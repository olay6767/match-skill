import Button from '../../../shared/components/ui/Button'
import { DEFAULT_FORM_THEME, FORM_THEME_PRESETS, formThemeStyle, type FormTheme } from '../../../shared/formTheme'

type Props = {
  value: FormTheme
  disabled?: boolean
  onChange: (theme: FormTheme) => void
}

function FormThemeEditor({ value, disabled = false, onChange }: Props) {
  const update = <K extends keyof FormTheme>(key: K, nextValue: FormTheme[K]) => onChange({ ...value, [key]: nextValue })
  const choosePreset = (preset: (typeof FORM_THEME_PRESETS)[number]) => onChange({
    ...value,
    preset: preset.id,
    primaryColor: preset.primaryColor,
    backgroundColor: preset.backgroundColor,
  })
  const changeColor = (key: 'primaryColor' | 'backgroundColor' | 'progressColor' | 'progressTrackColor', color: string) => onChange({ ...value, preset: 'custom', [key]: color })

  return <details className="activity-theme-editor" open>
    <summary><span><small>ADVANCED FORM STYLE</small><strong>ปรับแต่งธีมแบบประเมินขั้นสูง</strong><em>สี ฟอนต์ ขนาดตัวอักษร พื้นหลัง และรูปทรงของฟอร์ม</em></span><b aria-hidden="true">⌄</b></summary>
    <div className="activity-theme-editor__body">
      <section className="activity-theme-presets" aria-labelledby="activity-theme-preset-title"><h3 id="activity-theme-preset-title">เลือกธีมสำเร็จรูป</h3><div>{FORM_THEME_PRESETS.map((preset) => <button type="button" className={value.preset === preset.id ? 'is-selected' : ''} disabled={disabled} key={preset.id} onClick={() => choosePreset(preset)}><i style={{ background: `linear-gradient(135deg, ${preset.primaryColor} 50%, ${preset.backgroundColor} 50%)` }} /><span>{preset.label}</span>{value.preset === preset.id && <b aria-hidden="true">✓</b>}</button>)}</div></section>
      <div className="activity-theme-editor__layout">
        <section className="activity-theme-controls" aria-label="ตัวเลือกปรับแต่งธีม">
          <div className="activity-theme-color-grid"><ThemeColor label="สีหลัก" value={value.primaryColor} disabled={disabled} onChange={(color) => changeColor('primaryColor', color)} /><ThemeColor label="สีพื้นหลัง" value={value.backgroundColor} disabled={disabled} onChange={(color) => changeColor('backgroundColor', color)} /><ThemeColor label="สีแถบความคืบหน้า" value={value.progressColor} disabled={disabled} onChange={(color) => changeColor('progressColor', color)} /><ThemeColor label="สีพื้นแถบความคืบหน้า" value={value.progressTrackColor} disabled={disabled} onChange={(color) => changeColor('progressTrackColor', color)} /></div>
          <div className="activity-theme-select-grid">
            <ThemeSelect label="ฟอนต์" value={value.fontFamily} disabled={disabled} options={[['modern', 'Kanit — ค่าเริ่มต้น'], ['friendly', 'Friendly — เป็นกันเอง'], ['formal', 'Formal — ทางการ'], ['system', 'System — ตามอุปกรณ์']]} onChange={(next) => update('fontFamily', next as FormTheme['fontFamily'])} />
            <label className="activity-theme-number"><span>ขนาดตัวอักษร</span><div><input type="number" min="12" max="24" step="1" value={value.fontSize} disabled={disabled} onChange={(event) => update('fontSize', Math.min(24, Math.max(12, event.target.valueAsNumber || 16)))} /><em>px</em></div><small>กำหนดได้ตั้งแต่ 12–24 px</small></label>
            <ThemeSelect label="ความโค้งของการ์ด" value={value.cornerStyle} disabled={disabled} options={[['subtle', 'เหลี่ยมเล็กน้อย'], ['rounded', 'โค้งมาตรฐาน'], ['soft', 'โค้งนุ่มนวล']]} onChange={(next) => update('cornerStyle', next as FormTheme['cornerStyle'])} />
            <ThemeSelect label="ความกว้างฟอร์ม" value={value.contentWidth} disabled={disabled} options={[['compact', 'กะทัดรัด'], ['standard', 'มาตรฐาน'], ['wide', 'กว้าง']]} onChange={(next) => update('contentWidth', next as FormTheme['contentWidth'])} />
            <ThemeSelect label="รูปแบบพื้นหลัง" value={value.backgroundMode} disabled={disabled} options={[['soft', 'นุ่มนวล'], ['gradient', 'ไล่ระดับสี'], ['solid', 'สีพื้นเรียบ']]} onChange={(next) => update('backgroundMode', next as FormTheme['backgroundMode'])} />
          </div>
          <Button disabled={disabled} className="activity-theme-reset" onClick={() => onChange({ ...DEFAULT_FORM_THEME })}>คืนค่าธีม SEDA เริ่มต้น</Button>
        </section>
        <section className={`activity-theme-preview activity-theme-preview--${value.backgroundMode}`} style={formThemeStyle(value)} aria-label="ตัวอย่างธีมแบบประเมิน"><span>ตัวอย่างแบบฟอร์ม</span><article><small>PRE-TEST · ตัวอย่างกิจกรรม</small><div className="activity-theme-preview-progress"><span><b>ความคืบหน้า</b><strong>ข้อ 3 จาก 9</strong></span><i><b /></i></div><h3>หัวข้อแบบประเมิน</h3><p>ข้อความและตัวเลือกจะแสดงด้วยรูปแบบที่กำหนด</p><label><i />1&nbsp;&nbsp;ตัวอย่างคำตอบ</label><button type="button" tabIndex={-1}>ดำเนินการต่อ</button></article></section>
      </div>
    </div>
  </details>
}

function ThemeSelect({ label, value, options, disabled, onChange }: { label: string; value: string; options: Array<[string, string]>; disabled: boolean; onChange: (value: string) => void }) {
  return <label><span>{label}</span><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}</select></label>
}

function ThemeColor({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  return <label><span>{label}</span><div><input type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /><code>{value}</code></div></label>
}

export default FormThemeEditor
