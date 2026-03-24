import { type ReactNode } from 'react'
import { AlertCircle, Inbox, Loader2 } from 'lucide-react'
import { cn, getErrorMessage } from '@/lib/utils'
import { Button } from './button'

interface StateProps {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  icon?: ReactNode
  compact?: boolean
}

function StateShell({ title, description, action, className, icon, compact }: StateProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-2xl border border-dashed bg-card/70 p-6 text-center',
        compact ? 'min-h-[12rem]' : 'min-h-[20rem]',
        className,
      )}
    >
      <div className="mx-auto max-w-md">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
        {action && <div className="mt-5 flex justify-center">{action}</div>}
      </div>
    </div>
  )
}

export function LoadingState({
  title = 'Loading',
  description = 'Please wait while the page catches up.',
  className,
  compact = false,
}: {
  title?: string
  description?: string
  className?: string
  compact?: boolean
}) {
  return (
    <StateShell
      title={title}
      description={description}
      className={className}
      compact={compact}
      icon={<Loader2 size={22} className="animate-spin" />}
    />
  )
}

export function EmptyState({
  title,
  description,
  action,
  className,
  compact = false,
  icon,
}: StateProps) {
  return (
    <StateShell
      title={title}
      description={description}
      action={action}
      className={className}
      compact={compact}
      icon={icon ?? <Inbox size={22} />}
    />
  )
}

export function ErrorState({
  title = 'Something went wrong',
  error,
  description,
  onRetry,
  retryLabel = 'Try again',
  className,
  compact = false,
}: {
  title?: string
  error?: unknown
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  compact?: boolean
}) {
  return (
    <StateShell
      title={title}
      description={description ?? getErrorMessage(error, 'The interface could not load this data.')}
      className={className}
      compact={compact}
      icon={<AlertCircle size={22} />}
      action={onRetry ? <Button variant="outline" onClick={onRetry}>{retryLabel}</Button> : undefined}
    />
  )
}
