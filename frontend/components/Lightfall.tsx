"use client";

import { useEffect, useMemo, useRef } from "react";
import { Renderer, Program, Mesh, Triangle } from "ogl";

const MAX_COLORS = 8;
const MAX_STEPS = 39;

// Quality only ever steps down, never back up, so it cannot oscillate.
// Pixel density goes first because it is the cheapest win, then ray-march steps.
const DPR_LADDER = [1.5, 1.25, 1, 0.75];
const STEP_LADDER = [MAX_STEPS, 28, 20];
const SLOW_FRAME_MS = 22; // below ~45fps
const QUALITY_WINDOW_MS = 1000;
const SPIKE_FRAME_MS = 250; // tab switches and GC pauses are not a quality signal

type Vec3 = [number, number, number];
type U<T> = { value: T };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const hexToRGB = (hex: string): Vec3 => {
  const c = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const prepColors = (input: string[]) => {
  const base = (input && input.length ? input : ["#34E0A1", "#0FA968", "#F5B301"]).slice(0, MAX_COLORS);
  const count = base.length;
  const arr: Vec3[] = [];
  for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(base[Math.min(i, base.length - 1)]));
  const avg: Vec3 = [0, 0, 0];
  for (let i = 0; i < count; i++) {
    avg[0] += arr[i][0];
    avg[1] += arr[i][1];
    avg[2] += arr[i][2];
  }
  avg[0] /= count;
  avg[1] /= count;
  avg[2] /= count;
  return { arr, count, avg };
};

const vertex = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `
precision highp float;

uniform vec3  iResolution;
uniform vec2  iMouse;
uniform float iTime;

uniform vec3  uColor0;
uniform vec3  uColor1;
uniform vec3  uColor2;
uniform vec3  uColor3;
uniform vec3  uColor4;
uniform vec3  uColor5;
uniform vec3  uColor6;
uniform vec3  uColor7;
uniform int   uColorCount;

uniform vec3  uBgColor;
uniform vec3  uMouseColor;
uniform float uSpeed;
uniform int   uStreakCount;
uniform float uStreakWidth;
uniform float uStreakLength;
uniform float uGlow;
uniform float uDensity;
uniform float uTwinkle;
uniform float uZoom;
uniform float uBgGlow;
uniform float uOpacity;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform int   uSteps;

varying vec2 vUv;

vec3 palette(float h) {
  int count = uColorCount;
  if (count < 1) count = 1;
  int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
  if (idx <= 0) return uColor0;
  if (idx == 1) return uColor1;
  if (idx == 2) return uColor2;
  if (idx == 3) return uColor3;
  if (idx == 4) return uColor4;
  if (idx == 5) return uColor5;
  if (idx == 6) return uColor6;
  return uColor7;
}

vec3 tanhv(vec3 x) {
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

vec2 sceneC(vec2 frag, vec2 r) {
  vec2 P = (frag + frag - r) / r.x;
  float z = 0.0;
  float d = 1e3;
  vec4 O = vec4(0.0);
  for (int k = 0; k < 39; k++) {
    if (k >= uSteps) break;
    if (d <= 1e-4) break;
    O = z * normalize(vec4(P, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
    d = 1.0 - sqrt(length(O * O));
    z += d;
  }
  return vec2(O.x, atan(O.z, O.y));
}

void mainImage(out vec4 o, vec2 C) {
  vec2 r = iResolution.xy;
  vec2 uv0 = (C + C - r) / r.x;
  float T = 0.1 * iTime * uSpeed + 9.0;
  float angRings = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
  vec2 Y = vec2(5e-3, 6.28318530718 / angRings);

  vec2 c0 = sceneC(C, r);
  vec2 cdx = sceneC(C + vec2(1.0, 0.0), r);
  vec2 cdy = sceneC(C + vec2(0.0, 1.0), r);
  vec2 dCx = cdx - c0;
  vec2 dCy = cdy - c0;
  dCx.y -= 6.28318530718 * floor(dCx.y / 6.28318530718 + 0.5);
  dCy.y -= 6.28318530718 * floor(dCy.y / 6.28318530718 + 0.5);
  vec2 fw = abs(dCx) + abs(dCy);
  C = c0;

  vec2 P = vec2(2.0, 1.0) * uv0 - (r / r.x) * vec2(0.0, 1.0);
  vec4 O = vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(P, P) + 6.0), 0.0);

  float mGlow = 0.0;
  if (uMouseEnabled > 0.5) {
    vec2 mN = (iMouse + iMouse - r) / r.x;
    float md = length(uv0 - mN);
    mGlow = exp(-md * md / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
    O.rgb += uMouseColor * mGlow * 0.25;
  }

  float zr = 5e-4 * uStreakWidth;
  vec2 rr = vec2(max(length(fw), 1e-5));
  float tail = 19.0 / max(uStreakLength, 0.05);

  for (int m = 0; m < 16; m++) {
    if (m >= uStreakCount) break;
    float jf = float(m) + 1.0;
    float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
    vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
    Pp -= floor(Pp / Y + 0.5) * Y;
    float h = fract(8663.0 * ic);
    vec3 col = palette(h);
    float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
    weight *= (1.0 + mGlow * 2.0);
    vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
    vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
    O.rgb += dot(sm, vec2(exp(tail * Pp.y), 3.0)) * col * weight;
    C.x += Y.x / 8.0;
  }

  vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
  o = vec4(colr, uOpacity);
}

void main() {
  vec4 color;
  mainImage(color, vUv * iResolution.xy);
  gl_FragColor = color;
}
`;

