type LoadingOverlayProps = {
  /** 读屏标签 */
  label?: string
  /** fullscreen：整页；contained：填满父级（父级需 position: relative） */
  variant?: 'fullscreen' | 'contained'
  className?: string
}

export function LoadingOverlay({
  label = '加载中…',
  variant = 'fullscreen',
  className = '',
}: LoadingOverlayProps) {
  const position =
    variant === 'fullscreen'
      ? 'fixed inset-0'
      : 'absolute inset-0 rounded-[inherit]'

  return (
    <div
      className={`z-30 flex flex-col items-center justify-center gap-3 bg-slate-950/50 backdrop-blur-[2px] ${position} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-violet-500/25 border-t-violet-400"
        aria-hidden
      />
      <p className="max-w-[14rem] px-2 text-center text-sm text-slate-300">
        {label}
      </p>
    </div>
  )
}
