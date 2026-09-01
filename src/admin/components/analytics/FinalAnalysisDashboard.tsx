import { useEffect, useMemo, useRef, useState } from 'react'
import { getFinalAnalysis, type FinalAnalysisFilters, type FinalAnalysisMajor, type FinalAnalysisResult } from '../../../lib/api'
import './finalAnalysis.css'
import './finalAnalysisEnhancements.css'

type Props = { activityId: number }
type SortKey = 'major' | 'studentCount' | 'preMean' | 'postMean' | 'difference' | 'improvement'
type SortDirection = 'asc' | 'desc'

const initialFilters = (activityId: number): FinalAnalysisFilters => ({ activityId, majors: [], educationLevels: [], studyYears: [], phases: ['pre', 'post'] })

function number(value: number | null, decimals = 2) {
  return value === null || !Number.isFinite(value) ? '—' : value.toFixed(decimals)
}

function signed(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}${suffix}`
}

function percentage(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}%`
}

function signedPercentage(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
}

function sortValue(row: FinalAnalysisMajor, key: SortKey) {
  if (key === 'major') return row.major
  if (key === 'studentCount') return row.studentCount
  if (key === 'preMean') return row.pre.mean ?? Number.NEGATIVE_INFINITY
  if (key === 'postMean') return row.post.mean ?? Number.NEGATIVE_INFINITY
  if (key === 'difference') return row.meanDifference ?? Number.NEGATIVE_INFINITY
  return row.improvementPercentage ?? Number.NEGATIVE_INFINITY
}

function SummaryCard({ label, value, note, tone = 'neutral' }: { label: string; value: string | number; note?: string; tone?: 'neutral' | 'pre' | 'post' | 'positive' }) {
  return <article className={`final-analysis-stat final-analysis-stat--${tone}`}><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</article>
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
  return <div className="final-analysis-multiselect"><span>{label}</span><details ref={detailsRef}><summary><strong title={selectedLabel}>{selectedLabel}</strong><i aria-hidden="true" /></summary><div className="final-analysis-multiselect__menu" role="group" aria-label={label}>
    <div className="final-analysis-multiselect__menu-header"><span><strong>{label}</strong><small>เลือกได้มากกว่าหนึ่งรายการ</small></span><b>{selectedCount} / {options.length}</b></div>
    {emptyMeansAll ? <label className={`is-all${values.length === 0 ? ' is-selected' : ''}`}><input type="checkbox" checked={values.length === 0} onChange={() => onChange([])} /><span className="final-analysis-multiselect__option-copy"><strong>{allLabel}</strong><small>รวมทุกตัวเลือก</small></span></label> : null}
    {options.map((option) => { const checked = values.includes(option.value); return <label className={checked ? 'is-selected' : ''} key={option.value}><input type="checkbox" checked={checked} disabled={!emptyMeansAll && checked && values.length === 1} onChange={(event) => toggle(option.value, event.target.checked)} /><span title={option.label}>{option.label}</span></label> })}
    {!options.length ? <p>ยังไม่มีตัวเลือก</p> : null}
  </div></details></div>
}

function MeanBarChart({ data }: { data: FinalAnalysisResult }) {
  const pre = data.paired.enabled ? data.summary.pairedPreMean : data.summary.preMean
  const post = data.paired.enabled ? data.summary.pairedPostMean : data.summary.postMean
  const maximum = Math.max(data.scale.maximum, pre ?? 0, post ?? 0, 1)
  return <section className="final-analysis-panel final-analysis-panel--chart">
    <div className="final-analysis-section-heading"><div><span>MEAN COMPARISON</span><h3>เปรียบเทียบคะแนนเฉลี่ย Pre-test และ Post-test</h3><p>{data.paired.enabled ? `ใช้ผู้ตอบที่จับคู่ได้ ${data.paired.count} คน` : 'แสดงเฉพาะช่วงข้อมูลที่เลือก'}</p></div><div className="final-analysis-legend"><span><i className="is-pre" />Pre-test</span><span><i className="is-post" />Post-test</span></div></div>
    <div className="final-analysis-mean-chart" style={{ '--chart-max': maximum } as React.CSSProperties}>
      <div className="final-analysis-y-label">{maximum.toFixed(0)}</div>
      <div className="final-analysis-y-label final-analysis-y-label--middle">{(maximum / 2).toFixed(1)}</div>
      <div className="final-analysis-bar-pair">
        {pre === null ? <div className="final-analysis-empty-bar">ไม่มี Pre</div> : <div className="final-analysis-bar final-analysis-bar--pre" title={`Pre-test ${pre.toFixed(2)} จาก ${maximum}`} style={{ height: `${(pre / maximum) * 100}%` }}><strong>{pre.toFixed(2)}</strong></div>}
        {post === null ? <div className="final-analysis-empty-bar">ไม่มี Post</div> : <div className="final-analysis-bar final-analysis-bar--post" title={`Post-test ${post.toFixed(2)} จาก ${maximum}`} style={{ height: `${(post / maximum) * 100}%` }}><strong>{post.toFixed(2)}</strong></div>}
      </div>
      <div className="final-analysis-x-label">คะแนนเฉลี่ย (เต็ม {maximum.toFixed(0)})</div>
    </div>
  </section>
}

