import Button from '../../../shared/components/ui/Button'
type DashboardPageHeaderProps = {
  onCreate: () => void
}

function DashboardPageHeader({ onCreate }: DashboardPageHeaderProps) {
  return (
    <div className="dashboard-heading dashboard-heading--analytics">
      <div>
        <p className="dashboard-eyebrow">DASHBOARD</p>
        <h1>ภาพรวมการดำเนินกิจกรรม</h1>
        <p>ติดตามจำนวนผู้ตอบแบบประเมิน ผลการทำครบ และแนวโน้มสมรรถนะจากทุกกิจกรรม</p>
      </div>
      <Button className="create-button" onClick={onCreate}>
        <span aria-hidden="true">＋</span> สร้างกิจกรรมใหม่
      </Button>
    </div>
  )
}

export default DashboardPageHeader
