'use client';

import { useEffect, useRef } from 'react';

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/**
 * A wide silk ribbon crossing the top-right of the hero on a diagonal.
 * Domain-warped noise bends the ribbon and draws soft folds; colour runs
 * along it in the brand order (indigo, violet, coral, amber). The output
 * is premultiplied alpha, so the page background shows through.
 */
const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
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

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  bool wide = aspect > 1.2;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = u_time;

  // Ribbon space: x runs along the ribbon, y across it. Wide screens get a
  // steep sweep down the right half; narrow ones a band across the top.
  vec2 center = wide ? vec2(aspect * 0.80, 0.56) : vec2(aspect * 0.9, 1.0);
  float a = wide ? -0.95 : -0.42;
  vec2 r = mat2(cos(a), -sin(a), sin(a), cos(a)) * (p - center);

  float warp = fbm(r * 1.1 + vec2(t * 0.04, -t * 0.025));
  float bend = 0.18 * sin(r.x * 1.4 + t * 0.10) + 0.20 * (warp - 0.5);
  float d = r.y - bend;

  // Main ribbon: crisp edge, rounded body (darker toward the edges).
  float width = (wide ? 0.25 : 0.2) + 0.05 * sin(r.x * 1.2 - t * 0.07);
  float body = smoothstep(width, width - 0.035, abs(d));
  float across = clamp(abs(d) / width, 0.0, 1.0);

  // Companion strand along the inner side for depth.
  float d2 = r.y - bend * 1.4 - width - 0.09;
  float strand = 0.8 * smoothstep(0.055, 0.035, abs(d2));

  // Silk folds drifting across the ribbon, with a soft highlight.
  float folds = 0.5 + 0.5 * sin(d * 21.0 + warp * 8.0 + r.x * 2.0 + t * 0.15);
  float sheen = pow(folds, 8.0) * 0.6;

  float s = 0.48 + r.x * 0.38 + 0.22 * (warp - 0.5);
  vec3 col = palette(s);
  col *= 1.0 - 0.28 * across * across;                 // rounded body
  col = mix(col, col * 0.8, (1.0 - folds) * 0.3);      // fold shadows
  col = mix(col, vec3(1.0, 0.96, 0.92), sheen);        // fold highlights
  vec3 strandCol = palette(s + 0.12) * 1.05;

  float mask = body;
  col = mix(strandCol, col, body);
  mask = max(body, strand);

  // Keep the headline area clear on wide screens.
  float fade = wide ? smoothstep(0.30, 0.52, uv.x) : smoothstep(0.55, 0.9, uv.y);
  mask *= fade * u_alpha;
  gl_FragColor = vec4(col * mask, mask);
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

/**
 * Slow-moving brand ribbon behind the hero. Renders at reduced resolution,
 * pauses off screen and in background tabs, and draws one still frame
 * under reduced motion. Without WebGL the CSS fallback underneath shows.
 */
export function SilkBackground({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false });
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
    const uAlpha = gl.getUniformLocation(prog, 'u_alpha');

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const scale = 0.5; // soft gradients don't need full resolution
    let raf = 0;
    let visible = true;
    const start = performance.now() - 40_000; // start mid-motion, not at t = 0

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * scale));
      const h = Math.max(1, Math.round(canvas.clientHeight * scale));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uAlpha, canvas.clientWidth < 1024 ? 0.45 : 1.0);
    };
    const frame = (now: number) => {
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
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden [&:has(canvas[data-ready])>div]:hidden ${className}`}>
      {/* Fallback for no WebGL: a static wash in the same colours. */}
      <div className="absolute -right-[10%] -top-[30%] h-[120%] w-[70%] rotate-[-28deg] rounded-full bg-[linear-gradient(100deg,var(--ribbon-1),var(--ribbon-2)_35%,var(--ribbon-3)_70%,var(--ribbon-4))] opacity-25 blur-3xl" />
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
