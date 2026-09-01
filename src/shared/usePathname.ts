import { useCallback, useEffect, useState } from 'react'

export type Navigate = (path: string, replace?: boolean) => void

export function usePathname() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])

  const navigate = useCallback<Navigate>((nextPath, replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath)
    setPath(window.location.pathname)
  }, [])

  return [path, navigate] as const
}
