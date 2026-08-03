import IconButton from './IconButton'

type NoticeProps = {
  message: string
  onClose: () => void
}

function Notice({ message, onClose }: NoticeProps) {
  return (
    <div className="dashboard-notice" role="status">
      <span>{message}</span>
      <IconButton label="ปิดข้อความ" onClick={onClose}>×</IconButton>
    </div>
  )
}

export default Notice
