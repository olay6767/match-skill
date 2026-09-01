type AssessmentProgressProps = {
  current: number
  total: number
}

function AssessmentProgress({ current, total }: AssessmentProgressProps) {
  return (
    <div className="student-assessment-progress">
      <div>
        <span>ความคืบหน้า</span>
        <strong>ข้อ {current} จาก {total}</strong>
      </div>
      <progress value={current} max={total}>ข้อ {current} จาก {total}</progress>
    </div>
  )
}

export default AssessmentProgress
