import { FireflyCanvas } from '../components/effects/FireflyCanvas'
import { GameCard } from '../components/GameCard'
import { stories, type TurtleStory } from '../data/stories'

export function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-950/80 via-gray-950/75 to-slate-950/80 px-4 py-12 text-slate-100 sm:px-6 lg:px-8">
      <FireflyCanvas />
      <div className="animate-page-fade-in relative z-10 mx-auto max-w-6xl">
        <header className="mb-12 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-violet-300 via-purple-400 to-indigo-400 bg-clip-text text-4xl font-bold tracking-tight text-transparent md:text-5xl">
            AI海龟汤
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
            雾气之后，只剩提问与回音。择一案而入，在寂静里逼近那个唯一的真相。
          </p>
        </header>

        <section
          className="mb-12 rounded-xl border border-violet-500/20 bg-slate-900/50 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04),0_0_40px_-12px_rgba(109,40,217,0.15)] sm:p-8"
          aria-labelledby="how-to-play-heading"
        >
          <h2
            id="how-to-play-heading"
            className="mb-4 text-center text-lg font-semibold tracking-wide text-violet-300/95 sm:text-left"
          >
            玩法介绍
          </h2>
          <ul className="mx-auto max-w-3xl space-y-3 text-sm leading-relaxed text-slate-300 sm:text-base">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-violet-400/90">①</span>
              <span>
                <strong className="text-slate-200">海龟汤怎么玩：</strong>
                阅读「汤面」谜面，用提问还原全貌；点击下方卡片进入对局。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-violet-400/90">②</span>
              <span>
                <strong className="text-slate-200">AI 怎么答：</strong>
                仅回答
                <span className="whitespace-nowrap text-violet-300">「是」</span>、
                <span className="whitespace-nowrap text-violet-300">「否」</span>或
                <span className="whitespace-nowrap text-violet-300">「无关」</span>
                ，不展开、不剧透。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-violet-400/90">③</span>
              <span>
                <strong className="text-slate-200">提问次数：</strong>
                每局最多 <strong className="text-slate-100">20</strong> 次提问，用尽后揭晓汤底。
              </span>
            </li>
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-6">
          {stories.map((story: TurtleStory) => (
            <GameCard key={story.id} story={story} />
          ))}
        </div>
      </div>
    </div>
  )
}
