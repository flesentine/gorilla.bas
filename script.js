const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const ui = {
  form: document.querySelector("#shotForm"),
  angle: document.querySelector("#angle"),
  velocity: document.querySelector("#velocity"),
  angleOut: document.querySelector("#angleOut"),
  velocityOut: document.querySelector("#velocityOut"),
  status: document.querySelector("#status"),
  wind: document.querySelector("#windReadout"),
  p1Score: document.querySelector("#p1Score"),
  p2Score: document.querySelector("#p2Score"),
  round: document.querySelector("#roundLabel"),
  aimToggle: document.querySelector("#aimToggle"),
  throwButton: document.querySelector("#throwButton"),
  newRoundButton: document.querySelector("#newRoundButton"),
};

const W = canvas.width;
const H = canvas.height;
const groundY = H - 26;
const gravity = 0.092;
const throwScale = 0.094;
const windScale = 0.001;
const gorillaScale = 0.44;
const actionScale = 0.54;
const velocityMax = 130;
const shotStartOffset = { x: 34, y: -40 };
const spriteSheet = new Image();
spriteSheet.src = "assets/gorilla-atlas.png";
const actionSheet = new Image();
actionSheet.src = "assets/gorilla-action-sheet.png";
const damageSheet = new Image();
damageSheet.src = "assets/building-damage-sheet.png";
const holeMaskSheet = new Image();
holeMaskSheet.src = "assets/building-hole-sheet.png";
const carSheet = new Image();
carSheet.src = "assets/car-sprites-normalized.png";
let spritesReady = false;
let actionSpritesReady = false;
let damageSpritesReady = false;
let holeMaskReady = false;
let carSpritesReady = false;
let seed = Date.now() % 99999;
let round = 1;
let currentPlayer = 0;
let scores = [0, 0];
let wind = 0;
let buildings = [];
let players = [];
let banana = null;
let explosions = [];
let fallingRoofDetails = [];
let fallingBuildingChunks = [];
let clouds = [];
let cars = [];
let locked = false;
let aimAssistOn = false;
let shake = 0;
let lastTime = 0;
let pendingWinner = null;
let roundResetQueued = false;

const shotDefaults = {
  angle: Number(ui.angle.value),
  velocity: Number(ui.velocity.value),
};

const playerShotSettings = [
  { angle: shotDefaults.angle, velocity: shotDefaults.velocity },
  { angle: shotDefaults.angle, velocity: shotDefaults.velocity },
];

function resetAllShotSettingsToDefaults() {
  playerShotSettings.forEach((settings) => {
    settings.angle = shotDefaults.angle;
    settings.velocity = shotDefaults.velocity;
  });
}

let syncingShotControls = false;

function saveCurrentShotSettings() {
  if (syncingShotControls || !playerShotSettings[currentPlayer]) return;
  playerShotSettings[currentPlayer].angle = Number(ui.angle.value);
  playerShotSettings[currentPlayer].velocity = Number(ui.velocity.value);
}

function loadCurrentShotSettings() {
  const settings = playerShotSettings[currentPlayer] || shotDefaults;
  syncingShotControls = true;
  ui.angle.value = settings.angle;
  ui.velocity.value = settings.velocity;
  syncingShotControls = false;
}

function handleShotInput() {
  saveCurrentShotSettings();
  updateUi();
}


const sprites = {
  brownReady: { x: 28, y: 16, w: 292, h: 298, anchorX: 140, anchorY: 271 },
  blueReady: { x: 365, y: 24, w: 258, h: 288, anchorX: 125, anchorY: 268 },
  banana: { x: 727, y: 112, w: 160, h: 72, anchorX: 80, anchorY: 36 },
  bananaSpin: { x: 996, y: 78, w: 122, h: 176, anchorX: 61, anchorY: 88 },
  puff: { x: 94, y: 397, w: 116, h: 112, anchorX: 58, anchorY: 56 },
  blast: { x: 392, y: 349, w: 220, h: 190, anchorX: 110, anchorY: 95 },
  boom: { x: 752, y: 316, w: 300, h: 244, anchorX: 150, anchorY: 122 },
  cloudLarge: { x: 927, y: 760, w: 214, h: 78, anchorX: 107, anchorY: 39 },
  cloudSmall: { x: 963, y: 865, w: 112, h: 46, anchorX: 56, anchorY: 23 },
  moon: { x: 973, y: 935, w: 103, h: 105, anchorX: 52, anchorY: 52 },
  skyline: { x: 49, y: 1009, w: 1140, h: 200, anchorX: 0, anchorY: 0 },
};

const actionSprites = {
  brownThrow: Array.from({ length: 5 }, (_, index) => ({ x: index * 280, y: 0, w: 280, h: 280, anchorX: 140, anchorY: 278 })),
  brownHurt: Array.from({ length: 5 }, (_, index) => ({ x: index * 280, y: 280, w: 280, h: 280, anchorX: 140, anchorY: 278 })),
  blueThrow: Array.from({ length: 5 }, (_, index) => ({ x: index * 280, y: 560, w: 280, h: 280, anchorX: 140, anchorY: 278 })),
  blueHurt: Array.from({ length: 5 }, (_, index) => ({ x: index * 280, y: 840, w: 280, h: 280, anchorX: 140, anchorY: 278 })),
};

const damageSprites = Array.from({ length: 3 }, (_, style) => ({
  wallLeft: { x: 0, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 32 },
  wallRight: { x: 64, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 32 },
  roofLeft: { x: 128, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 20 },
  roofRight: { x: 192, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 20 },
}));

const holeMaskSprites = Array.from({ length: 3 }, (_, style) => ({
  wallLeft: { x: 0, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 32 },
  wallRight: { x: 64, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 32 },
  roofLeft: { x: 128, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 20 },
  roofRight: { x: 192, y: style * 64, w: 64, h: 64, anchorX: 32, anchorY: 20 },
}));

const buildingAtlases = [
  {
    roof: { x: 91, y: 583, w: 214, h: 63 },
    middle: { x: 90, y: 668, w: 215, h: 159 },
    base: { x: 89, y: 857, w: 217, h: 120 },
  },
  {
    roof: { x: 376, y: 583, w: 204, h: 64 },
    middle: { x: 376, y: 673, w: 204, h: 172 },
    base: { x: 374, y: 858, w: 207, h: 120 },
  },
  {
    roof: { x: 645, y: 584, w: 205, h: 63 },
    middle: { x: 646, y: 674, w: 205, h: 172 },
    base: { x: 645, y: 858, w: 206, h: 119 },
  },
];

const roofDetails = [
  { x: 924, y: 586, w: 92, h: 128, anchorX: 46, anchorY: 122 },
  { x: 1078, y: 589, w: 65, h: 118, anchorX: 32, anchorY: 114 },
];

spriteSheet.addEventListener("load", () => {
  spritesReady = true;
});

actionSheet.addEventListener("load", () => {
  actionSpritesReady = true;
});

damageSheet.addEventListener("load", () => {
  damageSpritesReady = true;
});

holeMaskSheet.addEventListener("load", () => {
  holeMaskReady = true;
});

carSheet.addEventListener("load", () => {
  carSpritesReady = true;
});

if (carSheet.complete && carSheet.naturalWidth) {
  carSpritesReady = true;
}

function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function makeCity() {
  buildings = [];
  let x = 0;
  const palette = ["#26345e", "#33437d", "#493c7a", "#2b5a79", "#673f73", "#23536b"];
  let index = 0;
  const districtShift = random() * Math.PI * 2;

  while (x < W) {
    const width = 68 + Math.floor(random() * 54);
    const center = x + width / 2;
    const wave = (Math.sin(center / 92 + districtShift) + 1) / 2;
    const blockTypeRoll = random();
    let height;

    // Mix districts instead of evenly random buildings: low rows, medium blocks, and a few hero towers.
    if (blockTypeRoll > 0.89) {
      height = 270 + Math.floor(random() * 92); // hero tower
    } else if (blockTypeRoll > 0.68) {
      height = 200 + Math.floor(random() * 78); // tall block
    } else if (blockTypeRoll < 0.22) {
      height = 92 + Math.floor(random() * 64); // low block
    } else {
      height = 128 + Math.floor(wave * 126) + Math.floor(random() * 46); // district wave
    }

    // Create a couple more dramatic peaks around the skyline center, where they are less likely
    // to trap a gorilla at the edge but still make the level visually interesting.
    const centerBias = 1 - Math.min(1, Math.abs(center - W / 2) / (W / 2));
    if (centerBias > 0.45 && random() < 0.20) {
      height += 46 + Math.floor(random() * 64);
    }

    height = Math.max(76, Math.min(362, height));
    buildings.push({
      x,
      y: groundY - height,
      width,
      height,
      style: Math.floor(random() * buildingAtlases.length),
      color: palette[Math.floor(random() * palette.length)],
      lit: random() > 0.38,
      roof: random() > 0.58 ? "antenna" : random() > 0.48 ? "tank" : "flat",
      roofDetailGone: false,
      topBroken: false,
      holes: [],
      damageMarks: [],
      skylineRole: height > 270 ? "hero" : height < 125 ? "low" : "normal",
    });
    x += width;
    index += 1;
  }
}

function makePlayers() {
  const leftSpot = pickPlayerRoof(40, 320);
  const rightSpot = pickPlayerRoof(W - 320, W - 40);
  leftSpot.building.roof = "flat";
  rightSpot.building.roof = "flat";
  players = [
    {
      x: leftSpot.x,
      y: leftSpot.y,
      side: 1,
      color: "#9b6631",
      name: "Player 1",
      bob: 0,
      state: "ready",
      renderX: leftSpot.x,
      renderY: leftSpot.y,
      actionFrame: 0,
      animTime: 0,
      released: false,
      pendingShot: null,
      fallVx: 0,
      fallVy: 0,
      dropTargetY: leftSpot.y,
      buildingIndex: buildings.indexOf(leftSpot.building),
    },
    {
      x: rightSpot.x,
      y: rightSpot.y,
      side: -1,
      color: "#7b4f2d",
      name: "Player 2",
      bob: Math.PI,
      state: "ready",
      renderX: rightSpot.x,
      renderY: rightSpot.y,
      actionFrame: 0,
      animTime: 0,
      released: false,
      pendingShot: null,
      fallVx: 0,
      fallVy: 0,
      dropTargetY: rightSpot.y,
      buildingIndex: buildings.indexOf(rightSpot.building),
    },
  ];
}

