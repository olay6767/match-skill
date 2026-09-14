import { useEffect, useRef, useState } from 'react'
import { getFinalAnalysis, type FinalAnalysisFaculty, type FinalAnalysisFilters, type FinalAnalysisResult } from '../../../lib/api'
import './finalAnalysis.css'
import './finalAnalysisEnhancements.css'
import growthIllustration from '../../../assets/พัฒนาการ.png'

type Props = { activityId: number }

const initialFilters = (activityId: number): FinalAnalysisFilters => ({
  activityId,
  faculties: [],
  majors: [],
  educationLevels: [],
  studyYears: [],
  phases: ['pre', 'post'],
})

function number(value: number | null, decimals = 2) {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(decimals)
}

function signed(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`
}

function percentage(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(0)}%`
}

function signedPercentage(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function SummaryCard({ label, value, note, tone = 'neutral' }: {
  label: string
  value: string | number
  note?: string
  tone?: 'neutral' | 'pre' | 'post' | 'positive'
}) {
  return <article className={`final-analysis-stat final-analysis-stat--${tone}`}>
    <span>{label}</span>
    <strong>{value}</strong>
    {note ? <small>{note}</small> : null}
  </article>
}

type MultiSelectOption = { value: string; label: string }

function MultiSelectFilter({ label, values, options, allLabel, onChange, emptyMeansAll = true, combinedLabel }: {
  label: string
  values: string[]
  options: MultiSelectOption[]
  allLabel: string
  onChange: (values: string[]) => void
  emptyMeansAll?: boolean
  combinedLabel?: string
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const selectedLabel = emptyMeansAll && values.length === 0
    ? allLabel
    : combinedLabel && values.length === options.length
      ? combinedLabel
      : values.length === 1
        ? options.find((option) => option.value === values[0])?.label ?? values[0]
        : `เลือกแล้ว ${values.length} รายการ`

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current) detailsRef.current.open = false
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const toggle = (value: string, checked: boolean) => {
    const next = checked ? [...values, value] : values.filter((item) => item !== value)
    if (!emptyMeansAll && next.length === 0) return
    onChange(emptyMeansAll && next.length === options.length ? [] : next)
  }
  const selectedCount = emptyMeansAll && values.length === 0 ? options.length : values.length

  return <div className="final-analysis-multiselect">
    <span>{label}</span>
    <details ref={detailsRef}>
      <summary><strong title={selectedLabel}>{selectedLabel}</strong><i aria-hidden="true" /></summary>
      <div className="final-analysis-multiselect__menu" role="group" aria-label={label}>
        <div className="final-analysis-multiselect__menu-header"><span><strong>{label}</strong><small>เลือกได้มากกว่าหนึ่งรายการ</small></span><b>{selectedCount} / {options.length}</b></div>
        {emptyMeansAll ? <label className={`is-all${values.length === 0 ? ' is-selected' : ''}`}><input type="checkbox" checked={values.length === 0} onChange={() => onChange([])} /><span className="final-analysis-multiselect__option-copy"><strong>{allLabel}</strong><small>รวมทุกตัวเลือก</small></span></label> : null}
        {options.map((option) => {
          const checked = values.includes(option.value)
          return <label className={checked ? 'is-selected' : ''} key={option.value}><input type="checkbox" checked={checked} disabled={!emptyMeansAll && checked && values.length === 1} onChange={(event) => toggle(option.value, event.target.checked)} /><span title={option.label}>{option.label}</span></label>
        })}
        {!options.length ? <p>ยังไม่มีตัวเลือก</p> : null}
      </div>
    </details>
  </div>
}

function FacultyMeanChart({ rows, maximum, onSelect }: {
  rows: FinalAnalysisFaculty[]
  maximum: number
  onSelect: (faculty: string) => void
}) {
  const safeMaximum = Math.max(maximum, 1)
  const sortedRows = [...(rows ?? [])].sort((left, right) => (right.post.mean ?? right.pre.mean ?? -1) - (left.post.mean ?? left.pre.mean ?? -1))

  return <section className="final-analysis-panel final-analysis-faculty-panel">
    <div className="final-analysis-section-heading">
      <div><span>เปรียบเทียบคณะ</span><h3>คะแนนเฉลี่ยรายคณะ</h3></div>
      <div className="final-analysis-legend"><span><i className="is-pre" />Pre-test</span><span><i className="is-post" />Post-test</span></div>
    </div>
    {sortedRows.length ? <div className="final-analysis-faculty-chart">
      {sortedRows.map((row) => <button type="button" className="final-analysis-faculty-chart__row" key={row.faculty} onClick={() => onSelect(row.faculty)}>
        <span className="final-analysis-faculty-chart__name"><strong>{row.faculty}</strong></span>
        <span className="final-analysis-faculty-chart__bars">
          <span className="final-analysis-faculty-chart__bar"><em>Pre</em><i><b className="is-pre" style={{ width: `${Math.min(100, ((row.pre.mean ?? 0) / safeMaximum) * 100)}%` }} /></i><strong>{number(row.pre.mean)}</strong></span>
          <span className="final-analysis-faculty-chart__bar"><em>Post</em><i><b className="is-post" style={{ width: `${Math.min(100, ((row.post.mean ?? 0) / safeMaximum) * 100)}%` }} /></i><strong>{number(row.post.mean)}</strong></span>
        </span>
      </button>)}
    </div> : <div className="final-analysis-inline-empty">ยังไม่มีข้อมูลรายคณะ</div>}
  </section>
}

function FacultyStatisticsTable({ rows, phases }: {
  rows: FinalAnalysisFaculty[]
  phases: FinalAnalysisFilters["phases"]
}) {
  const showPre = phases.includes("pre")
  const showPost = phases.includes("post")
  const sortedRows = [...(rows ?? [])].sort((left, right) => left.faculty.localeCompare(right.faculty, "th"))

  return <section className="final-analysis-panel final-analysis-faculty-table-panel">
    <div className="final-analysis-section-heading"><div><span>STATISTICS</span><h3>สถิติรายคณะ</h3></div></div>
    {sortedRows.length ? <div className="final-analysis-faculty-table-wrap">
      <table className="final-analysis-faculty-table">
        <thead>
          <tr>
            <th rowSpan={2}>คณะ</th>
            {showPre ? <th className="is-pre" colSpan={4}>Pre-test</th> : null}
            {showPost ? <th className="is-post" colSpan={4}>Post-test</th> : null}
          </tr>
          <tr>
            {showPre ? <><th>Mean</th><th>Max</th><th>Min</th><th>SD</th></> : null}
            {showPost ? <><th>Mean</th><th>Max</th><th>Min</th><th>SD</th></> : null}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => <tr key={row.faculty}>
            <th scope="row">{row.faculty}</th>
            {showPre ? <><td>{number(row.pre.mean)}</td><td>{number(row.pre.maximum)}</td><td>{number(row.pre.minimum)}</td><td>{number(row.pre.sd)}</td></> : null}
            {showPost ? <><td>{number(row.post.mean)}</td><td>{number(row.post.maximum)}</td><td>{number(row.post.minimum)}</td><td>{number(row.post.sd)}</td></> : null}
          </tr>)}
        </tbody>
      </table>
    </div> : <div className="final-analysis-inline-empty">ยังไม่มีข้อมูลสำหรับตารางนี้</div>}
  </section>
}

