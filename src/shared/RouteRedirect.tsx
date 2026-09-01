import { useEffect } from 'react'
import type { Navigate } from './usePathname'

function RouteRedirect({ to, navigate }: { to: string; navigate: Navigate }) {
  useEffect(() => navigate(to, true), [navigate, to])
  return <main role="status">กำลังเปิดหน้าที่ถูกต้อง...</main>
}

export default RouteRedirect
