import { Link } from 'react-router-dom'
import type { TurtleStory } from '../data/stories'

export type GameCardProps = {
  story: TurtleStory
}

const DIFFICULTY_STYLES: Record<TurtleStory['difficulty'], string> = {
  简单: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  中等: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300',
  较难: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  难: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  超难: 'border-red-500/40 bg-red-500/15 text-red-300',
}

export function GameCard({ story }: GameCardProps) {
  return (
    <Link
      to={`/game/${story.id}`}
      state={{ fromLobby: true }}
      className="active-press group block min-h-[52px] rounded-xl border border-slate-800/90 bg-slate-950/75 p-5 shadow-sm backdrop-blur-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-violet-500/45 hover:bg-slate-950/90 hover:shadow-[0_12px_40px_-8px_rgba(109,40,217,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <h3 className="break-words text-base font-semibold tracking-tight text-slate-100 transition group-hover:text-violet-200 sm:text-lg">
          {story.title}
        </h3>
        <span
          className={`inline-flex w-fit shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${DIFFICULTY_STYLES[story.difficulty]}`}
        >
          {story.difficulty}
        </span>
      </div>
    </Link>
  )
}
