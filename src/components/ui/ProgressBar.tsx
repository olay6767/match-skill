type ProgressBarProps = {
  value: number
  tone?: 'green' | 'orange'
}

function ProgressBar({ value, tone = 'green' }: ProgressBarProps) {
  return (
    <div className="table-progress">
      <span className={`table-progress__track table-progress__track--${tone}`}>
        <span style={{ width: `${value}%` }} />
      </span>
      <strong>{value}%</strong>
    </div>
  )
}

export default ProgressBar
