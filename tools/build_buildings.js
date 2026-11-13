// 브이월드 건물 데이터(LT_C_SPBD)를 받아 buildings_data.js로 저장한다.
// 사용: node tools/build_buildings.js
// 모형 버전(model.html)은 이 파일이 있으면 브이월드에 접속하지 않고 바로 건물을 그린다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
global.window = {};
require(path.join(ROOT, 'config.js'));
require(path.join(ROOT, 'osm_data.js'));
const CFG = window.APP_CONFIG, C0 = window.OSM_DATA.center, R = window.OSM_DATA.radius;
const MX = Math.cos(C0.lat * Math.PI / 180) * 111320, MZ = 110574;

async function main() {
  const dLon = R / MX, dLat = R / MZ;
  const box = [C0.lon - dLon, C0.lat - dLat, C0.lon + dLon, C0.lat + dLat].map((v) => v.toFixed(6)).join(',');
  const base = 'https://api.vworld.kr/req/data?service=data&version=2.0&request=GetFeature&format=json'
    + '&data=LT_C_SPBD&geometry=true&attribute=true&crs=EPSG:4326&size=1000'
    + '&geomFilter=BOX(' + box + ')'
    + '&domain=' + encodeURIComponent(CFG.vworldDomain) + '&key=' + encodeURIComponent(CFG.vworldKey);
  const seen = new Set(), out = [];
  let page = 1, total = 1;
  while (page <= total) {
    const res = (await (await fetch(base + '&page=' + page)).json()).response;
    if (res.status !== 'OK') throw new Error('브이월드 오류: ' + JSON.stringify(res.error || res.status));
    total = parseInt(res.page.total, 10) || 1;
    for (const f of res.result.featureCollection.features) {
      if (!f.geometry || seen.has(f.id)) continue;
      const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
      const outer = polys[0] && polys[0][0];
      if (!outer || outer.length < 4) continue;
      // model.html과 같은 기준: 외곽선 꼭짓점 평균 위치가 반경 안인 건물만
      let sx = 0, sz = 0;
      for (const c of outer) { sx += (c[0] - C0.lon) * MX; sz += (c[1] - C0.lat) * MZ; }
      if ((sx / outer.length) ** 2 + (sz / outer.length) ** 2 > R * R) continue;
      seen.add(f.id);
      const a = f.properties || {};
      const round = (ring) => ring.map((c) => [+c[0].toFixed(6), +c[1].toFixed(6)]);
      const props = {};
      for (const k of ['gro_flo_co', 'buld_nm', 'buld_nm_dc', 'sigungu', 'gu', 'rd_nm', 'buld_no']) if (a[k] !== undefined && a[k] !== null && a[k] !== '') props[k] = a[k];
      out.push({ id: f.id, properties: props, geometry: { type: 'MultiPolygon', coordinates: polys.map((p) => p.map(round)) } });
    }
    console.log('page ' + page + '/' + total + ' → ' + out.length + '동');
    page++;
  }
  const text = '// 자동 생성: node tools/build_buildings.js\n// 출처: 브이월드(국토교통부) 오픈API 도로명주소 건물(LT_C_SPBD)\n'
    + 'window.BUILDING_DATA = ' + JSON.stringify({ fetched: new Date().toISOString().slice(0, 10), features: out }) + ';\n';
  fs.writeFileSync(path.join(ROOT, 'buildings_data.js'), text);
  console.log('buildings_data.js: ' + out.length + '동, ' + (text.length / 1024 / 1024).toFixed(2) + 'MB');
}
main().catch((e) => { console.error(e); process.exit(1); });