function pickPlayerRoof(minX, maxX) {
  const footRoom = 76;
  const candidates = buildings.filter((building) => {
    const center = building.x + building.width / 2;
    return building.width >= footRoom && center >= minX && center <= maxX;
  });
  const fallback = buildings.filter((building) => building.width >= footRoom);
  const pool = candidates.length ? candidates : fallback;
  const building = pool[Math.floor(random() * pool.length)];
  const margin = Math.min(22, building.width / 2 - footRoom / 2);
  const jitter = (random() * 2 - 1) * Math.max(0, margin);
  return {
    x: building.x + building.width / 2 + jitter,
    y: building.y,
    building,
  };
}

function makeClouds() {
  clouds = Array.from({ length: 8 }, (_, i) => ({
    x: random() * W,
    y: 36 + random() * 115,
    speed: 5 + random() * 13,
    scale: 0.7 + random() * 0.9,
    sprite: i % 3 === 0 ? "cloudSmall" : "cloudLarge",
    tint: i % 2 ? "#fdaeb5" : "#9be7ff",
  }));
}

function makeCars() {
  cars = Array.from({ length: 7 }, (_, i) => {
    const lane = i % 2;
    const direction = lane === 0 ? 1 : -1;
    return {
      x: random() * W,
      y: groundY + 8 + lane * 10,
      speed: (34 + random() * 30) * direction,
      sprite: Math.floor(random() * 5),
      phase: random() * Math.PI * 2,
    };
  });
}

function getBuildingSections(building) {
  const height = Math.round(building.height);
  const roofH = Math.max(8, Math.round(Math.min(22, height * 0.16)));
  const baseH = Math.max(20, Math.round(Math.min(48, height * 0.26)));
  const middleY = building.y + roofH;
  const middleH = Math.max(8, height - roofH - baseH);
  return {
    roofH,
    baseH,
    middleY,
    middleH,
    baseY: building.y + height - baseH,
  };
}

function getBuildingRect(building) {
  return {
    left: building.x,
    right: building.x + building.width,
    top: building.y,
    bottom: building.y + building.height,
  };
}


function stableNoise(seed, step) {
  const n = Math.sin((seed + 1) * 129.9898 + step * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function pointInsideBuildingHole(building, localX, localY, padding = 0) {
  if (!building || !building.holes || !building.holes.length) return false;
  return building.holes.some((hole) => {
    const dx = localX - hole.x;
    const dy = localY - hole.y;
    const radius = hole.r + padding;
    return dx * dx + dy * dy <= radius * radius;
  });
}

function clampHoleToBuilding(building, hole) {
  hole.x = Math.max(8, Math.min(building.width - 8, hole.x));
  hole.y = Math.max(4, Math.min(building.height - 8, hole.y));
  hole.r = Math.max(12, Math.min(62, hole.r));
}

function drawIrregularHolePath(targetCtx, hole, baseX, baseY, radiusPad = 0) {
  const points = 18;
  const r = hole.r + radiusPad;
  targetCtx.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const a = (i % points) / points * Math.PI * 2;
    const wobble = 0.82 + stableNoise(hole.seed || 1, i) * 0.34;
    const px = baseX + hole.x + Math.cos(a) * r * wobble;
    const py = baseY + hole.y + Math.sin(a) * r * wobble;
    if (i === 0) targetCtx.moveTo(px, py);
    else targetCtx.lineTo(px, py);
  }
  targetCtx.closePath();
}

function punchBuildingHoles(targetCtx, building, baseX, baseY) {
  if (!building.holes || !building.holes.length) return;
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.rect(Math.round(baseX), Math.round(baseY - 4), Math.round(building.width), Math.round(building.height + 4));
  targetCtx.clip();
  targetCtx.globalCompositeOperation = "destination-out";
  building.holes.forEach((hole) => {
    drawIrregularHolePath(targetCtx, hole, baseX, baseY, 0);
    targetCtx.fill();
  });
  targetCtx.restore();
}

function drawBuildingHoleRims(targetCtx, building, baseX, baseY) {
  if (!building.holes || !building.holes.length) return;
  targetCtx.save();
  targetCtx.beginPath();
  targetCtx.rect(Math.round(baseX), Math.round(baseY - 4), Math.round(building.width), Math.round(building.height + 4));
  targetCtx.clip();
  targetCtx.globalCompositeOperation = "source-atop";
  building.holes.forEach((hole) => {
    const seed = hole.seed || 1;
    const crack = hole.edge === "roof" ? "#f8d78b" : "#efc16c";
    const shadow = "rgba(23, 11, 19, 0.82)";

    targetCtx.lineWidth = 3;
    targetCtx.strokeStyle = shadow;
    drawIrregularHolePath(targetCtx, hole, baseX, baseY, 1.5);
    targetCtx.stroke();

    targetCtx.lineWidth = 1.25;
    targetCtx.strokeStyle = crack;
    drawIrregularHolePath(targetCtx, hole, baseX, baseY, 2.5);
    targetCtx.stroke();

    for (let i = 0; i < 7; i += 1) {
      const a = stableNoise(seed, i + 20) * Math.PI * 2;
      const len = hole.r * (0.20 + stableNoise(seed, i + 40) * 0.22);
      const sx = baseX + hole.x + Math.cos(a) * hole.r * 0.78;
      const sy = baseY + hole.y + Math.sin(a) * hole.r * 0.78;
      targetCtx.beginPath();
      targetCtx.moveTo(sx, sy);
      targetCtx.lineTo(sx + Math.cos(a) * len, sy + Math.sin(a) * len);
      targetCtx.stroke();
    }
  });
  targetCtx.restore();
}

function drawMaskBasedBuildingDamage(targetCtx, building, baseX, baseY) {
  punchBuildingHoles(targetCtx, building, baseX, baseY);
  drawBuildingHoleRims(targetCtx, building, baseX, baseY);
}

function segmentIntersection(ax, ay, bx, by, cx, cy, dx, dy) {
  const rX = bx - ax;
  const rY = by - ay;
  const sX = dx - cx;
  const sY = dy - cy;
  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 0.00001) return null;
  const u = ((cx - ax) * rY - (cy - ay) * rX) / denom;
  const t = ((cx - ax) * sY - (cy - ay) * sX) / denom;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return {
    t,
    x: ax + t * rX,
    y: ay + t * rY,
  };
}

function findBuildingImpact(x1, y1, x2, y2) {
  let nearest = null;
  buildings.forEach((building, index) => {
    const rect = getBuildingRect(building);
    const edges = [
      { edge: "roof", x1: rect.left, y1: rect.top, x2: rect.right, y2: rect.top },
      { edge: "leftWall", x1: rect.left, y1: rect.top, x2: rect.left, y2: rect.bottom },
      { edge: "rightWall", x1: rect.right, y1: rect.top, x2: rect.right, y2: rect.bottom },
    ];

    edges.forEach((edge) => {
      const hit = segmentIntersection(x1, y1, x2, y2, edge.x1, edge.y1, edge.x2, edge.y2);
      if (!hit) return;
      const localX = hit.x - building.x;
      const localY = hit.y - building.y;
      if (pointInsideBuildingHole(building, localX, localY, 3)) return;
      if (!nearest || hit.t < nearest.t) {
        nearest = { ...hit, index, edge: edge.edge };
      }
    });
  });
  if (nearest) return nearest;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.max(8, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 2));
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    const inside = pointInBuilding(x, y);
    if (inside) {
      inside.t = t;
      return inside;
    }
  }
  return null;
}

function pointInBuilding(x, y) {
  let found = null;
  buildings.forEach((building, index) => {
    if (found) return;
    const rect = getBuildingRect(building);
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
    const localX = x - building.x;
    const localY = y - building.y;
    if (pointInsideBuildingHole(building, localX, localY, 2)) return;
    const distLeft = Math.abs(x - rect.left);
    const distRight = Math.abs(x - rect.right);
    const distRoof = Math.abs(y - rect.top);
    let edge = "roof";
    let best = distRoof;
    if (distLeft < best) {
      best = distLeft;
      edge = "leftWall";
    }
    if (distRight < best) {
      edge = "rightWall";
    }
    found = { index, edge, x, y, t: 0 };
  });
  return found;
}

