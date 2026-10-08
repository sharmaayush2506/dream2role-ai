import { useEffect, useRef } from "react";

/**
 * A very subtle animated "career network" drawn on a canvas behind the page:
 * nodes linked to their nearest neighbours, nodes that slowly pulse, and tiny dots
 * travelling along the links. The network shifts with the cursor (parallax), nearby
 * nodes drift away from it, and links near it glow a little brighter.
 */

interface Node {
  bx: number; // base position (0..1 of the viewport)
  by: number;
  depth: number; // 0.4..1, how strongly it follows the cursor
  r: number;
  phase: number; // pulse offset
  ox: number; // current push away from the cursor (px)
  oy: number;
  x: number; // rendered position (px)
  y: number;
}

interface Edge {
  a: number;
  b: number;
  t: number; // travelling dot progress 0..1
  speed: number;
  dir: 1 | -1;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return Number.isNaN(n) ? [22, 163, 74] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Deterministic pseudo-random numbers, so the layout is stable between visits. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function buildNetwork(width: number, height: number) {
  const rand = rng(20251008);
  const count = Math.max(14, Math.min(46, Math.round((width * height) / 34000)));
  const nodes: Node[] = Array.from({ length: count }, () => ({
    bx: 0.03 + rand() * 0.94,
    by: 0.03 + rand() * 0.94,
    depth: 0.4 + rand() * 0.6,
    r: 1.6 + rand() * 1.8,
    phase: rand() * Math.PI * 2,
    ox: 0,
    oy: 0,
    x: 0,
    y: 0,
  }));

  // Link each node to its two nearest neighbours: gives the organic, roadmap-like branching.
  const edges: Edge[] = [];
  const seen = new Set<string>();
  nodes.forEach((n, i) => {
    const nearest = nodes
      .map((m, j) => ({ j, d: (m.bx - n.bx) ** 2 * width * width + (m.by - n.by) ** 2 * height * height }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, 2);
    for (const { j } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: i, b: j, t: rand(), speed: 0.0012 + rand() * 0.0022, dir: rand() > 0.5 ? 1 : -1 });
    }
  });
  return { nodes, edges };
}

export default function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let net = buildNetwork(1, 1);
    let color: [number, number, number] = [22, 163, 74];
    let dark = false;
    // Cursor position, smoothed, plus whether it's on the page.
    const mouse = { x: -9999, y: -9999, sx: 0, sy: 0, active: false };

    const readTheme = () => {
      const styles = getComputedStyle(document.documentElement);
      color = hexToRgb(styles.getPropertyValue("--primary") || "#16a34a");
      dark = styles.getPropertyValue("color-scheme").trim() === "dark";
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      net = buildNetwork(width, height);
      mouse.sx = width / 2;
      mouse.sy = height / 2;
    };

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => (mouse.active = false);

    let frame = 0;
    let raf = 0;
    const draw = (time: number) => {
      const t = time / 1000;
      if (frame++ % 90 === 0) readTheme();
      const [r, g, b] = color;
      const base = dark ? 1.2 : 1; // links need a touch more contrast on dark backgrounds
      ctx.clearRect(0, 0, width, height);

      // Ease the cursor so the parallax glides rather than snaps.
      const targetX = mouse.active ? mouse.x : width / 2;
      const targetY = mouse.active ? mouse.y : height / 2;
      mouse.sx += (targetX - mouse.sx) * 0.06;
      mouse.sy += (targetY - mouse.sy) * 0.06;
      const px = (mouse.sx - width / 2) / width; // -0.5..0.5
      const py = (mouse.sy - height / 2) / height;

      for (const n of net.nodes) {
        // Slow idle drift + parallax opposite to the cursor (deeper nodes move more).
        const driftX = reduceMotion ? 0 : Math.sin(t * 0.15 + n.phase) * 6;
        const driftY = reduceMotion ? 0 : Math.cos(t * 0.12 + n.phase) * 6;
        const x0 = n.bx * width + driftX - px * 46 * n.depth;
        const y0 = n.by * height + driftY - py * 46 * n.depth;

        // Gently push away from a nearby cursor, then relax back.
        let tx = 0;
        let ty = 0;
        if (mouse.active) {
          const dx = x0 - mouse.x;
          const dy = y0 - mouse.y;
          const d = Math.hypot(dx, dy);
          if (d < 150 && d > 0.1) {
            const f = (1 - d / 150) * 26;
            tx = (dx / d) * f;
            ty = (dy / d) * f;
          }
        }
        n.ox += (tx - n.ox) * 0.08;
        n.oy += (ty - n.oy) * 0.08;
        n.x = x0 + n.ox;
        n.y = y0 + n.oy;
      }

      // Brightness boost for things near the cursor.
      const near = (x: number, y: number) =>
        mouse.active ? Math.max(0, 1 - Math.hypot(x - mouse.x, y - mouse.y) / 220) : 0;

      ctx.lineWidth = 1;
      for (const e of net.edges) {
        const a = net.nodes[e.a];
        const c = net.nodes[e.b];
        const glow = near((a.x + c.x) / 2, (a.y + c.y) / 2);
        ctx.strokeStyle = `rgba(${r},${g},${b},${(0.09 + glow * 0.14) * base})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();

        // Tiny dot travelling along the link.
        if (!reduceMotion) e.t = (e.t + e.speed * e.dir + 1) % 1;
        const dx = a.x + (c.x - a.x) * e.t;
        const dy = a.y + (c.y - a.y) * e.t;
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.4 + glow * 0.3) * base})`;
        ctx.beginPath();
        ctx.arc(dx, dy, 1.4, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const n of net.nodes) {
        const pulse = reduceMotion ? 0.5 : (Math.sin(t * 1.1 + n.phase) + 1) / 2; // 0..1
        const glow = near(n.x, n.y);
        // Soft halo that breathes.
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.05 + pulse * 0.07 + glow * 0.12) * base})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 3 + pulse * 4 + glow * 4, 0, Math.PI * 2);
        ctx.fill();
        // Node core.
        ctx.fillStyle = `rgba(${r},${g},${b},${(0.32 + glow * 0.28) * base})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    readTheme();
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="network-bg" aria-hidden="true" />;
}