function AnalysisHighlights({ data }: { data: FinalAnalysisResult }) {
  const phase = data.filters.selected.phases.includes("post") ? "post" : "pre"
  const topFaculty = [...(data.faculties ?? [])]
    .filter((row) => row[phase].mean !== null)
    .sort((left, right) => (right[phase].mean ?? -1) - (left[phase].mean ?? -1))[0]
  const difference = data.summary.meanDifference
  const pairedPre = data.summary.pairedPreMean
  const pairedPost = data.summary.pairedPostMean

  return <section className="final-analysis-panel final-analysis-highlights">
    <div className="final-analysis-highlights__visual">
      <img src={growthIllustration} alt="" aria-hidden="true" />
      <span>สรุปผล</span>
      <strong>ประเด็นสำคัญ<br />ในภาพเดียว</strong>
    </div>
    <div className="final-analysis-highlights__cards">
      <article><i aria-hidden="true">↗</i><div><span>คะแนนเฉลี่ย</span><strong>{number(pairedPre)} → {number(pairedPost)}</strong><small>เปลี่ยนแปลง {signed(difference)} ({signedPercentage(data.summary.improvementPercentage)})</small></div></article>
      <article><i aria-hidden="true">✓</i><div><span>แนวโน้ม</span><strong>{percentage(data.paired.improved.percentage)} ดีขึ้น</strong><small>ดีขึ้น {data.paired.improved.count} · คงที่ {data.paired.unchanged.count} · ลดลง {data.paired.decreased.count}</small></div></article>
      <article><i aria-hidden="true">★</i><div><span>คณะคะแนนสูงสุด</span><strong>{topFaculty?.faculty ?? "—"}</strong><small>{phase === "post" ? "Post-test" : "Pre-test"} {number(topFaculty?.[phase].mean ?? null)}</small></div></article>
    </div>
  </section>
}