function MajorTable({ rows, sortKey, direction, onSort, onFocus }: { rows: FinalAnalysisMajor[]; sortKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void; onFocus: (major: string) => void }) {
  const heading = (label: string, key: SortKey) => <button type="button" onClick={() => onSort(key)}>{label}{sortKey === key ? <span aria-hidden="true"> {direction === 'asc' ? '↑' : '↓'}</span> : null}</button>
  return <section className="final-analysis-panel">
    <div className="final-analysis-section-heading"><div><span>MAJOR COMPARISON</span><h3>ตารางเปรียบเทียบรายสาขา</h3><p>กดหัวคอลัมน์เพื่อเรียงลำดับ หรือกดชื่อสาขาเพื่อดูรายละเอียด</p></div></div>
    <div className="final-analysis-table-wrap"><table className="final-analysis-table"><thead><tr><th>{heading('สาขา', 'major')}</th><th>{heading('N', 'studentCount')}</th><th>{heading('Pre Mean', 'preMean')}</th><th>Pre SD</th><th>Pre Min</th><th>Pre Max</th><th>{heading('Post Mean', 'postMean')}</th><th>Post SD</th><th>Post Min</th><th>Post Max</th><th>{heading('ผลต่าง', 'difference')}</th><th>{heading('% เปลี่ยนแปลง', 'improvement')}</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.major}><td><button className="final-analysis-major-link" type="button" onClick={() => onFocus(row.major)}>{row.major}</button><small>จับคู่ {row.pairedCount} คน</small></td><td>{row.studentCount}</td><td>{number(row.pre.mean)}</td><td>{number(row.pre.sd)}</td><td>{number(row.pre.minimum)}</td><td>{number(row.pre.maximum)}</td><td>{number(row.post.mean)}</td><td>{number(row.post.sd)}</td><td>{number(row.post.minimum)}</td><td>{number(row.post.maximum)}</td><td className={row.meanDifference !== null && row.meanDifference > 0 ? 'is-positive' : row.meanDifference !== null && row.meanDifference < 0 ? 'is-negative' : ''}>{signed(row.meanDifference)}</td><td>{signedPercentage(row.improvementPercentage)}</td></tr>)}
      {!rows.length ? <tr><td colSpan={12} className="final-analysis-table-empty">ไม่พบข้อมูลสาขาตามตัวกรอง</td></tr> : null}
    </tbody></table></div>
  </section>
}

function MajorChart({ rows, maximum, onFocus }: { rows: FinalAnalysisMajor[]; maximum: number; onFocus: (major: string) => void }) {
  const safeMaximum = Math.max(maximum, 1)
  return <section className="final-analysis-panel"><div className="final-analysis-section-heading"><div><span>GROUPED BAR CHART</span><h3>คะแนนเฉลี่ยแยกตามสาขา</h3><p>เลือกแถบของสาขาเพื่อเปิดรายละเอียด</p></div><div className="final-analysis-legend"><span><i className="is-pre" />Pre</span><span><i className="is-post" />Post</span></div></div>
    <div className="final-analysis-major-chart">{rows.map((row) => <button key={row.major} type="button" className="final-analysis-major-chart__row" onClick={() => onFocus(row.major)} title={`${row.major}: N ${row.studentCount}, Pre ${number(row.pre.mean)}, Post ${number(row.post.mean)}, ผลต่าง ${signed(row.meanDifference)}, เปลี่ยนแปลง ${signedPercentage(row.improvementPercentage)}`}><strong>{row.major}</strong><div><span className="is-pre" style={{ width: `${((row.pre.mean ?? 0) / safeMaximum) * 100}%` }}>{row.pre.mean === null ? '' : row.pre.mean.toFixed(2)}</span><span className="is-post" style={{ width: `${((row.post.mean ?? 0) / safeMaximum) * 100}%` }}>{row.post.mean === null ? '' : row.post.mean.toFixed(2)}</span></div></button>)}</div>
  </section>
}

