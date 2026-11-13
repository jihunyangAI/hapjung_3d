# 합정역 3번출구 반경 1km 3D

합정역 3번출구를 중심으로 반경 1km를 3D로 보여 주는 웹 페이지입니다. 설치 없이 브라우저에서 바로 열립니다.

- 모형 버전(첫 페이지): https://jihunyangai.github.io/hapjung_3d/
- 실사 3D: https://jihunyangai.github.io/hapjung_3d/real.html

## 두 가지 화면

| 화면 | 파일 | 내용 |
| --- | --- | --- |
| 모형 버전 | `index.html` | 건물 윤곽과 층수로 직접 세운 three.js 디오라마 |
| 실사 3D | `real.html` | 브이월드 3D 지도의 실제 외벽 사진이 입혀진 건물 모델 |

두 화면의 안내판에 서로 넘어가는 버튼이 있습니다.

### 실사 3D

- 반경 1km 선, 3번출구 핀, 이름표, 가로수 표시를 켜고 끌 수 있습니다.
- 시점 버튼: 처음 시점, 위에서 보기, 3번출구로
- 자동 회전: 중심을 기준으로 약 80초에 한 바퀴 돕니다.
- 처음 열 때는 건물이 다 뜨기까지 1분쯤 걸릴 수 있습니다. 가까이 갈수록 작은 건물까지 나타납니다.

### 모형 버전

- 건물 6,425동을 실제 윤곽과 층수(층당 3.3m 환산)로 세웠습니다.
- 외벽 창문, 1층 상가 유리, 옥상 색, 옥탑, 가로수와 공원 나무는 규칙에 따라 그린 것으로, 실제 모습과는 다릅니다.
- 야간 모드에서는 창문 일부에 불이 켜집니다.
- 건물에 마우스를 올리면 이름, 주소, 층수가 나옵니다.
- 건물 데이터는 저장소에 담겨 있어(`buildings_data.js`) 브이월드에 접속하지 않고도 열립니다. 최신 데이터로 갱신하려면 `node tools/build_buildings.js`를 실행합니다.
- "높이 색상"을 켜면 층수에 따른 색으로 바뀝니다.

### 공통

- 안내판 숨기기: 안내판의 `✕` 버튼 또는 키보드 `H`. 다시 보려면 왼쪽 위 `☰ 안내판` 버튼 또는 `H`.
- 실사 3D에서는 안내판을 숨기면 브이월드 조작 버튼과 아래 로고 줄도 함께 숨겨집니다.

## 내 컴퓨터에서 실행

[Node.js](https://nodejs.org)가 필요합니다.

- Windows: `start.bat`을 더블클릭하면 로컬 서버가 뜨고 브라우저가 열립니다. 명령창을 닫으면 서버가 꺼집니다.
- 그 외: `node tools/serve.js 8765`를 실행한 뒤 `http://localhost:8765/`를 엽니다.

파일을 브라우저로 직접 열면(`file://`) 브이월드 인증이 통과하지 않으므로 반드시 서버를 거쳐 열어야 합니다.

## 설정

`config.js`에서 바꿀 수 있습니다.

| 항목 | 설명 |
| --- | --- |
| `vworldKey` | 브이월드 오픈API 인증키 |
| `vworldDomain` | 인증키 발급 때 등록한 서비스 URL |
| `floorHeight` | 층당 높이(m) 환산값 |
| `unknownFloors` | 층수 정보가 없는 건물에 적용할 층수 |

인증키는 이 저장소와 배포 사이트에 공개되어 있습니다. 직접 운영하려면 [브이월드](https://www.vworld.kr)에서 본인 키를 발급받아 바꿔 쓰세요.

## 파일 구성

```
index.html          모형 버전 화면 (첫 페이지)
real.html           실사 3D 화면
model.html          예전 주소용 이동 페이지
config.js           인증키와 환산값
buildings_data.js   건물 윤곽·층수 데이터 (자동 생성, 모형 버전용)
osm_data.js         도로·수계·녹지·역 데이터 (자동 생성)
osm_raw.json        OpenStreetMap 원본 응답
start.bat           Windows 실행 파일
tools/build_osm.js  osm_raw.json → osm_data.js 변환
tools/build_buildings.js  브이월드 건물 데이터 → buildings_data.js 저장
tools/serve.js      로컬 정적 서버
```

## 데이터 출처

- 건물, 실사 3D 모델: [브이월드(국토교통부) 오픈API](https://www.vworld.kr)
- 도로, 수계, 녹지, 지하철: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL)
