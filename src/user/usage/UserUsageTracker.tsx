import { useEffect } from 'react'
import { ensureUserUsageTracking, trackPageView } from './tracker'

function UserUsageTracker({ path }: { path: string }) {
  useEffect(() => {
    ensureUserUsageTracking()
    trackPageView(path)
  }, [path])
  return null
}

export default UserUsageTracker
