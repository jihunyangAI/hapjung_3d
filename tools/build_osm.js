// OSM 원본(osm_raw.json)을 3D 페이지용 로컬 미터 좌표(osm_data.js)로 변환한다.
// 사용: node tools/build_osm.js   (hapjeong3d 폴더에서)
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CENTER = { lat: 37.5507869, lon: 126.9159120 }; // 합정역 3번출구 (OSM node 3121496829)
const R = 1000;

const MX = Math.cos(CENTER.lat * Math.PI / 180) * 111320;
const MZ = 110574;
const proj = (p) => [(p.lon - CENTER.lon) * MX, -(p.lat - CENTER.lat) * MZ]; // x=동, z=남
const r1 = (v) => Math.round(v * 10) / 10;
const flat = (pts) => pts.flatMap((p) => [r1(p[0]), r1(p[1])]);

// ---- 원으로 선분 자르기 ----
function clipLine(pts) {
  const out = [];
  let cur = [];
  const inside = (p) => p[0] * p[0] + p[1] * p[1] <= R * R;
  const hit = (a, b) => {
    // a-b 선분과 원의 교점 t들
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const A = dx * dx + dz * dz, B = 2 * (a[0] * dx + a[1] * dz), C = a[0] * a[0] + a[1] * a[1] - R * R;
    const D = B * B - 4 * A * C;
    if (A === 0 || D < 0) return [];
    const s = Math.sqrt(D);
    return [(-B - s) / (2 * A), (-B + s) / (2 * A)].filter((t) => t >= 0 && t <= 1)
      .map((t) => [a[0] + dx * t, a[1] + dz * t]);
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const ia = inside(a), ib = inside(b);
    if (ia && ib) {
      if (!cur.length) cur.push(a);
      cur.push(b);
    } else if (ia && !ib) {
      if (!cur.length) cur.push(a);
      const h = hit(a, b);
      if (h.length) cur.push(h[h.length - 1]);
      if (cur.length > 1) out.push(cur);
      cur = [];
    } else if (!ia && ib) {
      const h = hit(a, b);
      cur = h.length ? [h[0], b] : [b];
    } else {
      const h = hit(a, b);
      if (h.length === 2) out.push([h[0], h[1]]);
    }
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

// ---- 원(정다각형 근사)으로 다각형 자르기: Sutherland–Hodgman ----
const NSIDE = 128;
const CLIP = [];
for (let i = 0; i < NSIDE; i++) {
  const a = (i / NSIDE) * Math.PI * 2;
  CLIP.push([Math.cos(a) * R, Math.sin(a) * R]);
}
function clipPoly(ring) {
  let poly = ring.slice();
  if (poly.length > 1) {
    const f = poly[0], l = poly[poly.length - 1];
    if (f[0] === l[0] && f[1] === l[1]) poly.pop();
  }
  for (let i = 0; i < NSIDE && poly.length; i++) {
    const a = CLIP[i], b = CLIP[(i + 1) % NSIDE];
    const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    const res = [];
    for (let j = 0; j < poly.length; j++) {
      const p = poly[j], q = poly[(j + 1) % poly.length];
      const sp = side(p), sq = side(q);
      if (sp >= 0) res.push(p);
      if ((sp >= 0) !== (sq >= 0)) {
        const t = sp / (sp - sq);
        res.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    poly = res;
  }
  // 연속 중복점 제거
  const cleaned = [];
  for (const p of poly) {
    const l = cleaned[cleaned.length - 1];
    if (!l || Math.hypot(l[0] - p[0], l[1] - p[1]) > 0.05) cleaned.push(p);
  }
  return cleaned.length >= 3 ? cleaned : null;
}
const area = (ring) => {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i], q = ring[(i + 1) % ring.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s) / 2;
};

// ---- 멀티폴리곤 멤버 way들을 닫힌 링으로 조립 ----
function assemble(ways) {
  const key = (p) => p.lat.toFixed(7) + ',' + p.lon.toFixed(7);
  const segs = ways.map((w) => w.slice());
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (key(ring[0]) !== key(ring[ring.length - 1]) && guard++ < 10000) {
      const end = key(ring[ring.length - 1]);
      const idx = segs.findIndex((s) => key(s[0]) === end || key(s[s.length - 1]) === end);
      if (idx < 0) break;
      let s = segs.splice(idx, 1)[0];
      if (key(s[0]) !== end) s = s.reverse();
      ring = ring.concat(s.slice(1));
    }
    rings.push(ring);
  }
  return rings;
}

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'osm_raw.json'), 'utf8'));
const out = {
  center: CENTER, radius: R, osmTimestamp: raw.osm3s && raw.osm3s.timestamp_osm_base,
  roads: [], rails: [], water: [], islands: [], green: [], exits: [], stations: [],
};

