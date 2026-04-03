# 游戏大厅（Home）相关开发实现文档

本文档整理 **故事数据**、**GameCard**、**Home 页面**、**React Router** 的实现说明与代码快照。源码位于前端工程目录 **`web/`** 下；若与仓库后续提交不一致，以实际文件为准。

---

## 故事数据（stories.ts）实现

**文件路径：** `web/src/data/stories.ts`

**要点：**

- 与 PRD 3.1 五档难度一致：`简单` → `中等` → `较难` → `难` → `超难`。
- 导出 `STORY_DIFFICULTY_LEVELS`、`StoryDifficulty`、`Story` 接口、`stories` 数组及 `getStoryById`。
- `surface` 为汤面（可在大厅/卡片展示），`bottom` 为汤底（谨防剧透，勿在大厅直接展示）。
- 类型再导出：`web/src/types/story.ts` 可从本文件 re-export，供其他模块 `import type`。

```typescript
/**
 * 静态海龟汤种子数据（演示/联调用）。
 * PRD 3.1：正式环境由系统按梯度实时生成汤面+汤底，无预设库；此处不替代服务端权威。
 */

/** 与 PRD「简单→中等→较难→难→超难」一致 */
export const STORY_DIFFICULTY_LEVELS = [
  '简单',
  '中等',
  '较难',
  '难',
  '超难',
] as const

export type StoryDifficulty = (typeof STORY_DIFFICULTY_LEVELS)[number]

export interface Story {
  id: string
  title: string
  difficulty: StoryDifficulty
  /** 汤面（谜面） */
  surface: string
  /** 汤底（真相）；大厅勿直接展示以防剧透 */
  bottom: string
}

/**
 * 海龟汤故事（5 条，覆盖五档难度）。
 * 导出：`stories`
 */
export const stories: Story[] = [
  {
    id: 'bedside-lamp-switch',
    title: '睡前的三次开关',
    difficulty: '简单',
    surface:
      '卧室里只有一盏灯。他每晚入睡前，一定要把灯开关连续按三次才睡得着，多年如此。',
    bottom:
      '他曾是盲人，做完复明手术后需要逐步适应光线。医生让他用反复开关的方式练习明暗变化，久而久之形成睡前仪式，不做就难以安心入睡。',
  },
  {
    id: 'concert-hall-piano',
    title: '音乐厅的琴声',
    difficulty: '中等',
    surface:
      '这座音乐厅每晚都会准时响起优美的琴声，但观众从未见过演奏者登台。某天夜里，琴声突然再也没有响起。',
    bottom:
      '演奏者是一位盲人钢琴家。去世后，家人将钢琴与定时播放的录音装置留在厅内；直到设备老化损坏，琴声才停止。',
  },
  {
    id: 'elevator-stranger',
    title: '电梯里的陌生人',
    difficulty: '较难',
    surface:
      '我每天坐同一部电梯上班。今天厢里多了一个陌生人，他一直盯着我笑。到了我的楼层，我走出去，他却仍留在电梯里，没有跟上来。',
    bottom:
      '我是入室行窃的小偷，被屋主撞见后躲进电梯假装住户。那个陌生人是屋主，他认出我，却故意等我离开电梯后再报警，以免在密闭空间里起冲突。',
  },
  {
    id: 'snow-prints-alone',
    title: '雪地里的独印',
    difficulty: '难',
    surface:
      '雪停后的荒原上发现一具尸体，周围雪面平整，只有死者自己的脚印环绕，没有任何第二者靠近的痕迹。',
    bottom:
      '死者是登山者，在悬崖边失足坠落；大风将尸体从坡下吹回这片空地。那些脚印是他坠落前在崖边挣扎、徘徊时留下的，并非案发后有人伪造现场。',
  },
  {
    id: 'turtle-soup-restaurant',
    title: '海龟汤',
    difficulty: '超难',
    surface:
      '一个人在餐厅点了一碗海龟汤，只尝了一口就冲出去自杀。他此前从未喝过真正的海龟汤。',
    bottom:
      '他曾在海难中靠同伴熬煮的「肉汤」活下来，一直以为那是海龟汤。尝到正宗海龟汤后发觉味道完全不同，意识到当年喝的可能是同伴的肉汤，精神崩溃而自杀。',
  },
]

export function getStoryById(id: string): Story | undefined {
  return stories.find((s) => s.id === id)
}
```

---

## GameCard 组件开发

**文件路径：** `web/src/components/GameCard.tsx`

**要点：**

- Props：`story: Story`（来自 `../data/stories`）。
- 展示标题、难度标签（五档对应不同 Tailwind 配色）、`surface` 两行截断（`line-clamp-2`）。
- 点击（及键盘 Enter/空格）通过 `useNavigate` 跳转 **`/game/${story.id}`**。
- 使用 `role="button"`、`tabIndex={0}`、`focus-visible` 环，兼顾键盘与焦点可见性。

