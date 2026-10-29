'use client';

import { useEffect, useRef } from 'react';

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/**
 * Five thin silk sheets fanned across the top-right of the hero. Each sheet
 * has a crisp, pixel-sized edge, a light-to-shadow gradient across its
 * width (so it reads as a curved surface), fine fibres running along its
 * length and a soft highlight near one edge. Sheets cross each other at
 * slightly different phases, which gives the folded, layered depth.
 * Output is premultiplied alpha over the page background.
 */
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform float u_px;
uniform float u_alpha;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
  return v;
}

vec3 palette(float s) {
  vec3 indigo = vec3(0.310, 0.275, 0.898);
  vec3 violet = vec3(0.545, 0.361, 0.965);
  vec3 coral  = vec3(1.000, 0.420, 0.353);
  vec3 amber  = vec3(1.000, 0.690, 0.125);
  s = clamp(s, 0.0, 1.0);
  if (s < 0.33) return mix(indigo, violet, s / 0.33);
  if (s < 0.70) return mix(violet, coral, (s - 0.33) / 0.37);
  return mix(coral, amber, (s - 0.70) / 0.30);
}

vec4 sheet(vec2 r, float i, float warp, float t) {
  float off = (i - 2.0) * 0.074;
  float bend = 0.17 * sin(r.x * 1.25 + t * 0.07 + i * 0.32) + 0.18 * (warp - 0.5);
  float d = r.y - bend - off - 0.025 * sin(r.x * 2.8 + i * 1.7 + t * 0.045);
  float w = 0.084 + 0.02 * sin(r.x * 1.6 + i * 1.3 - t * 0.03);
  float a = 0.94 * smoothstep(w, w - u_px * 1.6, abs(d));
  float u = clamp(d / w, -1.0, 1.0);
  // Curved surface: lit toward one edge, shadowed toward the other.
  float shade = 0.90 + 0.24 * smoothstep(-1.0, 1.0, u) - 0.10 * u * u;
  // Fine fibres along the sheet.
  float fibre = 1.0 - 0.06 * (0.5 + 0.5 * sin(u * 150.0 + warp * 26.0 + i * 11.0));
  float s = 0.44 + r.x * 0.36 + i * 0.05 + 0.2 * (warp - 0.5);
  vec3 col = mix(palette(s), vec3(1.0), 0.10) * shade * fibre;
  // Soft highlight running near the lit edge.
  col = mix(col, vec3(1.0, 0.97, 0.94), 0.38 * smoothstep(0.5, 0.88, u) * smoothstep(1.0, 0.9, u));
  return vec4(col, a);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  bool wide = aspect > 1.2;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  vec2 center = wide ? vec2(aspect * 0.84, 0.52) : vec2(aspect * 0.92, 0.98);
  float ang = wide ? -0.92 : -0.42;
  vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * (p - center);
  float warp = fbm(r * 1.05 + vec2(t * 0.03, -t * 0.02));

  // Composite back to front (premultiplied).
  vec3 acc = vec3(0.0);
  float alpha = 0.0;
  for (int k = 0; k < 5; k++) {
    vec4 s = sheet(r, float(k), warp, t);
    acc = s.rgb * s.a + acc * (1.0 - s.a);
    alpha = s.a + alpha * (1.0 - s.a);
  }

  // Keep the headline clear: fade in from the left (wide) or the top band (narrow).
  float fade = wide ? smoothstep(0.36, 0.56, uv.x) : smoothstep(0.55, 0.9, uv.y);
  // Leave the navbar band clear so its links stay readable.
  if (wide) fade *= 1.0 - 0.9 * smoothstep(0.86, 0.95, uv.y);
  fade *= u_alpha;
  gl_FragColor = vec4(acc * fade, alpha * fade);
}
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

const FRAME_MS = 33; // the motion is very slow; ~30fps is plenty

/**
 * Brand silk behind the top of the landing page only. Rendered at device
 * resolution so edges and fibres stay crisp, capped at ~30fps, paused when
 * the hero is off screen or the tab is hidden, and a single still frame
 * under reduced motion. Without WebGL a soft CSS wash shows instead.
 */
export function HeroRibbon({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: true });
    if (!gl) return;
    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uPx = gl.getUniformLocation(prog, 'u_px');
    const uAlpha = gl.getUniformLocation(prog, 'u_alpha');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = 0;
    let visible = true;
    const start = performance.now() - 40_000;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uPx, 1 / h);
      gl.uniform1f(uAlpha, canvas.clientWidth < 1024 ? 0.5 : 1.0);
    };
    const frame = (now: number) => {
      if (!reduce && now - last < FRAME_MS) {
        raf = requestAnimationFrame(frame);
        return;
      }
      last = now;
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const resume = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    };

    const ro = new ResizeObserver(() => {
      resize();
      if (reduce) frame(performance.now());
    });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !reduce) resume();
    });
    io.observe(canvas);
    const onVisibility = () => {
      if (!document.hidden && !reduce) resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    resize();
    canvas.dataset.ready = 'true';
    resume();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden [&:has(canvas[data-ready])>div]:hidden ${className}`}
    >
      <div className="absolute -right-[10%] -top-[30%] h-[120%] w-[70%] rotate-[-28deg] rounded-full bg-[linear-gradient(100deg,var(--ribbon-1),var(--ribbon-2)_35%,var(--ribbon-3)_70%,var(--ribbon-4))] opacity-25 blur-3xl" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
