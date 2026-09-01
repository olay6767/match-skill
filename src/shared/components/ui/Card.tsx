import type { ReactNode } from 'react'

type CardProps = {
  as?: 'article' | 'div' | 'section'
  className?: string
  children: ReactNode
  'aria-label'?: string
}

function Card({ as: Element = 'div', children, ...props }: CardProps) {
  return <Element {...props}>{children}</Element>
}

export default Card
