"use client";

import React, { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
}

export default function ParticleBackground({ intense = false }: { intense?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const mouse = { x: width / 2, y: height / 2, active: false };
    const count = intense
      ? Math.min(150, Math.floor((width * height) / 9500))
      : Math.min(85, Math.floor((width * height) / 16000));

    const colors = intense
      ? ["#ffffff", "#c7d2fe", "#93c5fd", "#e0e7ff", "#a5b4fc"]
      : ["#5865f2", "#3b82f6", "#818cf8", "#94a3b8"];

    const particles: Particle[] = Array.from({ length: count }, () => {
      const x = Math.random() * width;
      const y = Math.random() * height;
      return {
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * (intense ? 1.1 : 0.5),
        vy: (Math.random() - 0.5) * (intense ? 1.1 : 0.5),
        radius: intense ? Math.random() * 3.2 + 1.6 : Math.random() * 2.2 + 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: intense ? Math.random() * 0.55 + 0.35 : Math.random() * 0.3 + 0.15,
      };
    });

    const onResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const onMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };

    const onMouseLeave = () => {
      mouse.active = false;
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Mouse glow halo in intense mode
      if (intense && mouse.active) {
        const grad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 240);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.22)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 240, 0, Math.PI * 2);
        ctx.fill();
      }

      const attractRadius = intense ? 250 : 170;
      const linkRadius = intense ? 145 : 115;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (mouse.active) {
          const dx = mouse.x - p.x;
          const dy = mouse.y - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist < attractRadius && dist > 1) {
            const force = (attractRadius - dist) / attractRadius;
            // Orbital swirl + attraction like Google Antigravity
            const angle = Math.atan2(dy, dx);
            p.vx += Math.cos(angle) * force * (intense ? 0.22 : 0.06);
            p.vy += Math.sin(angle) * force * (intense ? 0.22 : 0.06);
            if (intense) {
              p.vx += -Math.sin(angle) * force * 0.14;
              p.vy += Math.cos(angle) * force * 0.14;
            }
          }
        }

        p.vx *= intense ? 0.96 : 0.985;
        p.vy *= intense ? 0.96 : 0.985;

        if (Math.hypot(p.vx, p.vy) < (intense ? 0.35 : 0.12)) {
          p.vx += (Math.random() - 0.5) * (intense ? 0.18 : 0.04);
          p.vy += (Math.random() - 0.5) * (intense ? 0.18 : 0.04);
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < linkRadius) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = intense
              ? `rgba(255, 255, 255, ${0.32 * (1 - d / linkRadius)})`
              : `rgba(88, 101, 242, ${0.14 * (1 - d / linkRadius)})`;
            ctx.lineWidth = intense ? 1.1 : 0.8;
            ctx.stroke();
          }
        }

        if (mouse.active) {
          const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
          if (dm < attractRadius) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.strokeStyle = intense
              ? `rgba(255, 255, 255, ${0.42 * (1 - dm / attractRadius)})`
              : `rgba(88, 101, 242, ${0.24 * (1 - dm / attractRadius)})`;
            ctx.lineWidth = intense ? 1.2 : 0.9;
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [intense]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
