import { ReactNode } from 'react'

interface ScrollableTableProps {
  children: ReactNode
  className?: string
  stickyX?: boolean
}

/** Thin wrapper for enterprise table scroll panels — uses globals.css `.ent-table-wrap`. */
export function ScrollableTable({ children, className = '', stickyX = false }: ScrollableTableProps) {
  const wrapClass = [
    'ent-table-wrap',
    stickyX ? 'ent-table-wrap--sticky-x' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={wrapClass}>{children}</div>
}