export type LightfallProps = {
  className?: string;
  /** Starting pixel density. Adaptive quality only ever lowers it from here. */
  dpr?: number;
  paused?: boolean;
  colors?: string[];
  backgroundColor?: string;
  speed?: number;
  streakCount?: number;
  streakWidth?: number;
  streakLength?: number;
  glow?: number;
  density?: number;
  twinkle?: number;
  zoom?: number;
  backgroundGlow?: number;
  opacity?: number;
  mouseInteraction?: boolean;
  mouseStrength?: number;
  mouseRadius?: number;
  mouseDampening?: number;
  mixBlendMode?: string;
  /** Ray-march steps per sample (4-39). Lowered automatically on slow devices. */
  steps?: number;
  /** Drop pixel density, then ray-march steps, if frames stay slow for a second. */
  adaptiveQuality?: boolean;
  /** Frame cap. The clock is time-based, so a lower cap slows nothing down. */
  maxFps?: number;
};

type Settings = {
  dpr?: number;
  paused: boolean;
  colors: string[];
  backgroundColor: string;
  speed: number;
  streakCount: number;
  streakWidth: number;
  streakLength: number;
  glow: number;
  density: number;
  twinkle: number;
  zoom: number;
  backgroundGlow: number;
  opacity: number;
  mouseInteraction: boolean;
  mouseStrength: number;
  mouseRadius: number;
  mouseDampening: number;
  steps: number;
  adaptiveQuality: boolean;
  maxFps: number;
};

type LightfallUniforms = {
  iResolution: U<Vec3>;
  iMouse: U<[number, number]>;
  iTime: U<number>;
  uColor0: U<Vec3>;
  uColor1: U<Vec3>;
  uColor2: U<Vec3>;
  uColor3: U<Vec3>;
  uColor4: U<Vec3>;
  uColor5: U<Vec3>;
  uColor6: U<Vec3>;
  uColor7: U<Vec3>;
  uColorCount: U<number>;
  uBgColor: U<Vec3>;
  uMouseColor: U<Vec3>;
  uSpeed: U<number>;
  uStreakCount: U<number>;
  uStreakWidth: U<number>;
  uStreakLength: U<number>;
  uGlow: U<number>;
  uDensity: U<number>;
  uTwinkle: U<number>;
  uZoom: U<number>;
  uBgGlow: U<number>;
  uOpacity: U<number>;
  uMouseEnabled: U<number>;
  uMouseStrength: U<number>;
  uMouseRadius: U<number>;
  uSteps: U<number>;
};

