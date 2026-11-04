// WebGL film renderer: blends two film frames and bends them with a liquid trail that follows
// the pointer, plus a lens bend and colour split while the page scrolls fast.

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Velocity field: advects itself, fades, and gets a splat wherever the pointer moves.
const TRAIL = /* glsl */ `
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uPointer;
uniform vec2 uMove;
uniform float uAspect;
uniform float uRadius;
uniform float uDecay;
varying vec2 vUv;
void main() {
  vec2 v = texture2D(uPrev, vUv).xy;
  vec2 adv = texture2D(uPrev, vUv - v * 0.018).xy;
  vec2 d = vUv - uPointer;
  d.x *= uAspect;
  float splat = exp(-dot(d, d) / uRadius);
  gl_FragColor = vec4(clamp(adv * uDecay + uMove * splat, -1.5, 1.5), 0.0, 1.0);
}`;

const FILM = /* glsl */ `
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform sampler2D uTrail;
uniform float uMix;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRes;
uniform vec2 uImg;
varying vec2 vUv;

vec2 cover(vec2 uv) {
  float rs = uRes.x / uRes.y, ri = uImg.x / uImg.y;
  vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
  return (uv - 0.5) * s + 0.5;
}
vec3 film(vec2 uv) {
  vec2 c = clamp(cover(uv), 0.001, 0.999);
  return mix(texture2D(uA, c).rgb, texture2D(uB, c).rgb, uMix);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec2 t = texture2D(uTrail, vUv).xy;
  float wake = length(t);
  vec2 uv = vUv - t * 0.075;
  vec2 cc = uv - 0.5;
  uv += cc * dot(cc, cc) * uSpeed * 0.45;
  float split = wake * 0.022 + abs(uSpeed) * 0.012;
  vec2 dir = wake > 0.001 ? t / wake : vec2(0.0, 1.0);
  vec3 col = vec3(film(uv + dir * split).r, film(uv).g, film(uv - dir * split).b);
  col += vec3(1.0, 0.55, 0.22) * smoothstep(0.0, 1.2, wake) * 0.12;
  float vig = smoothstep(1.25, 0.3, length(vUv - 0.5) * 1.35);
  col *= mix(0.74, 1.0, vig);
  col += (hash(vUv * uRes + fract(uTime) * 91.0) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}`;

export async function createFilmGL(canvas, { maxDpr = 1.5 } = {}) {
  const THREE = await import('three');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
  const cam = new THREE.Camera();
  const plane = new THREE.PlaneGeometry(2, 2);
  const quad = (mat) => {
    const m = new THREE.Mesh(plane, mat);
    m.frustumCulled = false;
    const s = new THREE.Scene();
    s.add(m);
    return s;
  };

  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
  let read = new THREE.WebGLRenderTarget(64, 64, rtOpts);
  let write = new THREE.WebGLRenderTarget(64, 64, rtOpts);

  const trail = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: TRAIL, depthTest: false, depthWrite: false,
    uniforms: {
      uPrev: { value: read.texture }, uPointer: { value: new THREE.Vector2(-9, -9) }, uMove: { value: new THREE.Vector2() },
      uAspect: { value: 1 }, uRadius: { value: 0.0032 }, uDecay: { value: 0.955 },
    },
  });
  const texA = new THREE.Texture(), texB = new THREE.Texture();
  for (const t of [texA, texB]) { t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; }
  const film = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FILM, depthTest: false, depthWrite: false,
    uniforms: {
      uA: { value: texA }, uB: { value: texB }, uTrail: { value: write.texture }, uMix: { value: 0 },
      uTime: { value: 0 }, uSpeed: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uImg: { value: new THREE.Vector2(16, 9) },
    },
  });
  const trailScene = quad(trail), filmScene = quad(film);

  // Pointer, in the canvas's 0..1 space (y up). Touch drags count too, even while the page scrolls.
  const ptr = { x: -9, y: -9, px: -9, py: -9, fresh: false };
  const move = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    if (!r.width) return;
    ptr.x = (cx - r.left) / r.width;
    ptr.y = 1 - (cy - r.top) / r.height;
    ptr.fresh = true;
  };
  addEventListener('pointermove', (e) => move(e.clientX, e.clientY), { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) move(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) { move(t.clientX, t.clientY); ptr.px = ptr.x; ptr.py = ptr.y; } }, { passive: true });

  let imgA = null, imgB = null;
  return {
    resize(w, h) {
      renderer.setSize(w, h, false);
      const tw = Math.max(64, Math.round(w / 5)), th = Math.max(64, Math.round(h / 5));
      read.setSize(tw, th);
      write.setSize(tw, th);
      const px = renderer.getPixelRatio();
      film.uniforms.uRes.value.set(w * px, h * px);
      trail.uniforms.uAspect.value = w / h;
    },
    frames(a, b, mix) {
      if (a !== imgA) { imgA = a; texA.image = a; texA.needsUpdate = true; film.uniforms.uImg.value.set(a.naturalWidth, a.naturalHeight); }
      if (b && b !== imgB) { imgB = b; texB.image = b; texB.needsUpdate = true; }
      film.uniforms.uMix.value = b ? mix : 0;
      if (!b && !imgB) { texB.image = a; texB.needsUpdate = true; imgB = a; }
    },
    render(time, speed) {
      if (!imgA) return;
      let mx = 0, my = 0;
      if (ptr.fresh && ptr.px > -9) {
        mx = Math.max(-1.2, Math.min(1.2, (ptr.x - ptr.px) * 10));
        my = Math.max(-1.2, Math.min(1.2, (ptr.y - ptr.py) * 10));
      }
      ptr.px = ptr.x; ptr.py = ptr.y; ptr.fresh = false;
      trail.uniforms.uPrev.value = read.texture;
      trail.uniforms.uPointer.value.set(ptr.x, ptr.y);
      trail.uniforms.uMove.value.set(mx, my);
      renderer.setRenderTarget(write);
      renderer.render(trailScene, cam);
      [read, write] = [write, read];

      film.uniforms.uTrail.value = read.texture;
      film.uniforms.uTime.value = time;
      film.uniforms.uSpeed.value = speed;
      renderer.setRenderTarget(null);
      renderer.render(filmScene, cam);
    },
  };
}