function FinalAnalysisDashboard({ activityId }: Props) {
  const [filters, setFilters] = useState<FinalAnalysisFilters>(() => initialFilters(activityId))
  const [data, setData] = useState<FinalAnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    void getFinalAnalysis(filters)
      .then((result) => { if (!cancelled) setData(result) })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดผลวิเคราะห์ได้') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [filters])

  const applyFilters = (next: FinalAnalysisFilters) => {
    setIsLoading(true)
    setError('')
    setFilters(next)
  }
  const updateFilter = <Key extends keyof FinalAnalysisFilters>(key: Key, value: FinalAnalysisFilters[Key]) => applyFilters({ ...filters, [key]: value })

  return <div className="final-analysis-dashboard">
    <section className="final-analysis-intro">
      <div><h2>ภาพรวมคะแนน</h2></div>
      {data ? <span className="final-analysis-scale-badge">คะแนนเต็ม {data.scale.maximum.toFixed(0)}</span> : null}
    </section>

    <section className="final-analysis-filters" aria-label="ตัวกรองผลวิเคราะห์">
      <MultiSelectFilter label="คณะ" values={filters.faculties} options={(data?.filters.options.faculties ?? []).map((faculty) => ({ value: faculty, label: faculty }))} allLabel="ทุกคณะ" onChange={(values) => updateFilter('faculties', values)} />
      <MultiSelectFilter label="ระดับการศึกษา" values={filters.educationLevels} options={(data?.filters.options.educationLevels ?? []).map((level) => ({ value: level, label: level }))} allLabel="ทุกระดับ" onChange={(values) => updateFilter('educationLevels', values)} />
      <MultiSelectFilter label="ชั้นปี / กลุ่มรุ่น" values={filters.studyYears} options={(data?.filters.options.studyYears ?? []).map((year) => ({ value: String(year), label: `ชั้นปี ${year}` }))} allLabel="ทุกชั้นปี" onChange={(values) => updateFilter('studyYears', values)} />
      <MultiSelectFilter label="ช่วงการประเมิน" values={filters.phases} options={[{ value: 'pre', label: 'Pre-test' }, { value: 'post', label: 'Post-test' }]} allLabel="ทุกช่วง" combinedLabel="Pre + Post" emptyMeansAll={false} onChange={(values) => updateFilter('phases', values as FinalAnalysisFilters['phases'])} />
      <div className="final-analysis-filter-actions"><button type="button" onClick={() => applyFilters(initialFilters(activityId))}>รีเซ็ต</button></div>
    </section>

    {isLoading ? <div className="final-analysis-state" role="status"><span />กำลังคำนวณผลจากข้อมูลจริง...</div>
      : error ? <div className="final-analysis-state final-analysis-state--error"><strong>โหลดผลวิเคราะห์ไม่สำเร็จ</strong><p>{error}</p><button type="button" onClick={() => applyFilters({ ...filters })}>ลองอีกครั้ง</button></div>
        : !data || data.summary.respondentCount === 0 ? <div className="final-analysis-state"><strong>ยังไม่มีข้อมูลตามตัวกรองนี้</strong><p>ลองเปลี่ยนคณะ ชั้นปี หรือช่วงการประเมิน</p></div>
          : <>
            <section className="final-analysis-stats" aria-label="คะแนนสำคัญ">
              <SummaryCard label="Pre-test" value={number(data.summary.preMean)} tone="pre" />
              <SummaryCard label="Post-test" value={number(data.summary.postMean)} tone="post" />
              <SummaryCard label="เปลี่ยนแปลง" value={signed(data.summary.meanDifference)} note={signedPercentage(data.summary.improvementPercentage)} tone={data.summary.meanDifference !== null && data.summary.meanDifference > 0 ? "positive" : "neutral"} />
            </section>

            <AnalysisHighlights data={data} />
            <FacultyMeanChart rows={data.faculties ?? []} maximum={data.scale.maximum} onSelect={(faculty) => updateFilter("faculties", [faculty])} />
            <FacultyStatisticsTable rows={data.faculties ?? []} phases={filters.phases} />
          </>}
  </div>
}

export default FinalAnalysisDashboard