function addBuildingDamage(hit, impactVx = 0) {
  const building = buildings[hit.index];
  if (!building) return;
  building.holes = building.holes || [];

  let localX = hit.x - building.x;
  let localY = hit.y - building.y;
  if (hit.edge === "leftWall") localX = 8;
  if (hit.edge === "rightWall") localX = building.width - 8;
  if (hit.edge === "roof") localY = 6;

  const baseRadius = hit.edge === "roof" ? 21 : 24;
  let target = null;
  let bestDistance = Infinity;
  building.holes.forEach((hole) => {
    const dist = Math.hypot(hole.x - localX, hole.y - localY);
    if (dist < bestDistance && dist <= hole.r + 34) {
      target = hole;
      bestDistance = dist;
    }
  });

  if (target) {
    target.x = (target.x * 0.72) + (localX * 0.28);
    target.y = (target.y * 0.72) + (localY * 0.28);
    target.r = Math.min(62, target.r + 8);
    target.hits = (target.hits || 1) + 1;
    target.edge = target.edge === "roof" || hit.edge === "roof" ? "roof" : hit.edge;
    clampHoleToBuilding(building, target);
  } else {
    target = {
      x: localX,
      y: localY,
      r: baseRadius,
      edge: hit.edge,
      seed: Math.floor((hit.x * 17 + hit.y * 31 + building.x * 7 + building.y * 11) % 100000),
      hits: 1,
    };
    clampHoleToBuilding(building, target);
    building.holes.push(target);
  }

  // Merge overlapping holes so damage becomes one larger cavity instead of disconnected stamp chains.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < building.holes.length; i += 1) {
      for (let j = i + 1; j < building.holes.length; j += 1) {
        const a = building.holes[i];
        const b = building.holes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d <= Math.max(a.r, b.r) + Math.min(a.r, b.r) * 0.72) {
          const areaA = a.r * a.r;
          const areaB = b.r * b.r;
          a.x = (a.x * areaA + b.x * areaB) / (areaA + areaB);
          a.y = (a.y * areaA + b.y * areaB) / (areaA + areaB);
          a.r = Math.min(68, Math.sqrt(areaA + areaB) * 0.82);
          a.hits = (a.hits || 1) + (b.hits || 1);
          a.edge = a.edge === "roof" || b.edge === "roof" ? "roof" : a.edge;
          clampHoleToBuilding(building, a);
          building.holes.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  if (building.holes.length > 18) building.holes.splice(0, building.holes.length - 18);
  building.damageMarks = [];
  maybeReleaseRoofDetail(building);
  maybeCollapseBuilding(hit.index);
}

function getDamageSprite(building, mark) {
  const style = Math.max(0, Math.min(damageSprites.length - 1, building.style || 0));
  const sprites = damageSprites[style];
  if (mark.edge === "roof") {
    return mark.incoming === "fromLeft" ? sprites.roofLeft : sprites.roofRight;
  }
  return mark.incoming === "fromLeft" ? sprites.wallLeft : sprites.wallRight;
}

function getHoleMaskSprite(building, mark) {
  const style = Math.max(0, Math.min(holeMaskSprites.length - 1, building.style || 0));
  const sprites = holeMaskSprites[style];
  if (mark.edge === "roof") {
    return mark.incoming === "fromLeft" ? sprites.roofLeft : sprites.roofRight;
  }
  return mark.incoming === "fromLeft" ? sprites.wallLeft : sprites.wallRight;
}

function drawBuildingDamage(building) {
  drawMaskBasedBuildingDamage(ctx, building, building.x, building.y);
}

function drawAtlasRegionTo(targetCtx, region, dx, dy, dw, dh, alpha = 1) {
  if (!spritesReady || !region) return false;
  targetCtx.save();
  targetCtx.globalAlpha *= alpha;
  targetCtx.drawImage(spriteSheet, region.x, region.y, region.w, region.h, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  targetCtx.restore();
  return true;
}

function drawRegionAnchoredTo(targetCtx, region, x, y, scale = 1, alpha = 1) {
  if (!spritesReady || !region) return false;
  targetCtx.save();
  targetCtx.globalAlpha *= alpha;
  targetCtx.translate(Math.round(x), Math.round(y));
  targetCtx.scale(scale, scale);
  targetCtx.drawImage(spriteSheet, region.x, region.y, region.w, region.h, -region.anchorX, -region.anchorY, region.w, region.h);
  targetCtx.restore();
  return true;
}

function drawTiledRegionTo(targetCtx, region, dx, dy, dw, dh) {
  if (!spritesReady || !region || dw <= 0 || dh <= 0) return false;
  const destX = Math.round(dx);
  const destY = Math.round(dy);
  const destW = Math.round(dw);
  const destH = Math.round(dh);
  const tileH = Math.max(1, Math.min(46, region.h, destH));
  let y = 0;
  while (y < destH) {
    const h = Math.min(tileH, destH - y);
    const drawH = Math.min(destH - y, h + (y + h < destH ? 1 : 0));
    const sourceH = Math.min(region.h, Math.ceil((drawH / tileH) * region.h));
    targetCtx.drawImage(spriteSheet, region.x, region.y, region.w, sourceH, destX, destY + y, destW, drawH);
    y += h;
  }
  return true;
}

function getRoofDetailPlacement(building, baseX, baseY) {
  if (building.roof === "antenna") {
    const detail = roofDetails[1];
    const scale = 0.38;
    const x = baseX + building.width / 2;
    const y = baseY - 4;
    return {
      x,
      y,
      detail,
      scale,
      left: x - detail.anchorX * scale,
      top: y - detail.anchorY * scale,
      right: x + (detail.w - detail.anchorX) * scale,
      bottom: y + (detail.h - detail.anchorY) * scale,
    };
  }
  if (building.roof === "tank") {
    const detail = roofDetails[0];
    const scale = 0.32;
    const x = baseX + building.width / 2;
    const y = baseY - 4;
    return {
      x,
      y,
      detail,
      scale,
      left: x - detail.anchorX * scale,
      top: y - detail.anchorY * scale,
      right: x + (detail.w - detail.anchorX) * scale,
      bottom: y + (detail.h - detail.anchorY) * scale,
    };
  }
  return null;
}

function rectsIntersect(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function roofDetailDestroyed(building, baseX, baseY) {
  if (building.roofDetailGone) return true;
  const placement = getRoofDetailPlacement(building, baseX, baseY);
  if (!placement || !building.holes || !building.holes.length) return false;
  return building.holes.some((hole) => {
    const hx = baseX + hole.x;
    const hy = baseY + hole.y;
    const nearestX = Math.max(placement.left, Math.min(hx, placement.right));
    const nearestY = Math.max(placement.top, Math.min(hy, placement.bottom));
    return Math.hypot(hx - nearestX, hy - nearestY) <= hole.r + 4;
  });
}

function emitPuffs(x, y, count = 3, size = 24, spreadX = 16, spreadY = 8, life = 360) {
  for (let i = 0; i < count; i += 1) {
    explosions.push({
      x: x + (random() * 2 - 1) * spreadX,
      y: y + (random() * 2 - 1) * spreadY,
      size: size * (0.8 + random() * 0.45),
      life,
      max: life,
    });
  }
}

function releaseRoofDetail(building, placement) {
  if (!building || building.roofDetailGone || !placement) return;
  building.roofDetailGone = true;
  fallingRoofDetails.push({
    x: placement.x,
    y: placement.y,
    vx: (random() - 0.5) * 1.2,
    vy: -1.8 - random() * 0.9,
    spin: (random() - 0.5) * 0.12,
    angle: 0,
    scale: placement.scale,
    detail: placement.detail,
    settleY: groundY - 4,
    bounced: false,
  });
  emitPuffs(placement.x, placement.y + 6, 2, 18, 10, 4, 280);
}

function maybeReleaseRoofDetail(building) {
  if (!building || building.roofDetailGone || building.roof === "flat") return;
  const placement = getRoofDetailPlacement(building, building.x, building.y);
  if (!placement) return;
  if (!roofDetailDestroyed(building, building.x, building.y)) return;
  releaseRoofDetail(building, placement);
}

function getBuildingStandY(building) {
  if (!building) return 0;
  return building.y + (building.topBroken ? 20 : 0);
}

function getPlayerStandX(player) {
  if (player && player.buildingIndex != null) {
    const building = buildings[player.buildingIndex];
    if (building) {
      return Math.max(building.x + 18, Math.min(building.x + building.width - 18, player.x));
    }
  }
  return player.x;
}

function getPlayerStandY(player) {
  if (player && player.buildingIndex != null) {
    const building = buildings[player.buildingIndex];
    if (building) return getBuildingStandY(building);
  }
  return player.y;
}

function settlePlayerOnCollapsedBuilding(player, building) {
  if (!player || !building || player.state === "gone" || player.state === "hurt" || player.state === "falling") return;
  const targetX = Math.max(building.x + 18, Math.min(building.x + building.width - 18, player.x));
  const targetY = getBuildingStandY(building);
  player.x = targetX;
  player.renderX = targetX;
  player.y = targetY;
  player.dropTargetY = targetY;
  if (player.state === "ready" || player.state === "dropping") {
    player.state = "dropping";
    if (typeof player.renderY !== "number") player.renderY = targetY - 10;
    player.fallVy = Math.min(player.fallVy || 0, 0);
  } else {
    player.renderY = targetY;
  }
}

function buildingHasStandingGorilla(index) {
  return players.some((player) => (
    player.buildingIndex === index &&
    player.state !== "gone" &&
    player.state !== "hurt" &&
    player.state !== "falling"
  ));
}

function collapseBuildingTop(index, collapseAmount) {
  const building = buildings[index];
  if (!building || collapseAmount <= 0) return false;
  const minRemaining = buildingHasStandingGorilla(index) ? 88 : 68;
  const amount = Math.floor(Math.min(collapseAmount, building.height - minRemaining));
  if (amount < 24) return false;

  const oldY = building.y;
  const oldPlacement = (!building.roofDetailGone && building.roof !== "flat")
    ? getRoofDetailPlacement(building, building.x, building.y)
    : null;

  spawnFallingBuildingChunk(building, amount);

  building.y += amount;
  building.height -= amount;
  building.topBroken = true;
  building.roofDetailGone = true;

  // Keep holes below the cut line, shifting them into the new building coordinate system.
  building.holes = (building.holes || [])
    .map((hole) => ({ ...hole, y: hole.y - amount }))
    .filter((hole) => hole.y > -hole.r * 0.35 && hole.y < building.height + hole.r);

  // Make the new top look busted by adding shallow mask holes along the cut edge.
  const notchCount = Math.max(3, Math.min(7, Math.round(building.width / 18)));
  for (let i = 0; i < notchCount; i += 1) {
    const t = notchCount === 1 ? 0.5 : i / (notchCount - 1);
    const wobble = (stableNoise(building.x + building.y, i + 90) - 0.5) * 10;
    building.holes.push({
      x: Math.max(10, Math.min(building.width - 10, 8 + t * (building.width - 16) + wobble)),
      y: 4 + stableNoise(building.x + building.y, i + 120) * 8,
      r: 11 + stableNoise(building.x + building.y, i + 150) * 8,
      edge: "roof",
      seed: Math.floor((building.x * 19 + building.y * 23 + i * 991) % 100000),
      hits: 1,
    });
  }
  if (building.holes.length > 22) building.holes.splice(0, building.holes.length - 22);

  if (oldPlacement) releaseRoofDetail(building, oldPlacement);

  emitPuffs(building.x + building.width / 2, oldY + amount * 0.45, 6, 32, building.width * 0.25, amount * 0.22, 390);
  for (let i = 0; i < 5; i += 1) {
    emitPuffs(building.x + (i + 0.5) * building.width / 5, building.y + 8, 1, 22, 8, 5, 300);
  }

  players.forEach((player) => {
    if (player.buildingIndex === index) settlePlayerOnCollapsedBuilding(player, building);
  });
  return true;
}

function mergeDamageIntervals(intervals, width) {
  if (!intervals.length) return [];
  intervals.sort((a, b) => a.left - b.left);
  const merged = [];
  intervals.forEach((interval) => {
    const next = {
      left: Math.max(0, Math.min(width, interval.left)),
      right: Math.max(0, Math.min(width, interval.right)),
    };
    if (next.right <= next.left) return;
    const previous = merged[merged.length - 1];
    if (previous && next.left <= previous.right + 4) {
      previous.right = Math.max(previous.right, next.right);
    } else {
      merged.push(next);
    }
  });
  return merged;
}

function getDamageCoverageAtY(building, y) {
  const intervals = [];
  (building.holes || []).forEach((hole) => {
    const dy = Math.abs(y - hole.y);
    if (dy > hole.r) return;
    const halfWidth = Math.sqrt(Math.max(0, hole.r * hole.r - dy * dy));
    intervals.push({ left: hole.x - halfWidth, right: hole.x + halfWidth });
  });

  return mergeDamageIntervals(intervals, building.width)
    .reduce((widest, interval) => Math.max(widest, interval.right - interval.left), 0);
}

function getCollapseAmountFromDamage(building, index) {
  if (!building || !building.holes || !building.holes.length) return 0;

  const minRemaining = buildingHasStandingGorilla(index) ? 88 : 68;
  const maxCollapse = Math.min(building.height - minRemaining, Math.max(38, building.height * 0.62));
  if (maxCollapse < 24) return 0;

  const baseThreshold = Math.max(34, building.width * (building.topBroken ? 0.50 : 0.56));
  let bestCut = 0;
  let bestCoverage = 0;

  for (let y = 14; y <= maxCollapse; y += 4) {
    const coverage = getDamageCoverageAtY(building, y);
    if (coverage >= baseThreshold && y > bestCut) {
      bestCut = y;
      bestCoverage = coverage;
    }
  }

  (building.holes || []).forEach((hole) => {
    const severeRoofHit = hole.edge === "roof" && (hole.r >= building.width * 0.34 || (hole.hits || 1) >= 3);
    const severeUpperHit = hole.y < maxCollapse && hole.r >= building.width * 0.42 && (hole.hits || 1) >= 2;
    if (!severeRoofHit && !severeUpperHit) return;
    const candidate = Math.min(maxCollapse, hole.y + hole.r * 0.48);
    if (candidate > bestCut) {
      bestCut = candidate;
      bestCoverage = Math.max(bestCoverage, hole.r * 1.35);
    }
  });

  const collapseAmount = Math.floor(bestCut + Math.min(18, Math.max(6, bestCoverage * 0.12)));
  return collapseAmount >= 24 ? collapseAmount : 0;
}

function maybeCollapseBuilding(index) {
  const building = buildings[index];
  const collapseAmount = getCollapseAmountFromDamage(building, index);
  if (!collapseAmount) return false;
  return collapseBuildingTop(index, collapseAmount);
}

function updateFallingRoofDetails(dt) {
  if (!fallingRoofDetails.length) return;
  const step = dt / 16;
  fallingRoofDetails = fallingRoofDetails.filter((item) => {
    item.x += item.vx * step * 2.2;
    item.y += item.vy * step * 2.2;
    item.vy += 0.22 * step;
    item.angle += item.spin * step * 3.0;

    if (item.x < -120 || item.x > W + 120) {
      return false;
    }

    if (item.y >= item.settleY) {
      item.y = item.settleY;
      if (!item.bounced) {
        item.bounced = true;
        item.vy = -Math.max(0.85, Math.abs(item.vy) * 0.34);
        item.vx *= 0.62;
        item.spin *= 0.72;
        emitPuffs(item.x, item.y + 4, 2, 16, 8, 4, 240);
        return true;
      }
      emitPuffs(item.x, item.y + 4, 3, 18, 10, 5, 280);
      return false;
    }
    return true;
  });
}

function drawFallingRoofDetails() {
  fallingRoofDetails.forEach((item) => {
    if (!spritesReady || !item.detail) return;
    ctx.save();
    ctx.translate(Math.round(item.x), Math.round(item.y));
    ctx.rotate(item.angle);
    ctx.scale(item.scale, item.scale);
    ctx.drawImage(
      spriteSheet,
      item.detail.x,
      item.detail.y,
      item.detail.w,
      item.detail.h,
      -item.detail.anchorX,
      -item.detail.anchorY,
      item.detail.w,
      item.detail.h
    );
    ctx.restore();
  });
}

function drawBuildingDamageTo(targetCtx, building, baseX, baseY) {
  drawMaskBasedBuildingDamage(targetCtx, building, baseX, baseY);
}

function scrubIsolatedPixels(ctx, x, y, w, h) {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(ctx.canvas.width - sx, Math.ceil(w)));
  const sh = Math.max(1, Math.min(ctx.canvas.height - sy, Math.ceil(h)));
  if (sw <= 0 || sh <= 0) return;
  const img = ctx.getImageData(sx, sy, sw, sh);
  const src = img.data;
  const out = new Uint8ClampedArray(src);
  const idx = (px, py) => (py * sw + px) * 4;
  for (let py = 1; py < sh - 1; py += 1) {
    for (let px = 1; px < sw - 1; px += 1) {
      const i = idx(px, py);
      if (src[i + 3] < 20) continue;
      let neighbors = 0;
      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          if (!ox && !oy) continue;
          if (src[idx(px + ox, py + oy) + 3] >= 20) neighbors += 1;
        }
      }
      if (neighbors <= 1) {
        out[i + 3] = 0;
      }
    }
  }
  img.data.set(out);
  ctx.putImageData(img, sx, sy);
}