const writeSettings = (u: LightfallUniforms, s: Settings, stepCap: number) => {
  const { arr, count, avg } = prepColors(s.colors);
  u.uColor0.value = arr[0];
  u.uColor1.value = arr[1];
  u.uColor2.value = arr[2];
  u.uColor3.value = arr[3];
  u.uColor4.value = arr[4];
  u.uColor5.value = arr[5];
  u.uColor6.value = arr[6];
  u.uColor7.value = arr[7];
  u.uColorCount.value = count;
  u.uBgColor.value = hexToRGB(s.backgroundColor);
  u.uMouseColor.value = avg;
  u.uSpeed.value = s.speed;
  u.uStreakCount.value = clamp(Math.round(s.streakCount), 1, 16);
  u.uStreakWidth.value = s.streakWidth;
  u.uStreakLength.value = s.streakLength;
  u.uGlow.value = s.glow;
  u.uDensity.value = s.density;
  u.uTwinkle.value = s.twinkle;
  u.uZoom.value = s.zoom;
  u.uBgGlow.value = s.backgroundGlow;
  u.uOpacity.value = s.opacity;
  u.uMouseEnabled.value = s.mouseInteraction ? 1 : 0;
  u.uMouseStrength.value = s.mouseStrength;
  u.uMouseRadius.value = s.mouseRadius;
  u.uSteps.value = clamp(Math.round(Math.min(s.steps, stepCap)), 4, MAX_STEPS);
};

const buildUniforms = (s: Settings, w: number, h: number): LightfallUniforms => {
  const zero: Vec3 = [0, 0, 0];
  const u: LightfallUniforms = {
    iResolution: { value: [w, h, 1] },
    iMouse: { value: [0, 0] },
    iTime: { value: 0 },
    uColor0: { value: zero },
    uColor1: { value: zero },
    uColor2: { value: zero },
    uColor3: { value: zero },
    uColor4: { value: zero },
    uColor5: { value: zero },
    uColor6: { value: zero },
    uColor7: { value: zero },
    uColorCount: { value: 1 },
    uBgColor: { value: zero },
    uMouseColor: { value: zero },
    uSpeed: { value: 0 },
    uStreakCount: { value: 1 },
    uStreakWidth: { value: 1 },
    uStreakLength: { value: 1 },
    uGlow: { value: 1 },
    uDensity: { value: 1 },
    uTwinkle: { value: 1 },
    uZoom: { value: 1 },
    uBgGlow: { value: 1 },
    uOpacity: { value: 1 },
    uMouseEnabled: { value: 0 },
    uMouseStrength: { value: 0 },
    uMouseRadius: { value: 1 },
    uSteps: { value: MAX_STEPS },
  };
  writeSettings(u, s, MAX_STEPS);
  return u;
};

type GLHandle = {
  uniforms: LightfallUniforms;
  applySettings: () => void;
  syncRunState: () => void;
};

