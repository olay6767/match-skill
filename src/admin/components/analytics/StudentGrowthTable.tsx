import type { AnalyticsStudent } from '../../../lib/api'
import Button from '../../../shared/components/ui/Button'

type Props = { students: AnalyticsStudent[]; pagination: { page: number; pageSize: number; total: number; totalPages: number }; onPageChange: (page: number) => void }
const score = (value: number | null) => value === null ? '—' : value.toFixed(2)

function StudentGrowthTable({ students, pagination, onPageChange }: Props) {
  return <section className="analytics-panel analytics-students" aria-labelledby="analytics-students-title"><div className="analytics-panel__header"><div><p className="eyebrow">ข้อมูลจำกัดสิทธิ์ผู้ดูแล</p><h2 id="analytics-students-title">ตารางผลรายบุคคล</h2><p>แสดงค่าเฉลี่ยคำตอบของแต่ละคนตามตัวกรอง; ค่า — หมายถึงไม่มีข้อมูล ไม่ใช่คะแนนศูนย์</p></div></div>
    {students.length === 0 ? <div className="analytics-empty">ไม่พบผู้เข้าร่วมตามตัวกรอง</div> : <div className="analytics-table-wrap"><table><thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ</th><th>คณะ / ระดับ</th><th>กิจกรรม</th><th>Pre</th><th>Post</th><th>ค่าเฉลี่ย Pre</th><th>ค่าเฉลี่ย Post</th><th>Growth</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td>{student.studentCode}</td><td>{student.firstName} {student.lastName}</td><td>{student.faculty ?? 'ไม่ระบุ'}<small>{student.educationLevel ?? 'ไม่ระบุระดับ'}</small></td><td>{student.activityCount}</td><td>{student.preCount}</td><td>{student.postCount}</td><td>{score(student.preAverage)}</td><td>{score(student.postAverage)}</td><td>{score(student.growth)}</td></tr>)}</tbody></table></div>}
    <div className="analytics-pagination"><span>ทั้งหมด {pagination.total} คน · หน้า {pagination.totalPages === 0 ? 0 : pagination.page}/{pagination.totalPages}</span><Button disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>ก่อนหน้า</Button><Button disabled={pagination.totalPages === 0 || pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>ถัดไป</Button></div>
  </section>
}

export default StudentGrowthTable