function removeFloatingBuildingIslands(ctx, x, y, w, h) {
  const sx = Math.max(0, Math.floor(x));
  const sy = Math.max(0, Math.floor(y));
  const sw = Math.max(1, Math.min(ctx.canvas.width - sx, Math.ceil(w)));
  const sh = Math.max(1, Math.min(ctx.canvas.height - sy, Math.ceil(h)));
  if (sw <= 2 || sh <= 2) return;

  const img = ctx.getImageData(sx, sy, sw, sh);
  const data = img.data;
  const total = sw * sh;
  const solid = new Uint8Array(total);
  const keep = new Uint8Array(total);
  const queue = [];
  const idx = (px, py) => py * sw + px;

  for (let py = 0; py < sh; py += 1) {
    for (let px = 0; px < sw; px += 1) {
      const i = idx(px, py);
      if (data[i * 4 + 3] >= 24) solid[i] = 1;
    }
  }

  const seed = (px, py) => {
    if (px < 0 || px >= sw || py < 0 || py >= sh) return;
    const i = idx(px, py);
    if (!solid[i] || keep[i]) return;
    keep[i] = 1;
    queue.push(i);
  };

  // The stable structure must connect to the building base. Anything else is floating debris.
  for (let px = 0; px < sw; px += 1) {
    for (let py = sh - 1; py >= Math.max(0, sh - 8); py -= 1) {
      seed(px, py);
    }
  }

  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    const px = cur % sw;
    const py = Math.floor(cur / sw);
    seed(px + 1, py);
    seed(px - 1, py);
    seed(px, py + 1);
    seed(px, py - 1);
    // Tiny diagonals prevent 1px cracks from falsely splitting intact pixel-art trim.
    seed(px + 1, py + 1);
    seed(px - 1, py + 1);
    seed(px + 1, py - 1);
    seed(px - 1, py - 1);
  }

  for (let i = 0; i < total; i += 1) {
    if (solid[i] && !keep[i]) {
      data[i * 4 + 3] = 0;
    }
  }
  ctx.putImageData(img, sx, sy);
}


function createBuildingLayer(building, options = {}) {
  const cleanup = options.cleanup !== false;
  if (!building || building.width <= 0 || building.height <= 0) {
    const empty = document.createElement("canvas");
    empty.width = 1;
    empty.height = 1;
    return { layer: empty, padX: 0, padTop: 0, padBottom: 0 };
  }
  const sections = getBuildingSections(building);
  const atlas = buildingAtlases[building.style];
  const padX = 42;
  const padTop = 32;
  const padBottom = 12;
  const layer = document.createElement("canvas");
  layer.width = Math.ceil(building.width + padX * 2);
  layer.height = Math.ceil(building.height + padTop + padBottom);
  const layerCtx = layer.getContext("2d");
  layerCtx.imageSmoothingEnabled = false;

  const localX = padX;
  const localY = padTop;
  const buildingHeight = Math.round(building.height);

  if (building.topBroken) {
    drawTiledRegionTo(layerCtx, atlas.middle, localX, localY, building.width, sections.roofH + 4);
  } else {
    drawAtlasRegionTo(layerCtx, atlas.roof, localX, localY - 4, building.width, sections.roofH + 8);
  }
  drawTiledRegionTo(layerCtx, atlas.middle, localX, localY + sections.roofH, building.width, sections.middleH);
  drawAtlasRegionTo(layerCtx, atlas.base, localX, localY + buildingHeight - sections.baseH, building.width, sections.baseH);

  drawBuildingDamageTo(layerCtx, building, localX, localY);

  if (building.topBroken) {
    layerCtx.clearRect(Math.floor(localX - 8), Math.floor(localY - 28), Math.ceil(building.width + 16), 31);
    layerCtx.save();
    layerCtx.globalCompositeOperation = "destination-out";
    for (let x = 0; x < building.width; x += 4) {
      const depth = 3 + ((Math.floor(x / 4) + building.style) % 4) * 2;
      layerCtx.clearRect(Math.floor(localX + x), Math.floor(localY - 1), 3, depth);
    }
    layerCtx.restore();
  }

  const hideRoofDetail = roofDetailDestroyed(building, localX, localY);
  if (building.roof === "antenna" && !hideRoofDetail) {
    drawRegionAnchoredTo(layerCtx, roofDetails[1], localX + building.width / 2, localY - 4, 0.38);
  }
  if (building.roof === "tank" && !hideRoofDetail) {
    drawRegionAnchoredTo(layerCtx, roofDetails[0], localX + building.width / 2, localY - 4, 0.32);
  }

  // Final structural cleanup: remove tiny floating debris, but keep it optional so a
  // cleanup failure never aborts the full frame or makes unrelated buildings disappear.
  if (cleanup) {
    removeFloatingBuildingIslands(layerCtx, localX - 3, localY - 6, building.width + 6, building.height + 12);
    scrubIsolatedPixels(layerCtx, localX - 4, localY - 10, building.width + 8, Math.min(building.height + 16, 180));
  }

  return { layer, padX, padTop, padBottom };
}

