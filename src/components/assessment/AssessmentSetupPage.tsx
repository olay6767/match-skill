import { useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import { assessmentSkills } from './assessmentData'

type AssessmentSetupPageProps = {
  adminEmail: string
  onLogout: () => void
  onNavigate: (item: DashboardNav) => void
}

function AssessmentSetupPage({ adminEmail, onLogout, onNavigate }: AssessmentSetupPageProps) {
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')

  const showMessage = (message: string) => setNotice(message)

  return (
    <DashboardLayout
      activeNav="Assessments"
      adminEmail={adminEmail}
      notice={notice}
      onCloseNotice={() => setNotice('')}
      onDemoAction={(label) => showMessage(`${label} จะพร้อมใช้งานในขั้นถัดไป`)}
      onLogout={onLogout}
      onNavigate={onNavigate}
      onSearchChange={setSearch}
      search={search}
    >
      <div className="assessment-breadcrumb">
        <span>Assessments</span>
        <span aria-hidden="true">›</span>
        <strong>New Configuration</strong>
      </div>

      <section className="assessment-hero">
        <div>
          <h1>Skill Assessment Setup</h1>
          <p>
            Configure the evaluation criteria for the upcoming leadership workshop. This standardized
            assessment will measure core competencies across nine key skill domains for both pre and post-session analysis.
          </p>
        </div>
        <div className="assessment-hero-stats">
          <div><small>QUESTIONS</small><strong>18 Total</strong></div>
          <div><small>DURATION</small><strong>~12 Mins</strong></div>
        </div>
      </section>

      <div className="assessment-setup-grid">
        <section className="assessment-skills panel">
          <div className="assessment-section-heading">
            <div>
              <h2><Icon name="check" /> Standard 9-Skill Assessment</h2>
              <p>Comprehensive competency evaluation framework</p>
            </div>
            <span className="assessment-template-badge">Active Template</span>
          </div>

          <div className="assessment-skill-grid">
            {assessmentSkills.map((skill) => (
              <article className={`assessment-skill-card assessment-skill-card--${skill.tone}`} key={skill.title}>
                <Icon name={skill.icon} />
                <h3>{skill.title}</h3>
                <p>{skill.description}</p>
              </article>
            ))}
          </div>

          <div className="assessment-methodology">
            <div>
              <Icon name="reports" />
              <span><strong>Standardized Methodology</strong><small>Same questionnaire used for Pre and Post states for accurate growth mapping.</small></span>
            </div>
            <div>
              <Icon name="analytics" />
              <span><strong>1–7 Likert Scale</strong><small>Granular response options ranging from 'Very Low' to 'Excellent'.</small></span>
            </div>
          </div>
        </section>

        <aside className="assessment-side-column">
          <section className="assessment-summary panel">
            <h2>Configuration Summary</h2>
            <dl>
              <div><dt>Assessment Type</dt><dd>Bilateral (Pre/Post)</dd></div>
              <div><dt>Scale Range</dt><dd>1 to 7</dd></div>
              <div><dt>Skills Tracked</dt><dd>9 Skills</dd></div>
              <div><dt>Est. Resp. Time</dt><dd>12 minutes</dd></div>
            </dl>
            <Button className="assessment-save-button" onClick={() => showMessage('บันทึกการตั้งค่าแล้ว — QR Code จะเพิ่มในขั้นถัดไป')}>
              <Icon name="check" /> บันทึกการตั้งค่า
            </Button>
            <Button className="assessment-back-button" onClick={() => onNavigate('Dashboard')}>Back</Button>
          </section>

          <section className="assessment-help panel">
            <span className="assessment-help-shape" aria-hidden="true" />
            <strong>NEED HELP?</strong>
            <p>Contact support for custom assessment frameworks and advanced weighting options.</p>
          </section>
        </aside>
      </div>
    </DashboardLayout>
  )
}

export default AssessmentSetupPage
