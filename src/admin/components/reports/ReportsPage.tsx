import { useEffect, useState } from 'react'
import { downloadReport, getDashboardActivityOptions, getExportHistory, type ExportHistoryItem, type ReportExportFilters, type ReportExportType } from '../../../lib/api'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import Icon from '../../../shared/components/ui/Icon'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import reportArtwork from '../../../assets/67.png'
import './reports.css'

type Props = { adminEmail: string; onLogout: () => void; onNavigate: (item: DashboardNav) => void; onSettings: () => void }
const initialFilters: ReportExportFilters = { activityId: '' }

function ReportsPage({ adminEmail, onLogout, onNavigate, onSettings }: Props) {
  const [filters, setFilters] = useState<ReportExportFilters>(initialFilters)
  const [activities, setActivities] = useState<Array<{ id: number; name: string }>>([])
  const [history, setHistory] = useState<ExportHistoryItem[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [historyPage, setHistoryPage] = useState(1)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [working, setWorking] = useState<ReportExportType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [historyReload, setHistoryReload] = useState(0)

  useEffect(() => { getDashboardActivityOptions().then(setActivities).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดรายการกิจกรรมได้')) }, [])
  useEffect(() => {
    getExportHistory(historyPage).then((result) => { setHistory(result.history); setPagination(result.pagination) }).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดประวัติการส่งออกได้')).finally(() => setIsLoading(false))
  }, [historyPage, historyReload])
  const update = (patch: Partial<ReportExportFilters>) => { setError(''); setNotice(''); setFilters((current) => ({ ...current, ...patch })) }
  const exportFile = async (type: ReportExportType) => {
    if (!filters.activityId) { setError('กรุณาเลือกกิจกรรมก่อนส่งออก'); return }
    setWorking(type); setError(''); setNotice('')
    try {
      const result = await downloadReport(type, filters)
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url; link.download = result.filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url)
      setNotice(`สร้างและบันทึก audit log สำหรับ ${type === 'final' ? 'Final' : type === 'raw' ? 'Raw Data' : 'Summary'} แล้ว`)
      setHistoryPage(1); setHistoryReload((value) => value + 1)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถส่งออกรายงานได้') } finally { setWorking(null) }
  }
  return <DashboardLayout activeNav="Reports" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings} search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    <header className="reports-page-heading"><div><p className="eyebrow">REPORTS &amp; EXPORT</p><h1>รายงานและการส่งออกข้อมูล</h1><p>เลือกกิจกรรม แล้วดาวน์โหลดรายงาน Final ในรูปแบบ Excel</p></div></header>
    <section className="reports-panel reports-export-panel" aria-labelledby="report-export-title"><div className="reports-panel__header"><div><span>EXPORT WORKSPACE</span><h2 id="report-export-title">สร้างไฟล์รายงาน Final</h2></div></div>
      <div className="reports-export-workspace"><div className="reports-export-setup"><div className="reports-filters"><ScrollableSelect label="เลือกกิจกรรม" value={filters.activityId} invalid={Boolean(error && !filters.activityId)} options={[{ value: '', label: 'เลือกกิจกรรม' }, ...activities.map((activity) => ({ value: String(activity.id), label: activity.name }))]} onChange={(activityId) => update({ activityId })} /></div>
      <aside className="reports-pdpa-warning" aria-label="คำเตือนข้อมูลส่วนบุคคล"><strong>ข้อมูลส่วนบุคคล (PDPA)</strong><p>ไฟล์มีชื่อ รหัสนักศึกษา และคำตอบรายข้อ โปรดดาวน์โหลดเมื่อมีสิทธิ์ เก็บในพื้นที่ที่ได้รับอนุญาต และไม่ส่งต่อนอกวัตถุประสงค์</p></aside>{error && <p className="reports-error" role="alert">{error}</p>}</div>
      <div className="reports-export-options"><article className="reports-export-card"><div className="reports-export-card__content"><div className="reports-export-card__art"><img src={reportArtwork} alt="ไฟล์ Excel" /></div><div className="reports-export-card__title"><span>พร้อมส่งออก</span><h3>Final Report</h3></div></div><Button className="reports-download-button" aria-busy={working === 'final'} disabled={working !== null} onClick={() => void exportFile('final')}><Icon name="download" />{working === 'final' ? 'กำลังเตรียมไฟล์...' : 'ดาวน์โหลด Final (.xlsx)'}</Button></article></div></div>
    </section>
    <section className="reports-panel" aria-labelledby="report-history-title"><div className="reports-panel__header"><div><h2 id="report-history-title">ประวัติการส่งออก</h2></div></div>{isLoading ? <div className="dashboard-loading" role="status">กำลังโหลดประวัติ...</div> : history.length === 0 ? <div className="analytics-empty">ยังไม่มีประวัติการส่งออก</div> : <div className="reports-history-wrap"><table><thead><tr><th>เวลา</th><th>ผู้ส่งออก</th><th>ชนิด</th><th>กิจกรรม</th><th>ชื่อไฟล์</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{new Date(item.createdAt).toLocaleString('th-TH')}</td><td>{item.adminEmail}</td><td>{item.type === 'combined_analysis' ? 'วิเคราะห์กิจกรรมร่วมกัน' : item.type === 'final' ? 'Final' : item.type === 'raw' ? 'Raw Data' : 'Summary'}</td><td>{item.activityCode ?? '—'} {item.activityName ?? ''}</td><td>{item.fileName}</td></tr>)}</tbody></table></div>}<div className="reports-pagination"><span>ทั้งหมด {pagination.total} รายการ · หน้า {pagination.totalPages === 0 ? 0 : pagination.page}/{pagination.totalPages}</span><Button disabled={pagination.page <= 1} onClick={() => { setIsLoading(true); setHistoryPage(pagination.page - 1) }}>ก่อนหน้า</Button><Button disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages} onClick={() => { setIsLoading(true); setHistoryPage(pagination.page + 1) }}>ถัดไป</Button></div></section>
  </DashboardLayout>
}

export default ReportsPage