function spawnFallingBuildingChunk(building, collapseAmount) {
  if (!spritesReady || collapseAmount <= 0) return;
  const oldLayer = createBuildingLayer(building, { cleanup: false });
  const chunkHeight = Math.max(24, Math.min(oldLayer.layer.height, Math.ceil(collapseAmount + oldLayer.padTop + 18)));
  const chunkCanvas = document.createElement("canvas");
  chunkCanvas.width = oldLayer.layer.width;
  chunkCanvas.height = chunkHeight;
  const chunkCtx = chunkCanvas.getContext("2d");
  chunkCtx.imageSmoothingEnabled = false;
  chunkCtx.drawImage(oldLayer.layer, 0, 0, oldLayer.layer.width, chunkHeight, 0, 0, oldLayer.layer.width, chunkHeight);

  fallingBuildingChunks.push({
    image: chunkCanvas,
    x: Math.round(building.x - oldLayer.padX),
    y: Math.round(building.y - oldLayer.padTop),
    vx: (random() - 0.5) * 0.9,
    vy: -0.8 - random() * 0.6,
    angle: 0,
    spin: (random() - 0.5) * 0.03,
    smokeTimer: 0,
  });
}

function addCollapsedTopDamage(building) {
  const positions = [];
  const count = Math.max(3, Math.min(6, Math.round(building.width / 22)));
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    positions.push(Math.round(12 + t * (building.width - 24)));
  }
  positions.forEach((x, i) => {
    building.damageMarks.push({
      x,
      y: 6,
      edge: "roof",
      incoming: i % 2 === 0 ? "fromLeft" : "fromRight",
      size: 16,
      depth: 0,
      rim: false,
    });
    building.damageMarks.push({
      x: Math.max(10, Math.min(building.width - 10, x + (i % 2 === 0 ? 5 : -5))),
      y: 12,
      edge: "roof",
      incoming: i % 2 === 0 ? "fromLeft" : "fromRight",
      size: 16,
      depth: 1,
      rim: false,
    });
  });
  if (building.damageMarks.length > 56) {
    building.damageMarks.splice(0, building.damageMarks.length - 56);
  }
}

function updateFallingBuildingChunks(dt) {
  if (!fallingBuildingChunks.length) return;
  const step = dt / 16;
  fallingBuildingChunks = fallingBuildingChunks.filter((item) => {
    item.x += item.vx * step * 2.0;
    item.y += item.vy * step * 2.7;
    item.vy += 0.22 * step;
    item.angle += item.spin * step * 3.0;
    item.smokeTimer = (item.smokeTimer || 0) - dt;
    if (item.smokeTimer <= 0) {
      item.smokeTimer = 58 + random() * 42;
      const smokeX = item.x + item.image.width * (0.28 + random() * 0.44);
      const smokeY = item.y + item.image.height * (0.20 + random() * 0.55);
      emitPuffs(smokeX, smokeY, 1, 20 + random() * 12, 8, 7, 300);
    }
    if (item.y > H + 180 || item.x < -300 || item.x > W + 300) {
      emitPuffs(item.x + item.image.width / 2, H - 24, 3, 18, 20, 8, 240);
      return false;
    }
    return true;
  });
}

function drawFallingBuildingChunks() {
  fallingBuildingChunks.forEach((item) => {
    if (!item.image) return;
    ctx.save();
    ctx.translate(Math.round(item.x + item.image.width / 2), Math.round(item.y + item.image.height / 2));
    ctx.rotate(item.angle);
    ctx.drawImage(item.image, -item.image.width / 2, -item.image.height / 2);
    ctx.restore();
  });
}

function topAt(x) {
  const b = buildings.find((building) => x >= building.x && x <= building.x + building.width);
  return b ? b.y : groundY;
}

function resetRound(keepScore = true) {
  seed = (Date.now() + round * 733) % 999999;
  generatePlayableRound();

  makeClouds();
  makeCars();
  banana = null;
  explosions = [];
  fallingRoofDetails = [];
  fallingBuildingChunks = [];
  currentPlayer = keepScore ? currentPlayer : 0;
  locked = false;
  shake = 0;
  pendingWinner = null;
  roundResetQueued = false;
  resetAllShotSettingsToDefaults();
  loadCurrentShotSettings();
  updateUi();
  setStatus(`${players[currentPlayer].name}, set angle and velocity.`);
}

function setStatus(text) {
  ui.status.textContent = text;
}

function updateUi() {
  ui.angleOut.value = ui.angle.value;
  ui.velocityOut.value = ui.velocity.value;
  ui.wind.textContent = `${wind > 0 ? "Wind ->" : "Wind <-"} ${Math.abs(wind).toFixed(1)}`;
  ui.p1Score.textContent = scores[0];
  ui.p2Score.textContent = scores[1];
  ui.round.textContent = `Round ${round}`;
  ui.aimToggle.textContent = aimAssistOn ? "Aim Dots On" : "Aim Dots Off";
  ui.aimToggle.setAttribute("aria-pressed", String(aimAssistOn));
  ui.throwButton.disabled = locked;
}

function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawSprite(key, x, y, scale = 1, flip = 1, alpha = 1) {
  const sprite = sprites[key];
  if (!spritesReady || !sprite) return false;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(flip * scale, scale);
  ctx.drawImage(
    spriteSheet,
    sprite.x,
    sprite.y,
    sprite.w,
    sprite.h,
    -sprite.anchorX,
    -sprite.anchorY,
    sprite.w,
    sprite.h
  );
  ctx.restore();
  return true;
}

function drawActionSprite(player, sequence) {
  const colorKey = player.side === 1 ? "brown" : "blue";
  const frames = actionSprites[`${colorKey}${sequence}`];
  const frameIndex = Math.max(0, Math.min(frames.length - 1, player.actionFrame || 0));
  const sprite = frames[frameIndex];
  if (!actionSpritesReady || !sprite) return false;
  ctx.save();
  ctx.translate(Math.round(player.renderX), Math.round(player.renderY + 4));
  ctx.scale(player.side * actionScale, actionScale);
  ctx.drawImage(
    actionSheet,
    sprite.x,
    sprite.y,
    sprite.w,
    sprite.h,
    -sprite.anchorX,
    -sprite.anchorY,
    sprite.w,
    sprite.h
  );
  ctx.restore();
  return true;
}

function getGorillaSpriteKey(player) {
  return player.side === 1 ? "brownReady" : "blueReady";
}

function getGorillaRenderY(player) {
  if (player.state !== "ready") return player.renderY;
  return getPlayerStandY(player) + 4 + Math.sin(performance.now() / 250 + player.bob) * 1.5;
}

function getGorillaHitBox(player) {
  const sprite = sprites[getGorillaSpriteKey(player)];
  const x = player.x;
  const y = player.y + 4;
  const left = player.side === 1
    ? x - sprite.anchorX * gorillaScale + 10
    : x - (sprite.w - sprite.anchorX) * gorillaScale + 10;
  const right = player.side === 1
    ? x + (sprite.w - sprite.anchorX) * gorillaScale - 8
    : x + sprite.anchorX * gorillaScale - 8;
  const top = y - sprite.anchorY * gorillaScale + 12;
  const bottom = y + (sprite.h - sprite.anchorY) * gorillaScale - 2;
  return { left, right, top, bottom };
}

function pointInRect(x, y, rect, padding = 0) {
  return x >= rect.left - padding && x <= rect.right + padding && y >= rect.top - padding && y <= rect.bottom + padding;
}

function segmentIntersectsRect(x1, y1, x2, y2, rect, padding = 0) {
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const steps = Math.max(1, Math.ceil(distance / 5));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (pointInRect(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rect, padding)) return true;
  }
  return false;
}

function simulatedBananaStillLeavingThrower(age, x, y, launchX, launchY) {
  return age < 34 || Math.hypot(x - launchX, y - launchY) < 74;
}

function simulatedBuildingHit(prevX, prevY, x, y) {
  let hit = findBuildingImpact(prevX, prevY, x, y);
  if (!hit) hit = pointInBuilding(x, y);
  return hit;
}

function shotHitsPlayer(shooterIndex, targetIndex, angleValue, velocityValue) {
  const shooter = players[shooterIndex];
  const target = players[targetIndex];
  if (!shooter || !target) return false;

  const angle = angleValue * Math.PI / 180;
  const speed = velocityValue * throwScale;
  const launchX = shooter.x + shooter.side * shotStartOffset.x;
  const launchY = shooter.y + shotStartOffset.y;
  let x = launchX;
  let y = launchY;
  let vx = Math.cos(angle) * speed * shooter.side;
  let vy = -Math.sin(angle) * speed;
  const targetBox = getGorillaHitBox(target);
  const ownerBuildingIndex = shooter.buildingIndex;

  for (let tick = 0; tick < 1200; tick += 1) {
    const prevX = x;
    const prevY = y;
    x += vx;
    y += vy;
    vx += wind * windScale;
    vy += gravity;

    if (segmentIntersectsRect(prevX, prevY, x, y, targetBox, 7)) return true;
    if (x < -90 || x > W + 90 || y > H + 90) return false;

    const buildingHit = simulatedBuildingHit(prevX, prevY, x, y);
    if (buildingHit) {
      const leavingThrower = simulatedBananaStillLeavingThrower(tick, x, y, launchX, launchY);
      if (leavingThrower && buildingHit.index === ownerBuildingIndex) {
        continue;
      }
      return false;
    }

    if (y >= groundY) return false;
  }
  return false;
}

