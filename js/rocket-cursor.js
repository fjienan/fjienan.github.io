/* Rocket Cursor + Exhaust Trail (canvas) for Hexo/Butterfly
 * - Draws a small rocket that rotates based on pointer movement direction
 * - Emits smoke-like particles from the exhaust as the pointer moves
 * - Lightweight, no deps, respects prefers-reduced-motion, disables on coarse pointer
 */

(() => {
  if (window.__ROCKET_CURSOR_INSTALLED__) return
  window.__ROCKET_CURSOR_INSTALLED__ = true

  const CONFIG = {
    enabled: true,
    disableOnCoarsePointer: true,
    zIndex: 10000,
    // Rocket
    rocketScale: 1.0,
    rocketOffset: 0, // px (if you want rocket slightly away from exact pointer)
    angleSmoothing: 0.18, // 0..1 (higher = faster angle response)
    // Exhaust
    maxParticles: 180,
    density: 0.9, // particles per movement distance
    spawnMin: 1,
    spawnMax: 14,
    exhaustOffset: 18, // px behind rocket center
    exhaustSpread: 0.55, // radians
    exhaustSpeed: [0.4, 2.2], // px per frame-ish
    // Particle look
    size: [2.5, 7.5],
    life: [380, 1100], // ms
    // Colors tuned for "smoke + glow"
    smokeColor: 'rgba(210, 220, 230, 0.55)',
    emberColor: 'rgba(255, 136, 136, 0.88)'
  }

  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (!CONFIG.enabled || prefersReducedMotion) return

  if (CONFIG.disableOnCoarsePointer) {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches
    if (coarse) return
  }

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return

  canvas.id = 'rocket-cursor-canvas'
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: String(CONFIG.zIndex)
  })

  const mount = () => {
    if (!document.body) return
    document.body.appendChild(canvas)
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true })
  } else {
    mount()
  }

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(window.innerWidth * dpr)
    canvas.height = Math.floor(window.innerHeight * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  resize()
  window.addEventListener('resize', resize, { passive: true })

  const rand = (min, max) => min + Math.random() * (max - min)
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
  const lerpAngle = (a, b, t) => {
    // shortest-path interpolation
    let d = b - a
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    return a + d * t
  }

  const state = {
    tx: window.innerWidth / 2,
    ty: window.innerHeight / 2,
    lastX: null,
    lastY: null,
    lastT: 0,
    angle: 0,
    angleTarget: 0
  }

  const particles = []

  const spawn = (x, y, angle, dist, dt) => {
    const now = performance.now()
    const moveFactor = clamp(dist * CONFIG.density, 0, CONFIG.spawnMax)
    const speed = dist / Math.max(dt, 1)
    const boost = speed > 0.9 ? 3 : speed > 0.5 ? 1 : 0
    const count = clamp(Math.floor(CONFIG.spawnMin + moveFactor + boost), CONFIG.spawnMin, CONFIG.spawnMax)

    const backAngle = angle + Math.PI
    const spread = CONFIG.exhaustSpread
    const ox = x + Math.cos(backAngle) * CONFIG.exhaustOffset
    const oy = y + Math.sin(backAngle) * CONFIG.exhaustOffset

    for (let i = 0; i < count; i++) {
      if (particles.length >= CONFIG.maxParticles) particles.shift()
      const a = backAngle + rand(-spread, spread)
      const sp = rand(CONFIG.exhaustSpeed[0], CONFIG.exhaustSpeed[1])
      particles.push({
        x: ox + rand(-2, 2),
        y: oy + rand(-2, 2),
        vx: Math.cos(a) * sp + rand(-0.15, 0.15),
        vy: Math.sin(a) * sp + rand(-0.15, 0.15),
        r: rand(CONFIG.size[0], CONFIG.size[1]),
        t0: now,
        life: rand(CONFIG.life[0], CONFIG.life[1]),
        wobble: rand(0.85, 1.25),
        ember: Math.random() < 0.22
      })
    }
  }

  const onMove = (e) => {
    const x = e.clientX
    const y = e.clientY
    const now = performance.now()

    if (state.lastX == null || state.lastY == null) {
      state.lastX = x
      state.lastY = y
      state.lastT = now
      state.tx = x
      state.ty = y
      return
    }

    const dx = x - state.lastX
    const dy = y - state.lastY
    const dist = Math.hypot(dx, dy)
    const dt = now - state.lastT

    // Update pointer target position
    state.tx = x
    state.ty = y

    // Update angle target based on motion vector (ignore tiny jitter)
    if (dist > 0.4) {
      state.angleTarget = Math.atan2(dy, dx)
      spawn(x, y, state.angleTarget, dist, dt)
    }

    state.lastX = x
    state.lastY = y
    state.lastT = now
  }

  window.addEventListener('pointermove', onMove, { passive: true })

  const drawRocket = (x, y, angle) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    ctx.scale(CONFIG.rocketScale, CONFIG.rocketScale)

    // Rocket points to +X direction
    // Body
    ctx.beginPath()
    ctx.moveTo(12, 0)
    ctx.quadraticCurveTo(7, -7, -6, -6)
    ctx.lineTo(-10, -3)
    ctx.lineTo(-10, 3)
    ctx.lineTo(-6, 6)
    ctx.quadraticCurveTo(7, 7, 12, 0)
    ctx.closePath()
    ctx.fillStyle = 'rgba(245, 248, 255, 0.95)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(20, 40, 70, 0.35)'
    ctx.lineWidth = 1.1
    ctx.stroke()

    // Window
    ctx.beginPath()
    ctx.arc(2.5, 0, 2.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 123, 0, 0.9)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Fins
    ctx.beginPath()
    ctx.moveTo(-6, -4.8)
    ctx.lineTo(-12.5, -8.5)
    ctx.lineTo(-11, -2.8)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 120, 140, 0.85)'
    ctx.fill()

    ctx.beginPath()
    ctx.moveTo(-6, 4.8)
    ctx.lineTo(-12.5, 8.5)
    ctx.lineTo(-11, 2.8)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 120, 140, 0.85)'
    ctx.fill()

    // Small nozzle glow
    ctx.beginPath()
    ctx.arc(-10.8, 0, 2.1, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 166, 0, 0.66)'
    ctx.fill()

    ctx.restore()
  }

  const tick = () => {
    const now = performance.now()
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    // Update angle smoothly
    state.angle = lerpAngle(state.angle, state.angleTarget, CONFIG.angleSmoothing)

    // Draw particles (back to front)
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      const age = now - p.t0
      if (age >= p.life) {
        particles.splice(i, 1)
        continue
      }

      const k = 1 - age / p.life
      p.x += p.vx
      p.y += p.vy
      // drift + expand
      p.vx *= 0.985
      p.vy *= 0.985
      p.r += 0.018 * p.wobble

      // smoke looks better with soft blur + fading
      ctx.globalAlpha = Math.max(0, k) * (p.ember ? 0.9 : 0.7)
      ctx.fillStyle = p.ember ? CONFIG.emberColor : CONFIG.smokeColor
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * (0.65 + (1 - k) * 0.9), 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.globalAlpha = 1

    // Draw rocket at pointer (optionally offset along direction)
    const ox = Math.cos(state.angle) * CONFIG.rocketOffset
    const oy = Math.sin(state.angle) * CONFIG.rocketOffset
    drawRocket(state.tx + ox, state.ty + oy, state.angle)

    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)
})()

