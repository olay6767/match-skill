import Button from '../ui/Button'
type DashboardPageHeaderProps = {
  onCreate: () => void
}

function DashboardPageHeader({ onCreate }: DashboardPageHeaderProps) {
  return (
    <div className="dashboard-heading">
      <div>
        <h1>แดชบอร์ดสรุปผล</h1>
        <p>ข้อมูลภาพรวมกิจกรรมและผลการประเมินทักษะปัจจุบัน</p>
      </div>
      <Button className="create-button" onClick={onCreate}>
        <span aria-hidden="true">＋</span> สร้างกิจกรรมใหม่
      </Button>
    </div>
  )
}

export default DashboardPageHeader