function playerHasShot(shooterIndex) {
  const targetIndex = shooterIndex === 0 ? 1 : 0;

  // First pass: the normal player-facing range. This catches most fair shots quickly.
  for (let velocity = 30; velocity <= velocityMax; velocity += 5) {
    for (let angle = 5; angle <= 89; angle += 2) {
      if (shotHitsPlayer(shooterIndex, targetIndex, angle, velocity)) return true;
    }
  }

  // Second pass: a finer sweep for weird but still playable skylines.
  for (let velocity = 22; velocity <= velocityMax; velocity += 3) {
    for (let angle = 2; angle <= 89; angle += 1) {
      if (shotHitsPlayer(shooterIndex, targetIndex, angle, velocity)) return true;
    }
  }

  return false;
}

function roundHasPlayableShots() {
  return playerHasShot(0) && playerHasShot(1);
}

function softenSkylineForPlayability() {
  if (players.length < 2) return;
  const leftPlayer = players[0];
  const rightPlayer = players[1];
  const leftX = Math.min(leftPlayer.x, rightPlayer.x);
  const rightX = Math.max(leftPlayer.x, rightPlayer.x);
  const playerBuildingIndexes = new Set(players.map((player) => player.buildingIndex));
  const highestPlayerRoofY = Math.min(leftPlayer.y, rightPlayer.y);

  buildings.forEach((building, index) => {
    if (playerBuildingIndexes.has(index)) {
      building.roof = "flat";
      building.damageMarks = [];
        building.holes = [];
      return;
    }

    const center = building.x + building.width / 2;
    const betweenPlayers = center > leftX - 24 && center < rightX + 24;
    const closeToLeftLaunch = Math.abs(center - leftPlayer.x) < 125;
    const closeToRightLaunch = Math.abs(center - rightPlayer.x) < 125;
    const tooTallNearShotPath = building.y < highestPlayerRoofY + 78;

    if (betweenPlayers && tooTallNearShotPath) {
      const maxHeight = 116 + Math.floor(random() * 50);
      building.height = Math.min(building.height, maxHeight);
      building.y = groundY - building.height;
      building.roof = random() > 0.72 ? "antenna" : "flat";
      building.damageMarks = [];
        building.holes = [];
    }

    if ((closeToLeftLaunch || closeToRightLaunch) && building.y < highestPlayerRoofY + 44) {
      const maxHeight = 96 + Math.floor(random() * 42);
      building.height = Math.min(building.height, maxHeight);
      building.y = groundY - building.height;
      building.roof = "flat";
      building.damageMarks = [];
        building.holes = [];
    }
  });
}


function addSkylineDramaAwayFromLaunchLanes() {
  if (players.length < 2) return;
  const playerBuildingIndexes = new Set(players.map((player) => player.buildingIndex));
  const protectedRanges = players.map((player) => {
    const launchX = player.x + player.side * shotStartOffset.x;
    const start = Math.min(player.x - 38, launchX + player.side * 125);
    const end = Math.max(player.x + 38, launchX + player.side * 125);
    return { start, end };
  });

  buildings.forEach((building, index) => {
    if (playerBuildingIndexes.has(index)) return;
    const center = building.x + building.width / 2;
    const protectedLane = protectedRanges.some((range) => center >= range.start && center <= range.end);
    if (protectedLane) return;

    const nearMiddle = 1 - Math.min(1, Math.abs(center - W / 2) / (W / 2));
    const alreadyTall = building.height > 245;
    const shouldBoost = alreadyTall || random() < 0.13 + nearMiddle * 0.16;
    if (!shouldBoost) return;

    const boost = 24 + Math.floor(random() * (alreadyTall ? 42 : 82));
    building.height = Math.min(358, building.height + boost);
    building.y = groundY - building.height;
    building.roof = random() > 0.45 ? building.roof : (random() > 0.5 ? "antenna" : "tank");
    building.damageMarks = [];
        building.holes = [];
  });
}

function clearLaunchBlockers() {
  if (players.length < 2) return;
  const clearDistance = 118;
  const rearTolerance = 10;

  players.forEach((player) => {
    const launchX = player.x + player.side * shotStartOffset.x;
    const launchY = player.y + shotStartOffset.y;
    const start = Math.min(launchX - rearTolerance, launchX + player.side * clearDistance);
    const end = Math.max(launchX - rearTolerance, launchX + player.side * clearDistance);

    buildings.forEach((building, index) => {
      if (index === player.buildingIndex) return;
      const overlapsLaunchLane = building.x < end && building.x + building.width > start;
      if (!overlapsLaunchLane) return;

      const nearEdge = player.side === 1
        ? Math.max(0, building.x - launchX)
        : Math.max(0, launchX - (building.x + building.width));

      // Only protect the first small launch lane. Let the rest of the city stay dramatic.
      const distanceT = Math.min(1, nearEdge / clearDistance);
      const allowedTop = Math.min(groundY - 42, launchY + 38 + distanceT * 58);

      if (building.y < allowedTop) {
        building.y = allowedTop;
        building.height = Math.max(46, groundY - building.y);
        building.roof = random() > 0.84 ? "antenna" : "flat";
        building.damageMarks = [];
        building.holes = [];
        building.skylineRole = "launch-clear";
      }
    });
  });
}

function hasImmediateLaunchBlocker(playerIndex) {
  const player = players[playerIndex];
  if (!player) return true;
  const launchX = player.x + player.side * shotStartOffset.x;
  const launchY = player.y + shotStartOffset.y;
  const lowAngles = [8, 12, 18, 24, 30, 38, 46, 55, 65, 75];
  const testVelocity = 82;

  return lowAngles.every((angleValue) => {
    const angle = angleValue * Math.PI / 180;
    let x = launchX;
    let y = launchY;
    let vx = Math.cos(angle) * testVelocity * throwScale * player.side;
    let vy = -Math.sin(angle) * testVelocity * throwScale;

    for (let tick = 0; tick < 46; tick += 1) {
      const prevX = x;
      const prevY = y;
      x += vx;
      y += vy;
      vx += wind * windScale;
      vy += gravity;
      const hit = simulatedBuildingHit(prevX, prevY, x, y);
      if (hit && hit.index !== player.buildingIndex) return true;
      if (Math.abs(x - launchX) > 155 || y < 0) return false;
    }
    return false;
  });
}

function launchLanesAreClear() {
  return !hasImmediateLaunchBlocker(0) && !hasImmediateLaunchBlocker(1);
}

function generatePlayableRound() {
  // Buildings are destroyable now, so do not reject skylines just because
  // there is not a guaranteed mathematical shot between the gorillas.
  // Keep only the small launch-lane cleanup so a banana can leave the hand
  // without instantly detonating on a neighboring wall.
  let attempts = 0;
  while (attempts < 24) {
    makeCity();
    makePlayers();
    const direction = random() > 0.5 ? 1 : -1;
    wind = direction * (1.0 + Math.round(random() * 8) / 10);
    addSkylineDramaAwayFromLaunchLanes();
    clearLaunchBlockers();
    attempts += 1;
    if (launchLanesAreClear()) return attempts;
  }

  // Last resort: accept the skyline after the local launch cleanup. Do not
  // flatten or soften the city to force a clean shot path.
  clearLaunchBlockers();
  return attempts;
}

function drawAtlasRegion(region, dx, dy, dw, dh, alpha = 1) {
  if (!spritesReady || !region) return false;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(spriteSheet, region.x, region.y, region.w, region.h, Math.round(dx), Math.round(dy), Math.round(dw), Math.round(dh));
  ctx.restore();
  return true;
}

function drawRegionAnchored(region, x, y, scale = 1, alpha = 1) {
  if (!spritesReady || !region) return false;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(scale, scale);
  ctx.drawImage(spriteSheet, region.x, region.y, region.w, region.h, -region.anchorX, -region.anchorY, region.w, region.h);
  ctx.restore();
  return true;
}

function drawTiledRegion(region, dx, dy, dw, dh) {
  if (!spritesReady || !region || dw <= 0 || dh <= 0) return false;
  const tileH = Math.min(46, dh);
  let y = dy;
  while (y < dy + dh - 0.5) {
    const h = Math.min(tileH, dy + dh - y);
    const sy = region.y + Math.floor(((y - dy) % region.h) / region.h * region.h);
    const sh = Math.min(region.h - (sy - region.y), Math.round(h / tileH * region.h));
    ctx.drawImage(spriteSheet, region.x, sy, region.w, sh, Math.round(dx), Math.round(y), Math.round(dw), Math.ceil(h));
    y += h;
  }
  return true;
}

