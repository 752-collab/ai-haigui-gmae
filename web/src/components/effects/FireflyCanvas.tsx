/**
 * PRD「二、核心视觉与氛围基调 · 全局动效」：全屏低亮度、慢漂移、半透明萤火虫/星光。
 * - `pointer-events-none` + `fixed`：铺满视口且不挡文字、不抢点击。
 * - 移动端粒子数减少、dpr 上限 2、`requestAnimationFrame` 单循环：兼顾流畅与耗电。
 * - `prefers-reduced-motion`：系统开启「减少动效」时自动降级为静态渐变。
 *
 * 常见问题：若大厅/对局看不到萤火虫，几乎都是因为路由根组件未渲染本组件（历史上 Home 仅有静态渐变底）。
 * 正确用法：在 `App.tsx` 中对全部页面统一挂载 `<FireflyCanvas />`，页面内容放在 `relative z-10` 的容器内。
 */
import { useEffect, useRef, useState } from 'react'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  phase: number
}

function makeParticles(w: number, h: number, count: number): Particle[] {
  const list: Particle[] = []
  for (let i = 0; i < count; i++) {
    list.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.8 + 0.6,
      phase: Math.random() * Math.PI * 2,
    })
  }
  return list
}

type FireflyCanvasProps = {
  className?: string
  /** 关闭动效时仅渲染暗色底，不占 CPU */
  enabled?: boolean
}

export function FireflyCanvas({
  className = '',
  enabled = true,
}: FireflyCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const dprRef = useRef(1)

  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (!enabled || reducedMotion) return

    const canvas = ref.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frame = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2)
      dprRef.current = dpr
      const w = window.innerWidth
      const h = window.innerHeight
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const count = w < 640 ? 28 : 52
      particlesRef.current = makeParticles(w, h, count)
    }

    const tick = () => {
      frame = requestAnimationFrame(tick)
      const dpr = dprRef.current
      const w = window.innerWidth
      const h = window.innerHeight
      const parts = particlesRef.current

      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, w, h)

      const g = ctx.createRadialGradient(
        w * 0.5,
        h * 0.35,
        0,
        w * 0.5,
        h * 0.35,
        Math.max(w, h) * 0.55,
      )
      g.addColorStop(0, 'rgba(139, 92, 246, 0.14)')
      g.addColorStop(1, 'rgba(10, 14, 26, 0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)

      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < -4) p.x = w + 4
        if (p.x > w + 4) p.x = -4
        if (p.y < -4) p.y = h + 4
        if (p.y > h + 4) p.y = -4

        p.phase += 0.02
        const twinkle = 0.45 + Math.sin(p.phase) * 0.25
        ctx.beginPath()
        ctx.fillStyle = `rgba(228, 238, 255, ${twinkle * 0.62})`
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    resize()
    window.addEventListener('resize', resize)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [enabled, reducedMotion])

  if (!enabled) {
    return (
      <div
        className={`pointer-events-none fixed inset-0 bg-[#070b14] ${className}`}
        aria-hidden
      />
    )
  }

  if (reducedMotion) {
    return (
      <div
        className={`pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0c1224] via-[#070b14] to-[#05070f] ${className}`}
        aria-hidden
      />
    )
  }

  return (
    <canvas
      ref={ref}
      className={`pointer-events-none fixed inset-0 bg-[#070b14] ${className}`}
      aria-hidden
    />
  )
}