const ROAD_CLASS = {
  trunk: 'A', trunk_link: 'B', primary: 'A', primary_link: 'B', secondary: 'B', secondary_link: 'C',
  tertiary: 'C', tertiary_link: 'C', busway: 'C', unclassified: 'D', residential: 'D', living_street: 'D',
  service: 'E', pedestrian: 'F', footway: 'F', path: 'F', cycleway: 'F', steps: 'F',
};

for (const e of raw.elements) {
  const t = e.tags || {};
  if (e.type === 'node') {
    const p = proj(e);
    if (Math.hypot(p[0], p[1]) > R) continue;
    if (t.railway === 'subway_entrance') out.exits.push({ ref: t.ref || '', desc: t.description || t.name || '', p: [r1(p[0]), r1(p[1])] });
    else if (t.railway === 'station') out.stations.push({ name: t.name || '', p: [r1(p[0]), r1(p[1])] });
    continue;
  }
  if (e.type === 'way') {
    const pts = e.geometry.map(proj);
    if (t.highway) {
      const cls = ROAD_CLASS[t.highway];
      if (!cls) continue; // corridor(실내 통로) 등은 제외
      if (t.tunnel && t.tunnel !== 'no' && cls !== 'F') {
        // 지하차도는 표시하되 구분
      }
      for (const seg of clipLine(pts)) {
        out.roads.push({
          c: cls, n: t.name || '', b: t.bridge && t.bridge !== 'no' ? 1 : 0,
          u: t.tunnel && t.tunnel !== 'no' ? 1 : 0,
          l: parseInt(t.lanes, 10) || 0, p: flat(seg),
        });
      }
    } else if (t.railway) {
      for (const seg of clipLine(pts)) out.rails.push({ n: t.name || '', k: t.railway, u: t.tunnel ? 1 : 0, p: flat(seg) });
    } else if (t.natural === 'water' || t.waterway === 'boatyard' || t.waterway === 'riverbank') {
      const c = clipPoly(pts);
      if (c && area(c) > 20) out.water.push({ n: t.name || '', p: flat(c) });
    } else if (t.leisure || t.landuse || t.natural) {
      const first = e.geometry[0], last = e.geometry[e.geometry.length - 1];
      if (first.lat !== last.lat || first.lon !== last.lon) continue; // 닫히지 않은 선은 면이 아님
      const c = clipPoly(pts);
      if (c && area(c) > 20) out.green.push({ n: t.name || '', k: t.leisure || t.landuse || t.natural, p: flat(c) });
    }
    continue;
  }
  if (e.type === 'relation' && t.natural === 'water') {
    const outers = assemble(e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => m.geometry));
    const inners = assemble(e.members.filter((m) => m.role === 'inner' && m.geometry).map((m) => m.geometry));
    for (const ring of outers) {
      const c = clipPoly(ring.map(proj));
      if (c && area(c) > 20) out.water.push({ n: t.name || '', p: flat(c) });
    }
    for (const ring of inners) {
      const c = clipPoly(ring.map(proj));
      if (c && area(c) > 20) out.islands.push({ p: flat(c) });
    }
  }
}

const js = '// 자동 생성: node tools/build_osm.js\n// 출처: © OpenStreetMap contributors (ODbL)\nwindow.OSM_DATA = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(path.join(ROOT, 'osm_data.js'), js);
console.log('roads', out.roads.length, 'rails', out.rails.length, 'water', out.water.length,
  'islands', out.islands.length, 'green', out.green.length, 'exits', out.exits.length, 'stations', out.stations.length);
console.log('water areas(m2):', out.water.map((w) => w.n + ':' + Math.round(area(w.p.reduce((a, v, i) => (i % 2 ? a[a.length - 1].push(v) : a.push([v]), a), [])))).join(', '));
console.log('size', (js.length / 1024).toFixed(0) + 'KB');
