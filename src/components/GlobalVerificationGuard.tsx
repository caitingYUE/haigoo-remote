import React from 'react'

interface GlobalVerificationGuardProps {
  children: React.ReactNode
}

export default function GlobalVerificationGuard({ children }: GlobalVerificationGuardProps) {
  return <>{children}</>
}