function drawMoon(x, y, scale = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(scale, scale);

  const glow = ctx.createRadialGradient(0, 0, 14, 0, 0, 74);
  glow.addColorStop(0, "rgba(255, 228, 120, 0.34)");
  glow.addColorStop(0.55, "rgba(255, 206, 82, 0.16)");
  glow.addColorStop(1, "rgba(255, 206, 82, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, 72, 0, Math.PI * 2);
  ctx.fill();

  const body = ctx.createRadialGradient(-12, -16, 6, 0, 0, 56);
  body.addColorStop(0, "#fff3a5");
  body.addColorStop(0.42, "#ffd96a");
  body.addColorStop(0.75, "#f5b54f");
  body.addColorStop(1, "#db8d2a");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 241, 168, 0.72)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();

  const craters = [
    [-18, -16, 10, "rgba(212, 131, 36, 0.35)"],
    [8, -20, 8, "rgba(194, 114, 28, 0.28)"],
    [18, -6, 12, "rgba(210, 132, 34, 0.32)"],
    [-8, 10, 9, "rgba(221, 150, 44, 0.26)"],
    [20, 18, 7, "rgba(196, 112, 28, 0.26)"],
    [-24, 18, 8, "rgba(204, 126, 36, 0.24)"],
    [0, 28, 11, "rgba(184, 102, 23, 0.20)"],
  ];
  craters.forEach(([cx, cy, radius, color]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 230, 135, 0.16)";
    ctx.beginPath();
    ctx.arc(cx - radius * 0.2, cy - radius * 0.2, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function coverSkylineMoonArtifact() {
  const skyPatch = ctx.createLinearGradient(0, 0, 0, H);
  skyPatch.addColorStop(0, "#211a5b");
  skyPatch.addColorStop(0.45, "#ca4d84");
  skyPatch.addColorStop(0.72, "#ffbd57");
  skyPatch.addColorStop(1, "#2b1842");

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(672, 318, 58, 24, 0, 0, Math.PI * 2);
  ctx.ellipse(780, 306, 46, 16, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = skyPatch;
  ctx.fillRect(600, 286, 230, 66);
  ctx.restore();
}

function drawSky(dt) {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#211a5b");
  gradient.addColorStop(0.45, "#ca4d84");
  gradient.addColorStop(0.72, "#ffbd57");
  gradient.addColorStop(1, "#2b1842");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  if (spritesReady) {
    ctx.globalAlpha = 0.44;
    drawSprite("skyline", 0, H - 245, 0.8, 1);
    ctx.globalAlpha = 1;
    coverSkylineMoonArtifact();
  }

  drawMoon(768, 68, 0.72);

  clouds.forEach((cloud) => {
    cloud.x += (cloud.speed * dt) / 1000;
    if (cloud.x > W + 80) cloud.x = -100;
    if (spritesReady) {
      drawSprite(cloud.sprite, cloud.x, cloud.y, cloud.scale * 0.55, 1, 0.72);
    } else {
      ctx.globalAlpha = 0.34;
      drawPixelRect(cloud.x, cloud.y, 58 * cloud.scale, 12 * cloud.scale, cloud.tint);
      drawPixelRect(cloud.x + 18 * cloud.scale, cloud.y - 10 * cloud.scale, 46 * cloud.scale, 12 * cloud.scale, cloud.tint);
      drawPixelRect(cloud.x + 52 * cloud.scale, cloud.y + 2 * cloud.scale, 40 * cloud.scale, 10 * cloud.scale, cloud.tint);
      ctx.globalAlpha = 1;
    }
  });
}

function updateCars(dt) {
  if (!cars.length) return;
  cars.forEach((car) => {
    car.x += (car.speed * dt) / 1000;
    car.phase += dt / 130;
    if (car.speed > 0 && car.x > W + 42) car.x = -46 - random() * 160;
    if (car.speed < 0 && car.x < -46) car.x = W + 42 + random() * 160;
  });
}

function drawCar(car) {
  const dir = Math.sign(car.speed) || 1;
  const x = Math.round(car.x);
  const y = Math.round(car.y + Math.sin(car.phase) * 0.5);
  const frame = car.sprite % 5;

  ctx.save();
  ctx.translate(x, y);
  if (carSpritesReady) {
    ctx.scale(-dir, 1);
    ctx.drawImage(carSheet, frame * 32, 0, 32, 18, -16, -16, 32, 18);
  }
  ctx.restore();
}

function drawTraffic(dt) {
  updateCars(dt);
  drawPixelRect(0, groundY + 6, W, H - groundY - 6, "#15122a");
  drawPixelRect(0, groundY + 17, W, 1, "rgba(255, 207, 70, 0.55)");
  cars
    .slice()
    .sort((a, b) => a.y - b.y)
    .forEach(drawCar);
}

function drawBuildings() {
  buildings.forEach((b, index) => {
    const sections = getBuildingSections(b);
    if (spritesReady) {
      let rendered;
      try {
        rendered = createBuildingLayer(b, { cleanup: true });
      } catch (error) {
        console.error("Building render cleanup failed; using safe fallback", error, b);
        rendered = createBuildingLayer(b, { cleanup: false });
      }
      ctx.drawImage(rendered.layer, Math.round(b.x - rendered.padX), Math.round(b.y - rendered.padTop));
      return;
    }

    drawPixelRect(b.x, b.y, b.width, b.height, b.color);
    drawPixelRect(b.x, b.y, b.width, 5, "#91e8ff");
    drawPixelRect(b.x + 4, b.y + 8, b.width - 8, b.height - 8, "rgba(6, 10, 31, 0.16)");
    const hideRoofDetail = roofDetailDestroyed(b, b.x, b.y);
    if (b.roof === "antenna" && !hideRoofDetail) {
      drawPixelRect(b.x + b.width / 2 - 2, b.y - 22, 4, 22, "#a8e8ff");
      drawPixelRect(b.x + b.width / 2 - 10, b.y - 13, 20, 3, "#f8df66");
    }
    if (b.roof === "tank" && !hideRoofDetail) {
      drawPixelRect(b.x + b.width / 2 - 12, b.y - 13, 24, 10, "#3a2856");
      drawPixelRect(b.x + b.width / 2 - 8, b.y - 3, 16, 3, "#a8e8ff");
    }

    const rows = Math.floor((b.height - 26) / 22);
    const cols = Math.floor((b.width - 12) / 16);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * 7 + c * 5 + index) % (b.lit ? 3 : 5) === 0) {
          drawPixelRect(b.x + 8 + c * 16, b.y + 18 + r * 22, 7, 10, "#ffe15b");
        } else {
          drawPixelRect(b.x + 8 + c * 16, b.y + 18 + r * 22, 7, 10, "#152448");
        }
      }
    }
    drawBuildingDamage(b);
  });
  drawPixelRect(0, groundY, W, H - groundY, "#171329");
  drawPixelRect(0, groundY, W, 6, "#7be3de");
}

function drawGorilla(player, active) {
  if (player.state === "gone") return;

  if (player.state === "throwing") {
    if (drawActionSprite(player, "Throw")) return;
  }

  if (player.state === "hurt" || player.state === "falling") {
    if (drawActionSprite(player, "Hurt")) return;
  }

  const x = player.state === "ready" ? getPlayerStandX(player) : player.renderX;
  const y = getGorillaRenderY(player);
  const flip = player.side;
  const spriteKey = getGorillaSpriteKey(player);

  if (drawSprite(spriteKey, x, y, gorillaScale, flip)) return;

  const armRaise = active && !locked ? -8 : 0;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y - 32));
  ctx.scale(flip, 1);
  drawPixelRect(-15, 0, 30, 30, player.color);
  drawPixelRect(-18, 12, 36, 20, "#5a3420");
  drawPixelRect(-11, -14, 22, 20, player.color);
  drawPixelRect(-7, -7, 14, 9, "#d99b5d");
  drawPixelRect(-9, -10, 5, 5, "#241626");
  drawPixelRect(4, -10, 5, 5, "#241626");
  drawPixelRect(-2, -2, 4, 3, "#241626");
  drawPixelRect(14, 4 + armRaise, 10, 25, player.color);
  drawPixelRect(-24, 8, 10, 23, player.color);
  drawPixelRect(-13, 29, 11, 10, "#3b2418");
  drawPixelRect(3, 29, 11, 10, "#3b2418");
  if (active && !locked && player.state === "ready") {
    drawPixelRect(22, -2 + armRaise, 15, 6, "#ffe15b");
  }
  ctx.restore();
}

function startHurtFall(targetIndex, impactVx) {
  const player = players[targetIndex];
  player.state = "hurt";
  player.animTime = 0;
  player.actionFrame = 0;
  player.released = true;
  player.pendingShot = null;
  player.renderX = player.x;
  player.renderY = player.y;
  const direction = Math.sign(impactVx || player.side) || player.side;
  player.fallVx = direction * 1.15;
  player.fallVy = -1.35;
}

function updatePlayers(dt) {
  players.forEach((player) => {
    if (player.state === "gone") return;
    if (player.state === "ready") {
      player.x = getPlayerStandX(player);
      player.y = getPlayerStandY(player);
      player.renderX = player.x;
      player.renderY = player.y;
      player.dropTargetY = player.y;
      return;
    }
    player.animTime += dt;

    if (player.state === "dropping") {
      player.x = getPlayerStandX(player);
      player.dropTargetY = getPlayerStandY(player);
      player.renderX = player.x;
      player.renderY += player.fallVy * (dt / 16) * 3.0;
      player.fallVy += 0.18 * (dt / 16);
      if (player.renderY >= player.dropTargetY) {
        player.renderY = player.dropTargetY;
        player.state = "ready";
        player.animTime = 0;
        player.fallVy = 0;
      }
      return;
    }

    if (player.state === "throwing") {
      player.actionFrame = Math.min(4, Math.floor(player.animTime / 100));
      if (!player.released && player.animTime >= 280) {
        launchPendingBanana(player);
      }
      if (player.animTime >= 540) {
        player.state = "ready";
        player.actionFrame = 0;
        player.animTime = 0;
        player.pendingShot = null;
        player.released = false;
        player.renderX = player.x;
        player.renderY = player.y;
      }
      return;
    }

    if (player.state === "hurt") {
      if (player.animTime < 140) {
        player.actionFrame = 0;
      } else if (player.animTime < 280) {
        player.actionFrame = 1;
      } else if (player.animTime < 460) {
        player.actionFrame = 2;
        player.renderX += player.fallVx * (dt / 16) * 1.3;
      } else {
        player.state = "falling";
        player.animTime = 0;
        player.actionFrame = 3;
      }
      return;
    }

    if (player.state === "falling") {
      player.actionFrame = player.animTime < 280 ? 3 : 4;
      player.renderX += player.fallVx * (dt / 16) * 3.0;
      player.renderY += player.fallVy * (dt / 16) * 3.0;
      player.fallVy += 0.18 * (dt / 16);

      if (
        player.renderY > H + 140 ||
        player.renderX < -180 ||
        player.renderX > W + 180 ||
        player.animTime > 1600
      ) {
        player.state = "gone";
        if (pendingWinner !== null && !roundResetQueued) {
          roundResetQueued = true;
          const winner = pendingWinner;
          setTimeout(() => {
            pendingWinner = null;
            roundResetQueued = false;
            round += 1;
            currentPlayer = winner;
            resetRound(true);
          }, 260);
        }
      }
    }
  });
}

function drawBanana() {
  if (!banana) return;
  ctx.save();
  ctx.translate(banana.x, banana.y);
  ctx.rotate(banana.spin);
  const frame = Math.abs(Math.floor(banana.spin * 2)) % 2 === 0 ? "banana" : "bananaSpin";
  if (spritesReady) {
    const sprite = sprites[frame];
    const scale = frame === "banana" ? 0.38 : 0.32;
    ctx.scale(scale, scale);
    ctx.drawImage(spriteSheet, sprite.x, sprite.y, sprite.w, sprite.h, -sprite.anchorX, -sprite.anchorY, sprite.w, sprite.h);
    ctx.restore();
    return;
  }
  drawPixelRect(-8, -3, 16, 6, "#ffe15b");
  drawPixelRect(-10, -1, 4, 4, "#6c3a21");
  drawPixelRect(7, -2, 4, 4, "#fff58c");
  ctx.restore();
}