function DistributionChart({ data }: { data: FinalAnalysisResult }) {
  const maximumCount = Math.max(1, ...data.distribution.flatMap((bin) => [bin.preCount, bin.postCount]))
  return <section className="final-analysis-panel"><div className="final-analysis-section-heading"><div><span>DISTRIBUTION</span><h3>การกระจายของคะแนน</h3><p>ช่วงคะแนนปรับอัตโนมัติตามสเกลจริง {data.scale.minimum.toFixed(0)}–{data.scale.maximum.toFixed(0)}</p></div><div className="final-analysis-legend"><span><i className="is-pre" />Pre</span><span><i className="is-post" />Post</span></div></div>
    <div className="final-analysis-distribution">{data.distribution.map((bin) => <div className="final-analysis-distribution__group" key={bin.label} title={`${bin.label}: Pre ${bin.preCount} คน, Post ${bin.postCount} คน`}><div><span className="is-pre" style={{ height: `${(bin.preCount / maximumCount) * 100}%` }}><b>{bin.preCount || ''}</b></span><span className="is-post" style={{ height: `${(bin.postCount / maximumCount) * 100}%` }}><b>{bin.postCount || ''}</b></span></div><small>{bin.label}</small></div>)}</div>
  </section>
}

function BoxPlot({ data }: { data: FinalAnalysisResult }) {
  const maximum = Math.max(data.scale.maximum, 1)
  const minimum = data.scale.minimum
  const range = Math.max(maximum - minimum, 1)
  const position = (value: number | null) => `${((((value ?? minimum) - minimum) / range) * 100).toFixed(2)}%`
  const row = (label: string, stats: FinalAnalysisResult['boxPlot']['pre'], className: string) => <div className="final-analysis-box-row"><strong>{label}</strong>{stats.n ? <div className="final-analysis-box-track" title={`${label}: min ${number(stats.minimum)}, Q1 ${number(stats.q1)}, median ${number(stats.median)}, Q3 ${number(stats.q3)}, max ${number(stats.maximum)}`}><span className={`final-analysis-box-whisker ${className}`} style={{ left: position(stats.minimum), width: `calc(${position(stats.maximum)} - ${position(stats.minimum)})` }} /><span className={`final-analysis-box ${className}`} style={{ left: position(stats.q1), width: `calc(${position(stats.q3)} - ${position(stats.q1)})` }} /><span className="final-analysis-box-median" style={{ left: position(stats.median) }} />{stats.outliers.map((outlier, index) => <i key={`${outlier}-${index}`} style={{ left: position(outlier) }} />)}</div> : <span className="final-analysis-box-empty">ไม่มีข้อมูล</span>}<small>N = {stats.n}</small></div>
  return <section className="final-analysis-panel"><div className="final-analysis-section-heading"><div><span>BOX PLOT</span><h3>การกระจายและค่ากลาง</h3><p>Whisker ใช้เกณฑ์ 1.5 × IQR และจุดวงกลมคือ outlier</p></div></div><div className="final-analysis-boxplot">{row('Pre-test', data.boxPlot.pre, 'is-pre')}{row('Post-test', data.boxPlot.post, 'is-post')}<div className="final-analysis-box-scale"><span>{minimum.toFixed(0)}</span><span>{maximum.toFixed(0)}</span></div></div></section>
}

