import { useParams, Link } from 'react-router-dom'

export function RevealPage() {
  const { id } = useParams()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">揭晓</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          id: <span className="font-mono text-zinc-800 dark:text-zinc-200">{id}</span>
        </p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Reveal 页将展示服务端返回的 soupTruthText 原文；此处为占位。
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex w-fit text-sm font-medium text-violet-600 underline-offset-4 hover:underline dark:text-violet-400"
      >
        返回大厅
      </Link>
    </div>
  )
}