```tsx
import { useNavigate } from 'react-router-dom'
import type { Story } from '../data/stories'

interface GameCardProps {
  story: Story
}

const DIFFICULTY_STYLES: Record<Story['difficulty'], string> = {
  简单: 'bg-green-500/20 text-green-400',
  中等: 'bg-yellow-500/20 text-yellow-400',
  较难: 'bg-amber-500/20 text-amber-400',
  难: 'bg-orange-500/20 text-orange-400',
  超难: 'bg-red-500/20 text-red-400',
}

export function GameCard({ story }: GameCardProps) {
  const navigate = useNavigate()
  const difficultyColor = DIFFICULTY_STYLES[story.difficulty]

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/game/${story.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/game/${story.id}`)
        }
      }}
      className="group relative cursor-pointer overflow-hidden rounded-lg border border-gray-700 bg-gray-800/80 p-6 transition-all duration-300 hover:scale-[1.02] hover:border-purple-500 hover:bg-gray-800 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xl font-bold text-gray-100 transition-colors group-hover:text-purple-300">
          {story.title}
        </h3>
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${difficultyColor}`}
        >
          {story.difficulty}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-gray-400">{story.surface}</p>
      <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  )
}
```

---

## Home 页面布局

**文件路径：** `web/src/pages/Home.tsx`

**要点：**

- 全屏深色底（`bg-gray-900`），标题「AI 海龟汤」渐变字，副文案引导氛围。
- **玩法介绍**区块：三条说明（怎么玩、AI 回答规则、20 次提问上限），带无障碍标题关联 `aria-labelledby`。
- 底部 **响应式网格**：`1` 列 → `sm:2` 列 → `lg:3` 列，遍历 `stories` 渲染 `GameCard`。

```tsx
import { GameCard } from '../components/GameCard'
import { stories } from '../data/stories'

export function Home() {
  return (
    <div className="min-h-screen bg-gray-900 px-4 py-12 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 text-center">
          <h1 className="mb-4 bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-4xl font-bold text-transparent md:text-5xl">
            AI 海龟汤
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-400">
            揭开迷雾，探寻真相。每一个故事都藏着意想不到的结局，你能推理出背后的秘密吗？
          </p>
        </header>

        <section
          className="mb-12 rounded-xl border border-purple-500/20 bg-gray-800/35 p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-8"
          aria-labelledby="how-to-play-heading"
        >
          <h2
            id="how-to-play-heading"
            className="mb-4 text-center text-lg font-semibold tracking-wide text-purple-300 sm:text-left"
          >
            玩法介绍
          </h2>
          <ul className="mx-auto max-w-3xl space-y-3 text-sm leading-relaxed text-gray-300 sm:text-base">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-mono text-purple-400/90">①</span>
              <span>
                <strong className="text-gray-200">海龟汤怎么玩：</strong>
                先读「汤面」里的谜面，再通过提问一步步还原完整真相。点击下面任意故事卡片进入对局（对局页接入后将显示汤面与对话区）。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-mono text-purple-400/90">②</span>
              <span>
                <strong className="text-gray-200">AI 怎么答：</strong>
                正常提问下，AI 只会回答
                <span className="whitespace-nowrap text-violet-300">「是」</span>、
                <span className="whitespace-nowrap text-violet-300">「否」</span>或
                <span className="whitespace-nowrap text-violet-300">「无关」</span>
                ，不讲故事、不反问、不直接剧透。
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-mono text-purple-400/90">③</span>
              <span>
                <strong className="text-gray-200">提问次数：</strong>
                每局最多 <strong className="text-gray-100">20</strong>{' '}
                次提问；用尽后将进入汤底揭晓。
              </span>
            </li>
          </ul>
        </section>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <GameCard key={story.id} story={story} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

---

## React Router 路由配置

**入口挂载：** `web/src/main.tsx` 使用 `createRoot` 渲染 `<App />`（外层 `StrictMode`）。

**路由声明：** `web/src/App.tsx` 使用 `BrowserRouter` + `Routes` + `Route`。

| 路径 | 组件 | 说明 |
|------|------|------|
| `/` | `Home` | 游戏大厅 |
| `/game/:id` | `Game`（内联占位） | 对局页，`:id` 对应 `story.id` |
| `*` | `NotFoundPage` | 未匹配路径 |

**`main.tsx`：**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**`App.tsx`：**

```tsx
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { NotFoundPage } from './pages/NotFoundPage'

function Game() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 text-gray-100">
      <h1 className="text-2xl">游戏页面开发中...</h1>
    </div>
  )
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/game/:id" element={<Game />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  )
}

export default App
```

---

## 本地运行

在 `web` 目录执行：

```bash
npm install
npm run dev
```

浏览器访问终端输出的 Local 地址（一般为 `http://localhost:5173/`）。
