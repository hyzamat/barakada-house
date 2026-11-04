// Floating 3D ingredients, modelled in code: tomatoes, chilies, broccoli, carrot flowers, snow peas,
// shiitake, calamansi, garlic, bell pepper, quail eggs and peppercorns. They drift and spin on their own,
// part around the pointer or a finger, scatter on a tap, and float upward as the page scrolls.
import { mq, haptic } from './util.js';

// ---------- Noise ----------
const hash3 = (x, y, z) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440670441);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
const fbm = (x, y, z) => noise3(x, y, z) * 0.55 + noise3(x * 2.1, y * 2.1, z * 2.1) * 0.3 + noise3(x * 4.3, y * 4.3, z * 4.3) * 0.15;
const rand = (a, b) => a + Math.random() * (b - a);

export async function initIngredients(section) {
  const canvas = section?.querySelector('[data-veg]');
  if (!canvas || mq.reduce.matches) return;
  let THREE, RoomEnvironment, mergeGeometries;
  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
    ({ mergeGeometries } = await import('three/addons/utils/BufferGeometryUtils.js'));
  } catch {
    return;
  }
  const V3 = THREE.Vector3;

  // ---------- Modelling helpers ----------
  const displace = (geo, fn) => {
    const p = geo.attributes.position, v = new V3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      fn(v);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const tex = (w, h, draw, color = true) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  const speckle = (ctx, w, h, n, colors, rMin, rMax, alpha = 1) => {
    for (let i = 0; i < n; i++) {
      ctx.globalAlpha = alpha * rand(0.4, 1);
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.ellipse(rand(0, w), rand(0, h), rand(rMin, rMax), rand(rMin, rMax) * rand(0.5, 1), rand(0, Math.PI), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  const grain = (ctx, w, h, cells, alpha) => {
    const s = document.createElement('canvas');
    s.width = s.height = cells;
    const sx = s.getContext('2d');
    const d = sx.createImageData(cells, cells);
    for (let i = 0; i < d.data.length; i += 4) {
      d.data[i] = d.data[i + 1] = d.data[i + 2] = Math.random() * 255;
      d.data[i + 3] = 255;
    }
    sx.putImageData(d, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.drawImage(s, 0, 0, w, h);
    ctx.globalAlpha = 1;
  };
  const bumpTex = (cells) => tex(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, cells / 4, 0.5);
    grain(ctx, w, h, cells, 0.35);
    grain(ctx, w, h, 256, 0.18);
  }, false);
  const BUMP_FINE = bumpTex(128), BUMP_COARSE = bumpTex(32);
  const mat = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.45, ...o });
  const group = (...meshes) => { const g = new THREE.Group(); g.add(...meshes); return g; };
  const finish = (g, r) => {
    const c = new THREE.Box3().setFromObject(g).getCenter(new V3());
    g.children.forEach((m) => m.position.sub(c));
    g.userData.r = r;
    return g;
  };

  // ---------- Ingredients ----------
  function tomato() {
    const body = displace(new THREE.SphereGeometry(1, 64, 48), (v) => {
      const lat = v.y, lobe = 1 + 0.035 * Math.cos(5 * Math.atan2(v.z, v.x)) * (1 - lat * lat);
      v.x *= lobe;
      v.z *= lobe;
      v.y *= 0.84;
      if (lat > 0.8) v.y -= (lat - 0.8) * 0.5;
    });
    const skin = tex(512, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#b8541c');
      g.addColorStop(0.2, '#d4331a');
      g.addColorStop(1, '#c52314');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 70, ['#e04a24', '#a81c10', '#e8662e'], 10, 40, 0.22);
    });
    const leaves = [];
    for (let k = 0; k < 5; k++) {
      const leaf = displace(new THREE.BoxGeometry(0.62, 0.025, 0.17, 12, 1, 2), (v) => {
        const t = (v.x + 0.31) / 0.62;
        v.z *= 1 - t * 0.85;
        v.y -= t * t * 0.2;
      });
      leaf.translate(0.31, 0, 0);
      leaf.rotateY((k / 5) * Math.PI * 2 + 0.3);
      leaf.translate(0, 0.74, 0);
      leaves.push(leaf);
    }
    const stem = new THREE.CylinderGeometry(0.045, 0.06, 0.28, 10);
    stem.translate(0, 0.87, 0);
    return finish(group(
      new THREE.Mesh(body, mat({ map: skin, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06, bumpMap: BUMP_FINE, bumpScale: 0.4 })),
      new THREE.Mesh(mergeGeometries([...leaves, stem]), mat({ color: '#3d7a28', roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color('#9fd06a') })),
    ), 1);
  }

  function chili() {
    const curve = new THREE.CatmullRomCurve3([new V3(0, 1.4, 0), new V3(0.05, 0.8, 0.04), new V3(0.2, 0, 0), new V3(0.55, -0.85, -0.04), new V3(1.05, -1.45, 0)]);
    const T = 90, R = 24;
    const body = new THREE.TubeGeometry(curve, T, 0.27, R, false);
    const p = body.attributes.position, c = new V3(), v = new V3();
    for (let i = 0; i <= T; i++) {
      const t = i / T;
      curve.getPointAt(t, c);
      const k = (0.78 + 0.22 * Math.min(1, t / 0.07)) * Math.pow(Math.max(0.02, 1 - Math.max(0, t - 0.18) / 0.82), 0.8);
      for (let j = 0; j <= R; j++) {
        const n = i * (R + 1) + j;
        v.fromBufferAttribute(p, n).sub(c).multiplyScalar(k).add(c);
        p.setXYZ(n, v.x, v.y, v.z);
      }
    }
    body.computeVertexNormals();
    const top = new THREE.SphereGeometry(0.27 * 0.78, 24, 16);
    top.translate(0, 1.4, 0);
    const cup = new THREE.SphereGeometry(0.25, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55);
    cup.scale(1, 0.55, 1);
    cup.translate(0, 1.5, 0);
    const stem = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, 1.55, 0), new V3(0.04, 1.8, 0.02), new V3(-0.06, 2.05, 0)]), 12, 0.055, 8, false);
    const red = mat({ color: '#c8170d', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, bumpMap: BUMP_FINE, bumpScale: 0.25 });
    return finish(group(
      new THREE.Mesh(body, red),
      new THREE.Mesh(top, red),
      new THREE.Mesh(mergeGeometries([cup, stem]), mat({ color: '#4f7f2a', roughness: 0.5 })),
    ), 1.7);
  }

  function broccoli() {
    const florets = [], col = new THREE.Color();
    const tint = (geo) => {
      const n = geo.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) a.set([col.r, col.g, col.b], i * 3);
      geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
      return geo;
    };
    for (let k = 0; k < 56; k++) {
      const s = new THREE.SphereGeometry(rand(0.16, 0.27), 14, 10);
      const seed = k * 7.3;
      displace(s, (v) => v.multiplyScalar(1 + (fbm(v.x * 22 + seed, v.y * 22, v.z * 22) - 0.5) * 0.5));
      const phi = Math.acos(1 - Math.random() * 0.9), th = Math.random() * Math.PI * 2, R = rand(0.68, 0.82);
      s.translate(R * Math.sin(phi) * Math.cos(th), R * Math.cos(phi) * 0.7 + 0.15, R * Math.sin(phi) * Math.sin(th));
      col.setHSL(rand(0.25, 0.31), rand(0.5, 0.68), rand(0.09, 0.17));
      florets.push(tint(s));
    }
    col.setHSL(0.28, 0.55, 0.08);
    const core = new THREE.SphereGeometry(0.62, 24, 16);
    core.translate(0, 0.3, 0);
    florets.push(tint(core));
    const stem = new THREE.CylinderGeometry(0.27, 0.23, 1.2, 20, 6);
    stem.translate(0, -0.55, 0);
    const parts = [stem];
    for (let k = 0; k < 4; k++) {
      const b = new THREE.CylinderGeometry(0.1, 0.14, 0.75, 10);
      b.rotateZ(0.6);
      b.rotateY((k / 4) * Math.PI * 2 + 0.4);
      b.translate(0, 0.02, 0);
      parts.push(b);
    }
    return finish(group(
      new THREE.Mesh(mergeGeometries(florets), mat({ vertexColors: true, roughness: 0.85, bumpMap: BUMP_COARSE, bumpScale: 1.2, sheen: 0.25, sheenColor: new THREE.Color('#6f9a45') })),
      new THREE.Mesh(mergeGeometries(parts), mat({ color: '#a6c27a', roughness: 0.6, sheen: 0.3 })),
    ), 1.25);
  }

  function carrot() {
    const shape = new THREE.Shape();
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      const r = 0.82 + 0.18 * Math.pow(Math.abs(Math.cos(2.5 * a)), 0.7);
      i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 1 });
    geo.center();
    const face = tex(256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, '#f7b25a');
      g.addColorStop(0.3, '#f39a37');
      g.addColorStop(0.4, '#fbc06c');
      g.addColorStop(0.5, '#ec7b22');
      g.addColorStop(1, '#df5f18');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255, 214, 160, .28)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 44; k++) {
        const a = (k / 44) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(w / 2 + Math.cos(a) * w * 0.17, h / 2 + Math.sin(a) * h * 0.17);
        ctx.lineTo(w / 2 + Math.cos(a) * w * 0.47, h / 2 + Math.sin(a) * h * 0.47);
        ctx.stroke();
      }
    });
    // Extruded faces use the shape's own coordinates (-1..1) as UVs.
    face.wrapS = face.wrapT = THREE.ClampToEdgeWrapping;
    face.repeat.set(0.5, 0.5);
    face.offset.set(0.5, 0.5);
    return finish(group(new THREE.Mesh(geo, [
      mat({ map: face, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, bumpMap: BUMP_FINE, bumpScale: 0.3 }),
      mat({ color: '#e2631b', roughness: 0.4, clearcoat: 0.4 }),
    ])), 1);
  }

  function snowPea() {
    const geo = displace(new THREE.CapsuleGeometry(0.27, 1.7, 12, 28), (v) => {
      const y = v.y;
      v.z *= 0.4;
      const pea = Math.max(0, Math.cos(y * Math.PI * 2.2)) * 0.08 * (1 - Math.min(1, Math.abs(y) / 0.95));
      if (v.x > 0) v.x += pea * (v.x / 0.27);
      const end = Math.max(0, Math.abs(y) - 0.75) / 0.37;
      v.x *= 1 - end * 0.45;
      v.z *= 1 - end * 0.45;
      v.x += (y / 1.1) ** 2 * 0.28;
    });
    const cap = new THREE.ConeGeometry(0.09, 0.28, 8);
    cap.translate(0.28, 1.2, 0);
    return finish(group(
      new THREE.Mesh(geo, mat({ color: '#6fae37', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: new THREE.Color('#d8f5a0'), bumpMap: BUMP_FINE, bumpScale: 0.3 })),
      new THREE.Mesh(cap, mat({ color: '#4c7f26', roughness: 0.6 })),
    ), 1.15);
  }

  function shiitake() {
    const prof = [[0.001, 0.56], [0.3, 0.54], [0.58, 0.46], [0.82, 0.3], [0.98, 0.1], [1.0, -0.02], [0.9, -0.08], [0.6, -0.06], [0.25, -0.03], [0.001, -0.02]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const cap = new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(56), 72);
    // Lathe UV v runs from the top centre (canvas bottom) to the underside centre (canvas top).
    const skin = tex(512, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, h, 0, 0);
      g.addColorStop(0, '#4a2a17');
      g.addColorStop(0.42, '#7a4a2c');
      g.addColorStop(0.52, '#b98a60');
      g.addColorStop(0.6, '#e6d9c2');
      g.addColorStop(1, '#efe6d4');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(150, 120, 90, .35)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 3) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h * 0.4); ctx.stroke(); }
      for (let k = 0; k < 60; k++) {
        const x = rand(0, w), y = rand(h * 0.55, h * 0.95);
        ctx.strokeStyle = `rgba(222, 190, 150, ${rand(0.25, 0.6)})`;
        ctx.lineWidth = rand(1, 3);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand(-6, 6), y - rand(10, 40));
        ctx.stroke();
      }
    });
    const stem = displace(new THREE.CylinderGeometry(0.16, 0.21, 0.75, 20, 6), (v) => { v.x += (v.y + 0.37) ** 2 * 0.12; });
    stem.translate(0, -0.42, 0);
    return finish(group(
      new THREE.Mesh(cap, mat({ map: skin, roughness: 0.66, sheen: 0.5, sheenColor: new THREE.Color('#c8a080'), bumpMap: BUMP_COARSE, bumpScale: 0.6, side: THREE.DoubleSide })),
      new THREE.Mesh(stem, mat({ color: '#e8ddc8', roughness: 0.8, sheen: 0.3 })),
    ), 1.05);
  }

  function calamansi(half) {
    const rindMat = mat({ color: '#4a8a2a', roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.2, bumpMap: BUMP_FINE, bumpScale: 0.7 });
    const dimple = (v) => v.multiplyScalar(1 + (noise3(v.x * 14, v.y * 14, v.z * 14) - 0.5) * 0.02);
    if (!half) {
      const ball = displace(new THREE.SphereGeometry(1, 48, 32), (v) => { dimple(v); v.y *= 0.92; });
      const nub = new THREE.CylinderGeometry(0.06, 0.09, 0.12, 8);
      nub.translate(0, 0.95, 0);
      return finish(group(new THREE.Mesh(ball, rindMat), new THREE.Mesh(nub, mat({ color: '#3a5a20', roughness: 0.7 }))), 1);
    }
    const rind = displace(new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), dimple);
    const face = new THREE.CircleGeometry(0.985, 72);
    face.rotateX(Math.PI / 2);
    const pulp = tex(512, 512, (ctx, w, h) => {
      const cx = w / 2, cy = h / 2, R = w / 2;
      ctx.fillStyle = '#4a8a2a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#f3efcf';
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.96, 0, Math.PI * 2); ctx.fill();
      for (let k = 0; k < 9; k++) {
        const a0 = (k / 9) * Math.PI * 2 + 0.05, a1 = ((k + 1) / 9) * Math.PI * 2 - 0.05;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos((a0 + a1) / 2) * R * 0.08, cy + Math.sin((a0 + a1) / 2) * R * 0.08);
        ctx.arc(cx, cy, R * 0.86, a0, a1);
        ctx.closePath();
        const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 0.86);
        g.addColorStop(0, '#ffd36a');
        g.addColorStop(1, '#f39a1e');
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.84, 0, Math.PI * 2); ctx.clip();
      speckle(ctx, w, h, 260, ['#ffe7a0', '#ffc24a'], 2, 7, 0.55);
      ctx.restore();
      ctx.fillStyle = '#f6f0d6';
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2); ctx.fill();
    });
    return finish(group(
      new THREE.Mesh(rind, rindMat),
      new THREE.Mesh(face, mat({ map: pulp, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 })),
    ), 1);
  }

  function garlic() {
    const geo = displace(new THREE.SphereGeometry(1, 72, 48), (v) => {
      const lat = v.y, lobe = 1 + 0.07 * Math.pow(Math.abs(Math.cos(3.5 * Math.atan2(v.z, v.x))), 0.6) * (1 - lat * lat) - 0.035;
      v.x *= lobe;
      v.z *= lobe;
      if (lat > 0) {
        const k = 1 - lat * 0.45;
        v.x *= k;
        v.z *= k;
        v.y = lat * 1.05 + Math.max(0, lat - 0.7) ** 2 * 1.4;
      } else {
        v.y = lat * 0.72;
      }
    });
    const skin = tex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#efe7d8';
      ctx.fillRect(0, 0, w, h);
      for (let k = 0; k < 80; k++) {
        const x = rand(0, w);
        ctx.strokeStyle = Math.random() > 0.6 ? 'rgba(170, 115, 150, .22)' : 'rgba(200, 180, 150, .25)';
        ctx.lineWidth = rand(1, 3);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + rand(-10, 10), h * 0.3, x + rand(-10, 10), h * 0.7, x + rand(-6, 6), h);
        ctx.stroke();
      }
    });
    const tip = new THREE.ConeGeometry(0.08, 0.5, 10);
    tip.translate(0, 1.4, 0);
    const root = new THREE.CircleGeometry(0.3, 24);
    root.rotateX(Math.PI / 2);
    root.translate(0, -0.71, 0);
    return finish(group(
      new THREE.Mesh(geo, mat({ map: skin, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4, bumpMap: BUMP_FINE, bumpScale: 0.3 })),
      new THREE.Mesh(tip, mat({ color: '#d9c7a4', roughness: 0.8 })),
      new THREE.Mesh(root, mat({ color: '#b39470', roughness: 0.9 })),
    ), 1.15);
  }

  function pepperStrip(color) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1, -0.5, 0.5, false);
    shape.absarc(0, 0, 0.88, 0.5, -0.5, true);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.1, steps: 24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 2, curveSegments: 28 });
    geo.center();
    displace(geo, (v) => { v.x += Math.sin(v.z * 1.4) * 0.12; v.y += Math.cos(v.z * 0.9) * 0.05; });
    return finish(group(new THREE.Mesh(geo, mat({ color, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, bumpMap: BUMP_FINE, bumpScale: 0.2 }))), 1.15);
  }

  function quailEgg() {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI;
      pts.push(new THREE.Vector2(Math.max(0.001, Math.sin(a) * 0.8 * (1 + 0.13 * Math.cos(a))), -Math.cos(a) * 1.05));
    }
    const shell = tex(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#eadcc0';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 90, ['#6b4a2e', '#4a3220', '#8a6440'], 3, 18, 0.85);
      speckle(ctx, w, h, 40, ['#2a1d14'], 2, 8, 0.9);
    });
    return finish(group(new THREE.Mesh(new THREE.LatheGeometry(pts, 64), mat({ map: shell, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3 }))), 1.05);
  }

  function peppercorn() {
    const geo = displace(new THREE.SphereGeometry(0.2, 22, 16), (v) => v.multiplyScalar(1 + (fbm(v.x * 30, v.y * 30, v.z * 30) - 0.5) * 0.35));
    return finish(group(new THREE.Mesh(geo, mat({ color: '#2a1c12', roughness: 0.6, bumpMap: BUMP_COARSE, bumpScale: 0.8 }))), 0.22);
  }

  // ---------- Scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0c0907, 20, 36);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  const key = new THREE.DirectionalLight(0xffe0b0, 2.6);
  key.position.set(6, 9, 10);
  const fill = new THREE.DirectionalLight(0xbfd4ff, 0.6);
  fill.position.set(-8, 2, 6);
  const rim = new THREE.DirectionalLight(0xe45b2c, 2.4);
  rim.position.set(-6, -5, -8);
  scene.add(key, fill, rim);

  const small = matchMedia('(max-width: 760px)').matches;
  const KINDS = [
    [tomato, 3, 2, 0.62, 0.82],
    [chili, 3, 2, 0.55, 0.66],
    [broccoli, 3, 2, 0.72, 0.88],
    [carrot, 4, 3, 0.5, 0.64],
    [snowPea, 3, 2, 0.62, 0.74],
    [shiitake, 2, 1, 0.6, 0.72],
    [() => calamansi(true), 2, 1, 0.5, 0.6],
    [() => calamansi(false), 1, 1, 0.45, 0.52],
    [garlic, 2, 1, 0.55, 0.65],
    [() => pepperStrip('#d0210f'), 2, 1, 0.6, 0.72],
    [() => pepperStrip('#f2b01b'), 1, 1, 0.6, 0.72],
    [quailEgg, 2, 1, 0.5, 0.58],
    [peppercorn, 7, 4, 0.9, 1.25],
  ];
  const bodies = [];
  for (const [make, nDesk, nPhone, s0, s1] of KINDS) {
    const proto = make();
    for (let i = 0; i < (small ? nPhone : nDesk); i++) {
      const obj = i ? proto.clone() : proto;
      const s = rand(s0, s1) * (small ? 0.85 : 1);
      obj.scale.setScalar(s);
      obj.quaternion.random();
      scene.add(obj);
      bodies.push({
        obj, r: proto.userData.r * s,
        home: new V3(), p: new V3(), v: new V3(),
        w: new V3().randomDirection().multiplyScalar(rand(0.15, 0.45)), spin: new V3(),
        ph: [rand(0, 6.3), rand(0, 6.3), rand(0, 6.3)], fq: [rand(0.12, 0.25), rand(0.15, 0.3), rand(0.1, 0.2)], amp: rand(0.25, 0.5),
      });
    }
  }

  // Spread them around the frame, keeping big pieces off the two title lines.
  let viewH = 10;
  function layout() {
    const dist = camera.position.z;
    const H = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), W = H * camera.aspect;
    viewH = H;
    const placed = [];
    for (const b of [...bodies].sort((a, c) => c.r - a.r)) {
      let spot = null;
      for (let tries = 0; tries < 260 && !spot; tries++) {
        const z = rand(-3.5, 2.5), k = (dist - z) / dist;
        const x = rand(-0.46, 0.46) * W * k, y = rand(-0.44, 0.44) * H * k;
        const sx = x / (W * k), sy = y / (H * k);
        if (b.r > 0.4 && Math.abs(sx) < 0.4 && (Math.abs(sy - 0.28) < 0.09 || Math.abs(sy + 0.29) < 0.09)) continue;
        const clear = placed.every((o) => Math.hypot(o.x - x, o.y - y) > (o.r + b.r) * 1.1 + 0.25 || Math.abs(o.z - z) > (o.r + b.r) * 1.2);
        if (clear || tries === 259) spot = { x, y, z };
      }
      b.home.set(spot.x, spot.y, spot.z);
      placed.push({ ...spot, r: b.r });
    }
  }
  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.position.z = w / h < 1 ? 20 / Math.max(0.5, w / h) * 0.62 : 20;
    camera.updateProjectionMatrix();
    layout();
  }
  resize();
  let rw = innerWidth;
  addEventListener('resize', () => { if (Math.abs(innerWidth - rw) > 40) { rw = innerWidth; resize(); } });
  // Start below the frame; they rise into place when the section first shows.
  for (const b of bodies) b.p.copy(b.home).add(new V3(rand(-2, 2), -viewH * rand(0.9, 1.3), rand(-2, 2)));

  // ---------- Pointer ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let ptrOn = false, ptrT = 0;
  const ptrPrev = new THREE.Vector2(), ptrMove = new THREE.Vector2();
  const PR = small ? 1.9 : 2.3;
  const at = new V3();
  const pointAtDepth = (z) => {
    const o = ray.ray.origin, d = ray.ray.direction;
    return at.copy(d).multiplyScalar((z - o.z) / d.z).add(o);
  };
  function aim(cx, cy) {
    const r = canvas.getBoundingClientRect();
    if (cy < r.top || cy > r.bottom) return false;
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ptrMove.set(ndc.x - ptrPrev.x, ndc.y - ptrPrev.y);
    ptrPrev.copy(ndc);
    ray.setFromCamera(ndc, camera);
    ptrOn = true;
    ptrT = performance.now();
    return true;
  }
  section.addEventListener('pointermove', (e) => aim(e.clientX, e.clientY), { passive: true });
  section.addEventListener('pointerleave', () => { ptrOn = false; });
  section.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) aim(t.clientX, t.clientY); }, { passive: true });
  section.addEventListener('pointerdown', (e) => {
    if (!aim(e.clientX, e.clientY)) return;
    haptic(12);
    for (const b of bodies) {
      const d = tmp.subVectors(b.p, pointAtDepth(b.p.z)).setZ(0);
      const dist = Math.max(0.5, d.length());
      if (dist < 6) {
        b.v.addScaledVector(d.normalize(), (6 - dist) * 0.07).z += rand(-0.1, 0.1);
        b.spin.add(new V3().randomDirection().multiplyScalar(rand(2, 5)));
      }
    }
  });

  // ---------- Motion ----------
  let lift = 0, scrollVel = 0;
  ScrollTrigger.create({
    trigger: section, start: 'top bottom', end: 'bottom top',
    onUpdate: (self) => { lift = (self.progress - 0.5) * 7; scrollVel = self.getVelocity(); },
  });
  const tmp = new V3(), target = new V3(), axis = new V3(), dq = new THREE.Quaternion();
  function step(t, dt) {
    const f = dt * 60;
    if (ptrOn && performance.now() - ptrT > 1800) ptrOn = false;
    const boost = 1 + Math.min(3, Math.abs(scrollVel) / 900);
    scrollVel *= Math.pow(0.9, f);
    for (const b of bodies) {
      target.copy(b.home);
      target.x += Math.sin(t * b.fq[0] * 6.283 + b.ph[0]) * b.amp;
      target.y += Math.sin(t * b.fq[1] * 6.283 + b.ph[1]) * b.amp * 1.2 + lift * (1 + (b.home.z + 4) * 0.25);
      target.z += Math.sin(t * b.fq[2] * 6.283 + b.ph[2]) * b.amp * 0.6;
      b.v.addScaledVector(tmp.subVectors(target, b.p), 0.016 * f);
      if (ptrOn) {
        const d = tmp.subVectors(b.p, pointAtDepth(b.p.z)).setZ(0);
        const dist = d.length(), min = PR + b.r;
        if (dist < min && dist > 1e-4) {
          const push = (min - dist) / min;
          b.v.addScaledVector(d.normalize(), push * 0.12 * f);
          b.v.x += ptrMove.x * push * 1.5;
          b.v.y += ptrMove.y * push * 1.5;
          b.spin.add(axis.set(-ptrMove.y, ptrMove.x, 0).multiplyScalar(push * 8));
        }
      }
      b.v.multiplyScalar(Math.pow(0.9, f));
    }
    ptrMove.multiplyScalar(0.5);
    // Keep neighbours from passing through each other when shoved together.
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i];
      for (let j = i + 1; j < bodies.length; j++) {
        const c = bodies[j];
        tmp.subVectors(a.p, c.p);
        const d = tmp.length(), min = (a.r + c.r) * 0.9;
        if (d < min && d > 1e-4) {
          tmp.multiplyScalar(((min - d) / d) * 0.5);
          a.p.add(tmp);
          c.p.sub(tmp);
        }
      }
    }
    for (const b of bodies) {
      b.p.addScaledVector(b.v, f);
      b.obj.position.copy(b.p);
      axis.copy(b.w).multiplyScalar(boost).add(b.spin);
      const ang = axis.length() * dt;
      if (ang > 1e-6) {
        dq.setFromAxisAngle(axis.normalize(), ang);
        b.obj.quaternion.premultiply(dq);
      }
      b.spin.multiplyScalar(Math.pow(0.96, f));
    }
  }

  let raf = 0, last = 0;
  const loop = (now) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(1 / 30, (now - last) / 1000 || 1 / 60);
    last = now;
    step(now / 1000, dt);
    renderer.render(scene, camera);
  };
  new IntersectionObserver(([e]) => {
    cancelAnimationFrame(raf);
    if (e.isIntersecting) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }, { rootMargin: '160px' }).observe(section);
}