const Lightfall = ({
  className,
  dpr,
  paused = false,
  colors = ["#34E0A1", "#0FA968", "#F5B301"],
  backgroundColor = "#07231B",
  speed = 0.25,
  streakCount = 3,
  streakWidth = 1,
  streakLength = 1,
  glow = 1,
  density = 0.6,
  twinkle = 1,
  zoom = 3,
  backgroundGlow = 0.5,
  opacity = 1,
  mouseInteraction = true,
  mouseStrength = 0.5,
  mouseRadius = 1,
  mouseDampening = 0.15,
  mixBlendMode,
  steps = MAX_STEPS,
  adaptiveQuality = true,
  maxFps = 60,
}: LightfallProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const glRef = useRef<GLHandle | null>(null);
  const mouseTargetRef = useRef<[number, number]>([0, 0]);

  // Everything imperative reads props through this ref, so a prop change never
  // rebuilds the GL context. The colours are keyed by string for the same reason.
  const settings: Settings = {
    dpr, paused, colors, backgroundColor, speed, streakCount, streakWidth, streakLength,
    glow, density, twinkle, zoom, backgroundGlow, opacity, mouseInteraction,
    mouseStrength, mouseRadius, mouseDampening, steps, adaptiveQuality, maxFps,
  };
  const settingsRef = useRef<Settings>(settings);
  settingsRef.current = settings;

  const colorKey = colors.join(",");
  const style = useMemo(
    () => (mixBlendMode ? { mixBlendMode: mixBlendMode as React.CSSProperties["mixBlendMode"] } : undefined),
    [mixBlendMode],
  );

  // Created once per mount. Nothing in here is recreated for prop changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({
      dpr: 1,
      alpha: true,
      // Multisampling does nothing for a full-screen fragment effect, it only costs bandwidth.
      antialias: false,
    });
    const gl = renderer.gl;
    const canvas = gl.canvas;

    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    container.appendChild(canvas);

    const uniforms = buildUniforms(settingsRef.current, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const program = new Program(gl, { vertex, fragment, uniforms });
    const geometry = new Triangle(gl);
    const mesh = new Mesh(gl, { geometry, program });

    const quality = { dprIndex: 0, stepIndex: 0, exhausted: false };
    const perf = { sum: 0, frames: 0, windowStart: 0 };
    const resetPerf = () => {
      perf.sum = 0;
      perf.frames = 0;
      perf.windowStart = 0;
    };

    let raf: number | null = null;
    let clock = 0; // accumulated animation time, so pausing never jumps the motion
    let lastTs = 0;
    let lastRender = 0;
    let sinceRender = 0;
    let visible = true;
    let disposed = false;

    const reduceMotionQuery =
      typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    let reduceMotion = !!reduceMotionQuery?.matches;

    const draw = (now: number, measure: boolean) => {
      if (disposed) return;
      uniforms.iTime.value = clock;
      try {
        renderer.render({ scene: mesh });
      } catch (e) {
        console.error(e);
        return;
      }
      const previous = lastRender;
      lastRender = now;
      if (!measure || !settingsRef.current.adaptiveQuality || quality.exhausted || !previous) return;

      const delta = now - previous;
      if (delta < SPIKE_FRAME_MS) {
        perf.sum += delta;
        perf.frames += 1;
      }
      if (!perf.windowStart) {
        perf.windowStart = now;
      } else if (now - perf.windowStart >= QUALITY_WINDOW_MS) {
        // Never faster than the frame cap allows, or a low maxFps would look like a slow device.
        const budget = Math.max(SLOW_FRAME_MS, frameBudget() * 1.3);
        if (perf.frames > 6 && perf.sum / perf.frames > budget && !stepDownQuality()) {
          quality.exhausted = true;
        }
        perf.sum = 0;
        perf.frames = 0;
        perf.windowStart = now;
      }
    };

    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      renderer.setSize(rect.width, rect.height);
      uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
      // Resizing clears the buffer, so a stopped loop (reduced motion, paused) needs one frame.
      if (raf === null && visible && !settingsRef.current.paused) draw(performance.now(), false);
    };

    const dprLadder = () => {
      const s = settingsRef.current;
      const device = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const top = s.dpr && s.dpr > 0 ? s.dpr : Math.min(device, DPR_LADDER[0]);
      return [top, ...DPR_LADDER.filter((v) => v < top - 1e-3)];
    };

    const applyDpr = () => {
      const ladder = dprLadder();
      quality.dprIndex = Math.min(quality.dprIndex, ladder.length - 1);
      const next = ladder[quality.dprIndex];
      if (Math.abs(next - renderer.dpr) < 1e-3) return false;
      // iMouse lives in device pixels, so rescale it or the glow jumps.
      const scale = next / (renderer.dpr || 1);
      const target = mouseTargetRef.current;
      mouseTargetRef.current = [target[0] * scale, target[1] * scale];
      const cur = uniforms.iMouse.value;
      uniforms.iMouse.value = [cur[0] * scale, cur[1] * scale];
      renderer.dpr = next;
      resize();
      return true;
    };

    const stepDownQuality = () => {
      if (quality.dprIndex < dprLadder().length - 1) {
        quality.dprIndex += 1;
        applyDpr();
        return true;
      }
      if (quality.stepIndex < STEP_LADDER.length - 1) {
        quality.stepIndex += 1;
        writeSettings(uniforms, settingsRef.current, STEP_LADDER[quality.stepIndex]);
        return true;
      }
      return false;
    };

    const frameBudget = () => {
      const fps = settingsRef.current.maxFps;
      return fps > 0 ? 1000 / Math.min(fps, 240) : 0;
    };

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const s = settingsRef.current;
      const elapsed = lastTs ? now - lastTs : 0;
      lastTs = now;
      const dt = Math.min(elapsed, 100) / 1000; // a hitch must not teleport the motion
      clock += dt;

      const target = mouseTargetRef.current;
      const cur = uniforms.iMouse.value;
      if (s.mouseDampening > 0) {
        const factor = Math.min(1, 1 - Math.exp(-dt / Math.max(1e-4, s.mouseDampening)));
        cur[0] += (target[0] - cur[0]) * factor;
        cur[1] += (target[1] - cur[1]) * factor;
      } else {
        cur[0] = target[0];
        cur[1] = target[1];
      }

      const budget = frameBudget();
      sinceRender += elapsed;
      if (budget > 0) {
        if (sinceRender < budget - 0.5) return;
        sinceRender = clamp(sinceRender - budget, 0, budget);
      }
      draw(now, true);
    };

    const syncRunState = () => {
      if (disposed) return;
      const s = settingsRef.current;
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const active = !s.paused && visible && !hidden && !reduceMotion;
      if (active) {
        if (raf === null) {
          // A resume must not look like a slow device.
          lastTs = 0;
          lastRender = 0;
          sinceRender = 0;
          resetPerf();
          raf = requestAnimationFrame(tick);
        }
        return;
      }
      if (raf !== null) {
        cancelAnimationFrame(raf);
        raf = null;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!settingsRef.current.mouseInteraction) return;
      const rect = canvas.getBoundingClientRect();
      const scale = renderer.dpr || 1;
      const x = (e.clientX - rect.left) * scale;
      const y = (rect.height - (e.clientY - rect.top)) * scale;
      mouseTargetRef.current = [x, y];
      if (settingsRef.current.mouseDampening <= 0) uniforms.iMouse.value = [x, y];
    };

    const onVisibility = () => syncRunState();
    const onReduceMotion = (e: MediaQueryListEvent) => {
      reduceMotion = e.matches;
      syncRunState();
      if (reduceMotion) draw(performance.now(), false);
    };

    applyDpr();
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              visible = entries.some((entry) => entry.isIntersecting);
              syncRunState();
            },
            { threshold: 0 },
          )
        : null;
    io?.observe(container);

    canvas.addEventListener("pointermove", onPointerMove);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotionQuery?.addEventListener?.("change", onReduceMotion);

    // Seed the canvas so a paused, off-screen or reduced-motion mount still shows the scene.
    if (!settingsRef.current.paused) draw(performance.now(), false);
    syncRunState();

    glRef.current = {
      uniforms,
      applySettings: () => {
        writeSettings(uniforms, settingsRef.current, STEP_LADDER[quality.stepIndex]);
        applyDpr();
        if (raf === null && visible && !settingsRef.current.paused) draw(performance.now(), false);
      },
      syncRunState,
    };

    return () => {
      disposed = true;
      glRef.current = null;
      if (raf !== null) cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotionQuery?.removeEventListener?.("change", onReduceMotion);
      ro.disconnect();
      io?.disconnect();
      if (canvas.parentElement === container) container.removeChild(canvas);
      const callIfFn = (obj: unknown, key: string) => {
        const o = obj as Record<string, unknown> | null;
        if (o && typeof o[key] === "function") (o[key] as () => void).call(o);
      };
      callIfFn(program, "remove");
      callIfFn(geometry, "remove");
      callIfFn(mesh, "remove");
      callIfFn(renderer, "destroy");
      // Free the GPU side now rather than waiting for GC to collect the context.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  // Prop changes are uniform writes only. This must never tear the context down.
  useEffect(() => {
    glRef.current?.applySettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    colorKey, backgroundColor, speed, streakCount, streakWidth, streakLength, glow,
    density, twinkle, zoom, backgroundGlow, opacity, mouseInteraction, mouseStrength,
    mouseRadius, steps, dpr,
  ]);

  useEffect(() => {
    glRef.current?.syncRunState();
  }, [paused]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 h-full w-full overflow-hidden ${className ?? ""}`}
      style={style}
    />
  );
};

export default Lightfall;
