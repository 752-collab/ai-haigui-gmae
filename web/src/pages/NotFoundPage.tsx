import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="animate-page-fade-in flex min-h-[100dvh] flex-col justify-center gap-4 overflow-x-hidden px-4 py-10 text-slate-100">
      <h1 className="text-xl font-semibold tracking-tight text-violet-100 sm:text-2xl">
        未找到页面
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-slate-400">
        地址可能有误，或该页面尚未开放。请返回大厅继续游戏。
      </p>
      <Link
        to="/"
        className="active-press inline-flex min-h-[48px] w-fit items-center rounded-xl border border-violet-500/45 bg-violet-950/50 px-5 text-sm font-medium text-violet-100 transition hover:bg-violet-900/45"
      >
        返回大厅
      </Link>
    </div>
  )
}