function drawExplosions(dt) {
  explosions = explosions.filter((boom) => {
    boom.life -= dt;
    const t = Math.max(0, boom.life / boom.max);
    const size = (1 - t) * boom.size;
    if (spritesReady) {
      const key = boom.size > 70 ? "boom" : "puff";
      const pulse = 0.36 + (1 - t) * (boom.size > 70 ? 0.7 : 0.28);
      drawSprite(key, boom.x, boom.y, pulse, 1, t);
      return boom.life > 0;
    }
    ctx.globalAlpha = t;
    drawPixelRect(boom.x - size / 2, boom.y - size / 2, size, size, "#fff27b");
    drawPixelRect(boom.x - size * 0.7, boom.y - size * 0.15, size * 1.4, size * 0.32, "#ff7a3c");
    drawPixelRect(boom.x - size * 0.2, boom.y - size * 0.7, size * 0.4, size * 1.4, "#e7436f");
    ctx.globalAlpha = 1;
    return boom.life > 0;
  });
}

function drawHudTrajectory() {
  if (locked || !aimAssistOn) return;
  const p = players[currentPlayer];
  const angle = Number(ui.angle.value) * Math.PI / 180;
  const speed = Number(ui.velocity.value) * throwScale;
  let vx = Math.cos(angle) * speed * p.side;
  let vy = -Math.sin(angle) * speed;
  let x = p.x + p.side * 30;
  let y = p.y - 34;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 55; i++) {
    if (i % 6 === 0) drawPixelRect(x, y, 4, 4, "#fff8d8");
    x += vx * 4;
    y += vy * 4;
    vx += wind * windScale * 4;
    vy += gravity * 4;
  }
  ctx.globalAlpha = 1;
}

function drawOverlayText() {
  ctx.font = "900 22px Trebuchet MS, Arial";
  ctx.fillStyle = "#110a1b";
  ctx.fillText("BANANA BLITZ DX", 24, 36);
  ctx.fillStyle = "#ffe15b";
  ctx.fillText("BANANA BLITZ DX", 22, 34);
  ctx.font = "800 14px Trebuchet MS, Arial";
  ctx.fillStyle = "#fff8d8";
  const p = players[currentPlayer];
  ctx.fillText(`${p.name}  Angle ${ui.angle.value}  Velocity ${ui.velocity.value}`, 22, 58);
}

function render(time = 0) {
  const dt = Math.min(32, time - lastTime || 16);
  lastTime = time;
  updateShot(dt);
  updatePlayers(dt);
  updateFallingRoofDetails(dt);
  updateFallingBuildingChunks(dt);

  ctx.save();
  const bump = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
  if (shake > 0) shake *= 0.86;
  ctx.translate(bump, -bump);
  drawSky(dt);
  drawBuildings();
  drawTraffic(dt);
  drawFallingBuildingChunks();
  drawFallingRoofDetails();
  drawHudTrajectory();
  players.forEach((player, index) => drawGorilla(player, index === currentPlayer));
  drawBanana();
  drawExplosions(dt);
  drawOverlayText();
  ctx.restore();
  requestAnimationFrame(render);
}

function launchPendingBanana(player) {
  if (!player.pendingShot) return;
  const shot = player.pendingShot;
  player.released = true;
  banana = {
    x: player.x + player.side * shotStartOffset.x,
    y: player.y + shotStartOffset.y,
    prevX: player.x + player.side * shotStartOffset.x,
    prevY: player.y + shotStartOffset.y,
    vx: Math.cos(shot.angle) * shot.speed * player.side,
    vy: -Math.sin(shot.angle) * shot.speed,
    spin: 0,
    owner: currentPlayer,
    ownerBuildingIndex: player.buildingIndex,
    launchX: player.x + player.side * shotStartOffset.x,
    launchY: player.y + shotStartOffset.y,
    age: 0,
  };
  setStatus(`${player.name} lets it rip.`);
}

function throwBanana() {
  if (locked || pendingWinner !== null) return;
  saveCurrentShotSettings();
  locked = true;
  updateUi();
  const player = players[currentPlayer];
  const angle = Number(ui.angle.value) * Math.PI / 180;
  const speed = Number(ui.velocity.value) * throwScale;
  player.state = "throwing";
  player.animTime = 0;
  player.actionFrame = 0;
  player.renderX = player.x;
  player.renderY = player.y;
  player.released = false;
  player.pendingShot = { angle, speed };
  setStatus(`${player.name} winds up...`);
}

function updateShot(dt) {
  if (!banana) return;
  const step = dt / 10;
  for (let i = 0; i < step; i++) {
    banana.prevX = banana.x;
    banana.prevY = banana.y;
    banana.x += banana.vx;
    banana.y += banana.vy;
    banana.vx += wind * windScale;
    banana.vy += gravity;
    banana.spin += 0.13 * Math.sign(banana.vx || 1);
    banana.age += 1;
    if (checkCollision()) break;
  }
}

function bananaLaunchDistance() {
  if (!banana) return 0;
  const dx = banana.x - (banana.launchX ?? banana.x);
  const dy = banana.y - (banana.launchY ?? banana.y);
  return Math.hypot(dx, dy);
}

function bananaIsStillLeavingThrower() {
  if (!banana) return false;
  return banana.age < 34 || bananaLaunchDistance() < 74;
}

function checkCollision() {
  if (!banana) return false;
  if (banana.x < -40 || banana.x > W + 40 || banana.y > H + 80) {
    miss();
    return true;
  }

  const leavingThrower = bananaIsStillLeavingThrower();

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (i === banana.owner && leavingThrower) continue;
    if (segmentIntersectsRect(banana.prevX, banana.prevY, banana.x, banana.y, getGorillaHitBox(p), 8)) {
      hit(i);
      return true;
    }
  }

  let buildingHit = findBuildingImpact(banana.prevX, banana.prevY, banana.x, banana.y);
  if (!buildingHit) {
    buildingHit = pointInBuilding(banana.x, banana.y);
  }
  if (buildingHit) {
    // Prevent the throw from instantly colliding with the roof/building the gorilla is standing on.
    // This was causing the banana to explode in the thrower's face.
    if (leavingThrower && buildingHit.index === banana.ownerBuildingIndex) {
      return false;
    }

    banana.x = buildingHit.x;
    banana.y = buildingHit.y;
    addBuildingDamage(buildingHit, banana.vx);
    explode(buildingHit.x, buildingHit.y, 52);
    miss("Building hit!");
    return true;
  }

  if (banana.y >= groundY) {
    explode(banana.x, banana.y, 52);
    miss();
    return true;
  }
  return false;
}

function explode(x, y, size) {
  explosions.push({ x, y, size, life: 520, max: 520 });
  shake = 10;
}

function maybeTearDownHitGorillaBuilding(targetIndex, impactX, impactY, impactVx) {
  const player = players[targetIndex];
  if (!player || player.buildingIndex == null) return false;
  const building = buildings[player.buildingIndex];
  if (!building || building.height < 112) return false;

  const hitNearRoof = impactY < building.y + 96;
  const heavyHit = Math.abs(impactVx) > 3.6;
  const chance = hitNearRoof ? 0.66 : 0.38;
  if (!heavyHit && random() > chance) return false;

  const playerLocalX = Math.max(12, Math.min(building.width - 12, player.x - building.x));
  building.holes = building.holes || [];
  building.holes.push({
    x: playerLocalX,
    y: 8,
    r: 20 + random() * 12,
    edge: "roof",
    seed: Math.floor((player.x * 29 + impactY * 37 + round * 431) % 100000),
    hits: 2,
  });

  const collapseAmount = 18 + random() * 12 + Math.min(6, Math.abs(impactVx) * 1.5);
  const collapsed = collapseBuildingTop(player.buildingIndex, collapseAmount);
  if (collapsed) {
    emitPuffs(player.x, player.y - 8, 5, 28, 24, 12, 420);
    shake = Math.max(shake, 12);
  }
  return collapsed;
}

function hit(targetIndex) {
  const impactX = banana.x;
  const impactY = banana.y;
  const impactVx = banana.vx;
  explode(impactX, impactY, 92);
  banana = null;
  locked = true;
  updateUi();
  const winner = targetIndex === 0 ? 1 : 0;
  pendingWinner = winner;
  scores[winner] += 1;
  startHurtFall(targetIndex, impactVx);
  maybeTearDownHitGorillaBuilding(targetIndex, impactX, impactY, impactVx);
  setStatus(`${players[winner].name} scores! The other gorilla is going down.`);
}

function miss(reason = null) {
  const player = players[currentPlayer];
  banana = null;
  currentPlayer = currentPlayer === 0 ? 1 : 0;
  locked = false;
  loadCurrentShotSettings();
  updateUi();
  if (reason) {
    setStatus(`${reason} ${players[currentPlayer].name}, your throw.`);
    return;
  }
  setStatus(`${player.name} missed. ${players[currentPlayer].name}, your throw.`);
}

ui.form.addEventListener("submit", (event) => {
  event.preventDefault();
  throwBanana();
});

ui.newRoundButton.addEventListener("click", () => {
  if (locked) return;
  round += 1;
  resetRound(true);
});

ui.aimToggle.addEventListener("click", () => {
  aimAssistOn = !aimAssistOn;
  updateUi();
});

[ui.angle, ui.velocity].forEach((input) => {
  input.addEventListener("input", handleShotInput);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter") throwBanana();
  if (event.key === "ArrowLeft") ui.angle.value = Math.max(Number(ui.angle.min), Number(ui.angle.value) - 1);
  if (event.key === "ArrowRight") ui.angle.value = Math.min(Number(ui.angle.max), Number(ui.angle.value) + 1);
  if (event.key === "ArrowDown") ui.velocity.value = Math.max(Number(ui.velocity.min), Number(ui.velocity.value) - 1);
  if (event.key === "ArrowUp") ui.velocity.value = Math.min(Number(ui.velocity.max), Number(ui.velocity.value) + 1);
  if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp"].includes(event.key)) {
    saveCurrentShotSettings();
  }
  updateUi();
});

resetRound(false);
requestAnimationFrame(render);
