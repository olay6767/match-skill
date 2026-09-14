import Button from '../../../shared/components/ui/Button'
import dashboardHeroArtwork from '../../../assets/7.png'

type DashboardPageHeaderProps = {
  onCreate: () => void
}

function DashboardPageHeader({ onCreate }: DashboardPageHeaderProps) {
  return (
    <section className="dashboard-heading dashboard-heading--analytics dashboard-overview-hero">
      <div className="dashboard-overview-hero__copy">
        <p className="dashboard-eyebrow">DASHBOARD</p>
        <h1>ภาพรวมการดำเนินกิจกรรม</h1>
        <p>ติดตามจำนวนผู้ตอบแบบประเมิน ผลการทำครบ และแนวโน้มสมรรถนะจากทุกกิจกรรม</p>
      </div>
      <Button className="create-button" onClick={onCreate}>
        <span aria-hidden="true">＋</span> สร้างกิจกรรมใหม่
      </Button>
      <img className="dashboard-overview-hero__art" src={dashboardHeroArtwork} alt="" aria-hidden="true" />
    </section>
  )
}

export default DashboardPageHeader
