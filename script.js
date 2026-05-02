const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

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
const velocityMax = 130;
const shotStartOffset = { x: 34, y: -40 };
const spriteSheet = new Image();
spriteSheet.src = "assets/gorilla-atlas.png";
let spritesReady = false;
let seed = Date.now() % 99999;
let round = 1;
let currentPlayer = 0;
let scores = [0, 0];
let wind = 0;
let buildings = [];
let players = [];
let banana = null;
let explosions = [];
let clouds = [];
let locked = false;
let aimAssistOn = true;
let shake = 0;
let lastTime = 0;

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

function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}

function makeCity() {
  buildings = [];
  let x = 0;
  const palette = ["#26345e", "#33437d", "#493c7a", "#2b5a79", "#673f73", "#23536b"];
  while (x < W) {
    const width = 78 + Math.floor(random() * 42);
    const height = 110 + Math.floor(random() * 250);
    buildings.push({
      x,
      y: groundY - height,
      width,
      height,
      style: Math.floor(random() * buildingAtlases.length),
      color: palette[Math.floor(random() * palette.length)],
      lit: random() > 0.38,
      roof: random() > 0.6 ? "antenna" : random() > 0.5 ? "tank" : "flat",
    });
    x += width;
  }
}

function makePlayers() {
  const leftSpot = pickPlayerRoof(40, 320);
  const rightSpot = pickPlayerRoof(W - 320, W - 40);
  leftSpot.building.roof = "flat";
  rightSpot.building.roof = "flat";
  players = [
    { x: leftSpot.x, y: leftSpot.y, side: 1, color: "#9b6631", name: "Player 1", bob: 0 },
    { x: rightSpot.x, y: rightSpot.y, side: -1, color: "#7b4f2d", name: "Player 2", bob: Math.PI },
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

function topAt(x) {
  const b = buildings.find((building) => x >= building.x && x <= building.x + building.width);
  return b ? b.y : groundY;
}

function resetRound(keepScore = true) {
  seed = (Date.now() + round * 733) % 999999;
  let attempts = 0;
  do {
    makeCity();
    makePlayers();
    wind = Math.round((random() * 2 - 1) * 10) / 10;
    attempts += 1;
  } while (attempts < 36 && !roundHasPlayableShots());

  makeClouds();
  banana = null;
  explosions = [];
  currentPlayer = keepScore ? currentPlayer : 0;
  locked = false;
  shake = 0;
  updateUi();
  setStatus(`${players[currentPlayer].name}, set angle and velocity.`);
}

function setStatus(text) {
  ui.status.textContent = text;
}

function updateUi() {
  ui.angleOut.value = ui.angle.value;
  ui.velocityOut.value = ui.velocity.value;
  ui.wind.textContent = `Wind ${wind > 0 ? "+" : ""}${wind.toFixed(1)}`;
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

function getGorillaSpriteKey(player) {
  return player.side === 1 ? "brownReady" : "blueReady";
}

function getGorillaRenderY(player) {
  return player.y + 4 + Math.sin(performance.now() / 250 + player.bob) * 1.5;
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

function shotHitsPlayer(shooterIndex, targetIndex, angleValue, velocityValue) {
  const shooter = players[shooterIndex];
  const target = players[targetIndex];
  const angle = angleValue * Math.PI / 180;
  const speed = velocityValue * throwScale;
  let x = shooter.x + shooter.side * shotStartOffset.x;
  let y = shooter.y + shotStartOffset.y;
  let vx = Math.cos(angle) * speed * shooter.side;
  let vy = -Math.sin(angle) * speed;
  const targetBox = getGorillaHitBox(target);

  for (let tick = 0; tick < 900; tick++) {
    const prevX = x;
    const prevY = y;
    x += vx;
    y += vy;
    vx += wind * windScale;
    vy += gravity;

    if (segmentIntersectsRect(prevX, prevY, x, y, targetBox, 6)) return true;
    if (x < -80 || x > W + 80 || y > H + 80) return false;
    if (y >= topAt(x)) return false;
  }
  return false;
}

function playerHasShot(shooterIndex) {
  const targetIndex = shooterIndex === 0 ? 1 : 0;
  for (let velocity = 30; velocity <= velocityMax; velocity += 5) {
    for (let angle = 5; angle <= 89; angle += 2) {
      if (shotHitsPlayer(shooterIndex, targetIndex, angle, velocity)) return true;
    }
  }
  return false;
}

function roundHasPlayableShots() {
  return playerHasShot(0) && playerHasShot(1);
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
  }

  if (spritesReady) {
    drawSprite("moon", 768, 68, 0.72, 1, 0.96);
  } else {
    drawPixelRect(760, 48, 54, 54, "#ffe576");
    drawPixelRect(748, 60, 78, 30, "#ffd052");
    drawPixelRect(774, 36, 20, 80, "rgba(255, 235, 128, 0.18)");
  }

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

function drawBuildings() {
  buildings.forEach((b, index) => {
    if (spritesReady) {
      const atlas = buildingAtlases[b.style];
      const roofH = Math.min(22, b.height * 0.16);
      const baseH = Math.min(48, b.height * 0.26);
      const middleY = b.y + roofH;
      const middleH = Math.max(8, b.height - roofH - baseH);
      drawAtlasRegion(atlas.roof, b.x, b.y - 4, b.width, roofH + 8);
      drawTiledRegion(atlas.middle, b.x, middleY, b.width, middleH);
      drawAtlasRegion(atlas.base, b.x, b.y + b.height - baseH, b.width, baseH);
      if (b.roof === "antenna") {
        drawRegionAnchored(roofDetails[1], b.x + b.width / 2, b.y - 4, 0.38);
      }
      if (b.roof === "tank") {
        drawRegionAnchored(roofDetails[0], b.x + b.width / 2, b.y - 4, 0.32);
      }
      return;
    }

    drawPixelRect(b.x, b.y, b.width, b.height, b.color);
    drawPixelRect(b.x, b.y, b.width, 5, "#91e8ff");
    drawPixelRect(b.x + 4, b.y + 8, b.width - 8, b.height - 8, "rgba(6, 10, 31, 0.16)");
    if (b.roof === "antenna") {
      drawPixelRect(b.x + b.width / 2 - 2, b.y - 22, 4, 22, "#a8e8ff");
      drawPixelRect(b.x + b.width / 2 - 10, b.y - 13, 20, 3, "#f8df66");
    }
    if (b.roof === "tank") {
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
  });
  drawPixelRect(0, groundY, W, H - groundY, "#171329");
  drawPixelRect(0, groundY, W, 6, "#7be3de");
}

function drawGorilla(player, active) {
  const x = player.x;
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
  if (active && !locked) {
    drawPixelRect(22, -2 + armRaise, 15, 6, "#ffe15b");
  }
  ctx.restore();
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
    vx += windScale * 4;
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

  ctx.save();
  const bump = shake > 0 ? Math.round((Math.random() - 0.5) * shake) : 0;
  if (shake > 0) shake *= 0.86;
  ctx.translate(bump, -bump);
  drawSky(dt);
  drawBuildings();
  drawHudTrajectory();
  players.forEach((player, index) => drawGorilla(player, index === currentPlayer));
  drawBanana();
  drawExplosions(dt);
  drawOverlayText();
  ctx.restore();
  requestAnimationFrame(render);
}

function throwBanana() {
  if (locked) return;
  locked = true;
  updateUi();
  const player = players[currentPlayer];
  const angle = Number(ui.angle.value) * Math.PI / 180;
  const speed = Number(ui.velocity.value) * throwScale;
  banana = {
    x: player.x + player.side * shotStartOffset.x,
    y: player.y + shotStartOffset.y,
    prevX: player.x + player.side * shotStartOffset.x,
    prevY: player.y + shotStartOffset.y,
    vx: Math.cos(angle) * speed * player.side,
    vy: -Math.sin(angle) * speed,
    spin: 0,
    owner: currentPlayer,
    age: 0,
  };
  setStatus(`${player.name} lets it rip.`);
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

function checkCollision() {
  if (!banana) return false;
  if (banana.x < -40 || banana.x > W + 40 || banana.y > H + 80) {
    miss();
    return true;
  }

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (i === banana.owner && banana.age < 12) continue;
    if (segmentIntersectsRect(banana.prevX, banana.prevY, banana.x, banana.y, getGorillaHitBox(p), 8)) {
      hit(i);
      return true;
    }
  }

  if (banana.y >= topAt(banana.x)) {
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

function hit(targetIndex) {
  explode(banana.x, banana.y, 92);
  banana = null;
  const winner = targetIndex === 0 ? 1 : 0;
  scores[winner] += 1;
  setStatus(`${players[winner].name} scores! New skyline incoming.`);
  setTimeout(() => {
    round += 1;
    currentPlayer = winner;
    resetRound(true);
  }, 1200);
}

function miss() {
  const player = players[currentPlayer];
  banana = null;
  currentPlayer = currentPlayer === 0 ? 1 : 0;
  locked = false;
  updateUi();
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
  input.addEventListener("input", updateUi);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Enter") throwBanana();
  if (event.key === "ArrowLeft") ui.angle.value = Math.max(Number(ui.angle.min), Number(ui.angle.value) - 1);
  if (event.key === "ArrowRight") ui.angle.value = Math.min(Number(ui.angle.max), Number(ui.angle.value) + 1);
  if (event.key === "ArrowDown") ui.velocity.value = Math.max(Number(ui.velocity.min), Number(ui.velocity.value) - 1);
  if (event.key === "ArrowUp") ui.velocity.value = Math.min(Number(ui.velocity.max), Number(ui.velocity.value) + 1);
  updateUi();
});

resetRound(false);
requestAnimationFrame(render);
