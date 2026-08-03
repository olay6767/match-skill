import type { ButtonHTMLAttributes } from 'react'
import Button from './Button'

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  label: string
}

function IconButton({ label, ...props }: IconButtonProps) {
  return <Button aria-label={label} {...props} />
}

export default IconButton
