import React from 'react'

interface NotificationProps {
  message: string
  type: 'success' | 'error'
}

export function Notification({
  message,
  type
}: NotificationProps): React.ReactElement {
  return (
    <div className={`notification notification-${type}`}>
      {type === 'success' ? '✓' : '✕'} {message}
    </div>
  )
}