function FinalAnalysisDashboard({ activityId }: Props) {
  const [filters, setFilters] = useState<FinalAnalysisFilters>(() => initialFilters(activityId))
  const [data, setData] = useState<FinalAnalysisResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('postMean')
  const [direction, setDirection] = useState<SortDirection>('desc')
  const [focusedMajor, setFocusedMajor] = useState('')

  useEffect(() => {
    let cancelled = false
    void getFinalAnalysis(filters).then((result) => { if (!cancelled) setData(result) }).catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'ไม่สามารถโหลดผลวิเคราะห์ได้') }).finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [filters])

  const sortedMajors = useMemo(() => [...(data?.majors ?? [])].sort((left, right) => {
    const leftValue = sortValue(left, sortKey)
    const rightValue = sortValue(right, sortKey)
    const result = typeof leftValue === 'string' && typeof rightValue === 'string' ? leftValue.localeCompare(rightValue, 'th') : Number(leftValue) - Number(rightValue)
    return direction === 'asc' ? result : -result
  }), [data?.majors, direction, sortKey])
  const ranking = useMemo(() => [...(data?.majors ?? [])].filter((row) => row.rankingScore !== null).sort((left, right) => right.rankingScore! - left.rankingScore!), [data?.majors])
  const focused = useMemo(() => data?.majors.find((row) => row.major === focusedMajor) ?? (filters.majors.length === 1 ? data?.majors[0] : undefined), [data?.majors, filters.majors.length, focusedMajor])
  const comparisonSelected = filters.phases.includes('pre') && filters.phases.includes('post')

  const applyFilters = (next: FinalAnalysisFilters) => { setIsLoading(true); setError(''); setFilters(next) }
  const updateFilter = <Key extends keyof FinalAnalysisFilters>(key: Key, value: FinalAnalysisFilters[Key]) => applyFilters({ ...filters, [key]: value })
  const handleSort = (key: SortKey) => { if (key === sortKey) setDirection((current) => current === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setDirection(key === 'major' ? 'asc' : 'desc') } }

  return <div className="final-analysis-dashboard">
    <section className="final-analysis-intro"><div><span>FINAL DATA ANALYSIS</span><h2>วิเคราะห์ผล Pre-test และ Post-test</h2><p>คำนวณจากคำตอบจริงรายคนในฐานข้อมูล โดยใช้รหัสนักศึกษาเป็นตัวจับคู่ Pre/Post</p></div>{data ? <span className="final-analysis-scale-badge">สเกลจริง {data.scale.minimum.toFixed(0)}–{data.scale.maximum.toFixed(0)}</span> : null}</section>
    <section className="final-analysis-filters" aria-label="ตัวกรองผลวิเคราะห์">
      <MultiSelectFilter label="สาขาวิชา" values={filters.majors} options={(data?.filters.options.majors ?? []).map((major) => ({ value: major, label: major }))} allLabel="ทุกสาขา" onChange={(values) => updateFilter('majors', values)} />
      <MultiSelectFilter label="ระดับการศึกษา" values={filters.educationLevels} options={(data?.filters.options.educationLevels ?? []).map((level) => ({ value: level, label: level }))} allLabel="ทุกระดับ" onChange={(values) => updateFilter('educationLevels', values)} />
      <MultiSelectFilter label="ชั้นปี / กลุ่มรุ่น" values={filters.studyYears} options={(data?.filters.options.studyYears ?? []).map((year) => ({ value: String(year), label: `ชั้นปี ${year}` }))} allLabel="ทุกชั้นปี" onChange={(values) => updateFilter('studyYears', values)} />
      <MultiSelectFilter label="ช่วงการประเมิน" values={filters.phases} options={[{ value: 'pre', label: 'Pre-test' }, { value: 'post', label: 'Post-test' }]} allLabel="ทุกช่วง" combinedLabel="Pre + Post" emptyMeansAll={false} onChange={(values) => updateFilter('phases', values as FinalAnalysisFilters['phases'])} />
      <div className="final-analysis-filter-actions"><button type="button" onClick={() => { setFocusedMajor(''); applyFilters(initialFilters(activityId)) }}>ล้างตัวกรอง</button><button type="button" className="is-primary" onClick={() => updateFilter('majors', [])}>แสดงทุกสาขา</button></div>
    </section>

    {isLoading ? <div className="final-analysis-state" role="status"><span />กำลังคำนวณผลจากข้อมูลจริง...</div> : error ? <div className="final-analysis-state final-analysis-state--error"><strong>โหลดผลวิเคราะห์ไม่สำเร็จ</strong><p>{error}</p><button type="button" onClick={() => applyFilters({ ...filters })}>ลองอีกครั้ง</button></div> : !data || data.summary.respondentCount === 0 ? <div className="final-analysis-state"><strong>ยังไม่มีข้อมูลตามตัวกรองนี้</strong><p>ลองเปลี่ยนสาขา ชั้นปี หรือช่วงการประเมิน</p></div> : <>
      <section className="final-analysis-stats" aria-label="สรุปภาพรวม"><SummaryCard label="ผู้ตอบจริง (N)" value={data.summary.respondentCount} note={`จับคู่ได้ ${data.summary.pairedCount} คน`} /><SummaryCard label="คะแนนเฉลี่ย Pre-test" value={number(data.summary.preMean)} note={`จาก ${data.descriptive.pre.n} แบบประเมิน`} tone="pre" /><SummaryCard label="คะแนนเฉลี่ย Post-test" value={number(data.summary.postMean)} note={`จาก ${data.descriptive.post.n} แบบประเมิน`} tone="post" /><SummaryCard label="ผลต่างเฉลี่ยแบบจับคู่" value={signed(data.summary.meanDifference)} note="Post − Pre" tone={data.summary.meanDifference !== null && data.summary.meanDifference > 0 ? 'positive' : 'neutral'} /><SummaryCard label="ร้อยละการเปลี่ยนแปลง" value={signedPercentage(data.summary.improvementPercentage)} note="เทียบค่าเฉลี่ย Pre ของคู่เดิม" /><SummaryCard label="คะแนนสูงสุด" value={number(data.summary.maximum)} note={`จากคะแนนเต็ม ${data.scale.maximum.toFixed(0)}`} /><SummaryCard label="คะแนนต่ำสุด" value={number(data.summary.minimum)} /><SummaryCard label="ส่วนเบี่ยงเบนมาตรฐาน" value={number(data.summary.sampleSd)} note="Sample SD (n − 1)" /></section>

      <section className="final-analysis-panel"><div className="final-analysis-section-heading"><div><span>DESCRIPTIVE STATISTICS</span><h3>สถิติเชิงพรรณนา</h3><p>ค่าส่วนเบี่ยงเบนมาตรฐานใช้สูตรตัวอย่าง (Sample SD)</p></div></div><div className="final-analysis-table-wrap"><table className="final-analysis-table final-analysis-table--compact"><thead><tr><th>Statistic</th><th><span className="final-analysis-phase is-pre">Pre-test</span></th><th><span className="final-analysis-phase is-post">Post-test</span></th></tr></thead><tbody><tr><td>N</td><td>{data.descriptive.pre.n}</td><td>{data.descriptive.post.n}</td></tr><tr><td>Mean</td><td>{number(data.descriptive.pre.mean)}</td><td>{number(data.descriptive.post.mean)}</td></tr><tr><td>Maximum</td><td>{number(data.descriptive.pre.maximum)}</td><td>{number(data.descriptive.post.maximum)}</td></tr><tr><td>Minimum</td><td>{number(data.descriptive.pre.minimum)}</td><td>{number(data.descriptive.post.minimum)}</td></tr><tr><td>Standard Deviation (SD)</td><td>{number(data.descriptive.pre.sd)}</td><td>{number(data.descriptive.post.sd)}</td></tr></tbody></table></div></section>

      <section className="final-analysis-panel"><div className="final-analysis-section-heading"><div><span>PAIRED COMPARISON</span><h3>การเปรียบเทียบ Pre/Post รายคน</h3><p>ใช้เฉพาะนักศึกษาคนเดิมที่มีทั้งสองช่วง ส่วนข้อมูลที่ไม่ครบคู่ยังคงอยู่ในฐานข้อมูลและสถิติแยก</p></div></div>{data.paired.enabled ? <><div className="final-analysis-paired"><article className="is-improved"><span>คะแนนดีขึ้น</span><strong>{data.paired.improved.count}</strong><small>{percentage(data.paired.improved.percentage)}</small></article><article className="is-unchanged"><span>คะแนนเท่าเดิม</span><strong>{data.paired.unchanged.count}</strong><small>{percentage(data.paired.unchanged.percentage)}</small></article><article className="is-decreased"><span>คะแนนลดลง</span><strong>{data.paired.decreased.count}</strong><small>{percentage(data.paired.decreased.percentage)}</small></article><article className="is-unpaired"><span>ยังไม่ครบคู่</span><strong>{data.paired.unpairedPreCount + data.paired.unpairedPostCount}</strong><small>Pre {data.paired.unpairedPreCount} · Post {data.paired.unpairedPostCount}</small></article></div><div className="final-analysis-paired-statistics"><div><span>N</span><strong>{data.paired.count}</strong></div><div><span>Pre-test Mean ± SD</span><strong>{number(data.paired.pre.mean)} ± {number(data.paired.pre.sd)}</strong></div><div><span>Post-test Mean ± SD</span><strong>{number(data.paired.post.mean)} ± {number(data.paired.post.sd)}</strong></div><div><span>Mean Difference</span><strong>{signed(data.paired.difference.mean)}</strong></div></div></> : <div className="final-analysis-inline-empty">เลือก “Pre + Post” เพื่อเปิดการเปรียบเทียบแบบจับคู่</div>}<div className="final-analysis-method-note"><strong>การวิเคราะห์เชิงอนุมาน</strong><span>หน้านี้แสดงสถิติเชิงพรรณนาที่ตรวจสอบได้ก่อน และยังไม่แสดง t-test, p-value หรือ Cohen's d จนกว่าจะกำหนดสมมติฐานและเกณฑ์ทางสถิติของโครงการอย่างเป็นทางการ</span></div></section>

      <MeanBarChart data={data} />
      <div className="final-analysis-two-column"><MajorChart rows={data.majors} maximum={data.scale.maximum} onFocus={setFocusedMajor} /><section className="final-analysis-panel"><div className="final-analysis-section-heading"><div><span>RANKING</span><h3>อันดับสาขา</h3><p>{comparisonSelected ? 'เรียงจากร้อยละการพัฒนาสูงสุดไปต่ำสุด' : 'เรียงจากคะแนนเฉลี่ยของช่วงที่เลือก'}</p></div></div><ol className="final-analysis-ranking">{ranking.map((row, index) => <li className={index < 3 ? `is-top is-top-${index + 1}` : ''} key={row.major}><span>{index + 1}</span><button type="button" onClick={() => setFocusedMajor(row.major)}><strong>{row.major}</strong><small>Pre {number(row.pairedPreMean ?? row.pre.mean)} · Post {number(row.pairedPostMean ?? row.post.mean)} · ต่าง {signed(row.meanDifference)}</small></button><b>{comparisonSelected ? signedPercentage(row.rankingScore) : number(row.rankingScore)}</b></li>)}</ol></section></div>
      <MajorTable rows={sortedMajors} sortKey={sortKey} direction={direction} onSort={handleSort} onFocus={setFocusedMajor} />
      <div className="final-analysis-two-column"><DistributionChart data={data} /><BoxPlot data={data} /></div>

      {focused ? <section className="final-analysis-panel final-analysis-focus"><div className="final-analysis-section-heading"><div><span>SELECTED MAJOR</span><h3>รายละเอียดสาขา {focused.major}</h3><p>สรุปจากตัวกรองและข้อมูลจริงชุดเดียวกับตารางด้านบน</p></div><button type="button" onClick={() => setFocusedMajor('')} aria-label="ปิดรายละเอียดสาขา">×</button></div><div className="final-analysis-focus__groups"><article><h4>Pre-test</h4><dl><div><dt>N</dt><dd>{focused.pre.n}</dd></div><div><dt>Mean</dt><dd>{number(focused.pre.mean)}</dd></div><div><dt>Maximum</dt><dd>{number(focused.pre.maximum)}</dd></div><div><dt>Minimum</dt><dd>{number(focused.pre.minimum)}</dd></div><div><dt>SD</dt><dd>{number(focused.pre.sd)}</dd></div></dl></article><article><h4>Post-test</h4><dl><div><dt>N</dt><dd>{focused.post.n}</dd></div><div><dt>Mean</dt><dd>{number(focused.post.mean)}</dd></div><div><dt>Maximum</dt><dd>{number(focused.post.maximum)}</dd></div><div><dt>Minimum</dt><dd>{number(focused.post.minimum)}</dd></div><div><dt>SD</dt><dd>{number(focused.post.sd)}</dd></div></dl></article><article><h4>Improvement</h4><dl><div><dt>Mean Difference</dt><dd>{signed(focused.meanDifference)}</dd></div><div><dt>Percentage</dt><dd>{signedPercentage(focused.improvementPercentage)}</dd></div><div><dt>Improved</dt><dd>{focused.improved.count} ({percentage(focused.improved.percentage)})</dd></div><div><dt>Unchanged</dt><dd>{focused.unchanged.count} ({percentage(focused.unchanged.percentage)})</dd></div><div><dt>Decreased</dt><dd>{focused.decreased.count} ({percentage(focused.decreased.percentage)})</dd></div></dl></article></div></section> : null}

      <section className="final-analysis-panel final-analysis-insights"><div className="final-analysis-section-heading"><div><span>AUTOMATIC SUMMARY</span><h3>สรุปผลอัตโนมัติจากข้อมูลจริง</h3><p>ข้อความจะปรับตามตัวกรองและผลลัพธ์ล่าสุด</p></div></div><ul>{data.insights.map((insight) => <li key={insight}>{insight}</li>)}</ul></section>
    </>}
  </div>
}

export default FinalAnalysisDashboard
