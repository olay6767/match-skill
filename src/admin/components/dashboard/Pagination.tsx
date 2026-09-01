import Button from '../../../shared/components/ui/Button'
import IconButton from '../../../shared/components/ui/IconButton'
import Icon from '../../../shared/components/ui/Icon'
import type { DemoAction } from './types'

type PaginationProps = {
  onDemoAction: DemoAction
}

function Pagination({ onDemoAction }: PaginationProps) {
  return (
    <div className="pagination" aria-label="Pagination">
      <IconButton label="Previous page"><Icon name="chevronLeft" /></IconButton>
      <Button className="active">1</Button>
      <Button onClick={() => onDemoAction('หน้าที่ 2')}>2</Button>
      <Button onClick={() => onDemoAction('หน้าที่ 3')}>3</Button>
      <span>…</span>
      <Button onClick={() => onDemoAction('หน้าที่ 40')}>40</Button>
      <IconButton label="Next page" onClick={() => onDemoAction('หน้าถัดไป')}><Icon name="chevronRight" /></IconButton>
    </div>
  )
}

export default Pagination
