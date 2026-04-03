import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { FireflyCanvas } from './components/effects/FireflyCanvas'
import { Game } from './pages/Game'
import { Home } from './pages/Home'
import { NotFoundPage } from './pages/NotFoundPage'
import { ResultPage } from './pages/ResultPage'

function App() {
  return (
    <Router>
      {/*
        PRD 全端统一萤火虫背景：挂在 Router 内、Routes 外，保证所有路由共用一层动效。
        之前只有 Home/Game 的 Tailwind 渐变，未挂载本组件，故大厅看不到萤火虫。
      */}
      <FireflyCanvas className="z-0" />
      <div className="relative z-10 min-h-[100dvh] overflow-x-hidden">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:id" element={<Game />} />
          <Route path="/result/:id" element={<ResultPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
