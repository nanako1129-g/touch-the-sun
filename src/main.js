import "./style.css";

// 実機調整はこの定数だけを変更します。座標はSimpleTileMatの実座標です。
const CONFIG = {
  HEAT_DURATION: 7000,
  HEAT_MIN_SPEED: 18,
  HEAT_MAX_SPEED: 42,
  HEAT_BEEP_INTERVAL_MIN: 220,
  HEAT_BEEP_INTERVAL_MAX: 900,
  POSITION_SPEED: 42,
  APPROACH_SPEED: 46,
  REPEL_SPEED: 48,
  ORBIT_SPEED: 50,
  SECOND_APPROACH_SPEED: 52,
  SPIN_SPEED: 96,
  SPIN_BURST_DURATION: 310,
  SPIN_BURSTS: 4,
  SPIN_SETTLE_DELAY: 90,
  TARGET_TOLERANCE: 18,
  FUSION_TOLERANCE: 7,
  TARGET_TIMEOUT: 8000,
  MOVE_RETRY_INTERVAL: 1100,
  FUSION_PUSH_SPEED: 78,
  FUSION_WIGGLE: 30,
  FUSION_PULSE_DURATION: 88,
  FUSION_SHAKE_CYCLES: 22,
  RELEASE_SHAKE_CYCLES: 18,
  STEP_DELAY: 350,
};

const SCENE_CLASSES = [
  "scene-idle",
  "scene-heating",
  "scene-ready",
  "scene-approach",
  "scene-repel",
  "scene-orbit-a",
  "scene-orbit-b",
  "scene-spin-charge",
  "scene-second-approach",
  "scene-fusion",
  "scene-release",
  "scene-finished",
];

const elements = {
  stage: document.querySelector("#stage"),
  statusKicker: document.querySelector("#statusKicker"),
  statusTitle: document.querySelector("#statusTitle"),
  statusCopy: document.querySelector("#statusCopy"),
  heatButton: document.querySelector("#heatButton"),
  fusionButton: document.querySelector("#fusionButton"),
  bgmToggle: document.querySelector("#bgmToggle"),
  resetButton: document.querySelector("#resetButton"),
  temperatureValue: document.querySelector("#temperatureValue"),
  temperatureFill: document.querySelector("#temperatureFill"),
  temperatureTrack: document.querySelector("#temperatureTrack"),
  operationHint: document.querySelector("#operationHint"),
  connectionPanel: document.querySelector("#connectionPanel"),
  connectionTitle: document.querySelector("#connectionTitle"),
  connectionDetail: document.querySelector("#connectionDetail"),
  connectionDot: document.querySelector("#connectionDot"),
  connectButton: document.querySelector("#connectButton"),
  connectCount: document.querySelector("#connectCount"),
  demoFallback: document.querySelector("#demoFallback"),
  modeButtons: [...document.querySelectorAll(".mode-button")],
};

const state = {
  mode: "demo",
  cubes: [],
  temperature: 0,
  heating: false,
  running: false,
  connected: false,
  heatFrame: null,
  heatStartedAt: 0,
  heatStartedFrom: 0,
  lastHeatCommandAt: 0,
  lastHeatBeepAt: 0,
  heatDirection: 1,
  runToken: 0,
  audioContext: null,
  explosionBuffer: null,
  explosionLoading: null,
  explosionSource: null,
  bgmAudio: null,
  bgmEnabled: true,
  bgmRestoreTimer: null,
};

// 指定された p5.js スケッチと同じシンプルマット定義を使用します。
const targetMat =
  typeof P5tId !== "undefined" ? P5tId.SimpleTileMat : undefined;
const EXPLOSION_AUDIO_URL = new URL(
  "audio/fusion-explosion.mp3",
  document.baseURI,
).href;
const BGM_AUDIO_URL = new URL(
  "audio/galaxy-runner.mp3",
  document.baseURI,
).href;
const hasBluetooth = "bluetooth" in navigator;
const hasToioSdk = typeof P5tCube !== "undefined";
const toioSupported = hasBluetooth && hasToioSdk;

const MAT_BOUNDS = {
  minX: targetMat?.minX ?? 98,
  minY: targetMat?.minY ?? 142,
  maxX: targetMat?.maxX ?? 402,
  maxY: targetMat?.maxY ?? 358,
};

// A3簡易マット用。A4開発用マットを2枚つないだ場合も同じ座標です。
const A3_TARGETS = {
  stage: [
    { x: 140, y: 250, angle: 0 },
    { x: 360, y: 250, angle: Math.PI },
  ],
  approach: [
    { x: 210, y: 250, angle: 0 },
    { x: 290, y: 250, angle: Math.PI },
  ],
  repel: [
    { x: 175, y: 250, angle: 0 },
    { x: 325, y: 250, angle: Math.PI },
  ],
  orbitA: [
    { x: 190, y: 205, angle: 0 },
    { x: 310, y: 295, angle: Math.PI },
  ],
  orbitB: [
    { x: 195, y: 295, angle: 0 },
    { x: 305, y: 205, angle: Math.PI },
  ],
  spin: [
    { x: 195, y: 250, angle: 0 },
    { x: 305, y: 250, angle: Math.PI },
  ],
  fusion: [
    { x: 234, y: 250, angle: 0 },
    { x: 266, y: 250, angle: Math.PI },
  ],
};

function createA4Targets(centerX) {
  const target = (offsetX, offsetY, angle) => ({
    x: centerX + offsetX,
    y: 250 + offsetY,
    angle,
  });

  return {
    stage: [target(-40, 0, 0), target(40, 0, Math.PI)],
    approach: [target(-28, 0, 0), target(28, 0, Math.PI)],
    repel: [target(-40, 0, 0), target(40, 0, Math.PI)],
    orbitA: [target(-30, -40, 0), target(30, 40, Math.PI)],
    orbitB: [target(-30, 40, 0), target(30, -40, Math.PI)],
    spin: [target(-40, 0, 0), target(40, 0, Math.PI)],
    fusion: [target(-16, 0, 0), target(16, 0, Math.PI)],
  };
}

// A4開発用マットは、表と裏でA3簡易マットの左右半分を分担します。
const MAT_PROFILES = {
  a3: {
    label: "A3 / A4×2",
    targets: A3_TARGETS,
  },
  a4Front: {
    label: "A4 FRONT",
    targets: createA4Targets(174),
  },
  a4Back: {
    label: "A4 BACK",
    targets: createA4Targets(326),
  },
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mixColor(progress) {
  const stops = [
    [0, [31, 108, 255]],
    [0.38, [132, 48, 255]],
    [0.72, [255, 48, 83]],
    [1, [255, 163, 26]],
  ];

  for (let index = 0; index < stops.length - 1; index += 1) {
    const [startAt, start] = stops[index];
    const [endAt, end] = stops[index + 1];
    if (progress <= endAt) {
      const ratio = (progress - startAt) / (endAt - startAt);
      return start.map((channel, channelIndex) =>
        Math.round(channel + (end[channelIndex] - channel) * ratio),
      );
    }
  }

  return stops.at(-1)[1];
}

function setScene(scene, kicker, title, copy, duration = 700) {
  elements.stage.classList.remove(...SCENE_CLASSES);
  elements.stage.classList.add(`scene-${scene}`);
  elements.stage.style.setProperty("--phase-duration", `${duration}ms`);
  elements.statusKicker.textContent = kicker;
  elements.statusTitle.textContent = title;
  elements.statusCopy.textContent = copy;
}

function setMode(mode) {
  if (state.running) return;

  stopHeating();
  state.mode = mode;
  elements.modeButtons.forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  elements.connectionPanel.hidden = mode !== "toio";

  if (mode === "demo") {
    stopAllToio();
    elements.operationHint.textContent =
      state.temperature >= 100
        ? "準備完了。FUSIONを押してください"
        : "ボタンを7秒間長押ししてください";
    updateActionAvailability();
    return;
  }

  renderConnectionState();
  updateActionAvailability();
}

function hasMatPosition(cube) {
  return (
    Number.isFinite(cube?.x) &&
    Number.isFinite(cube?.y) &&
    cube.x >= MAT_BOUNDS.minX &&
    cube.x <= MAT_BOUNDS.maxX &&
    cube.y >= MAT_BOUNDS.minY &&
    cube.y <= MAT_BOUNDS.maxY
  );
}

function getCubesLeftToRight() {
  return [...state.cubes].sort(
    (cubeA, cubeB) => (cubeA.x ?? Infinity) - (cubeB.x ?? Infinity),
  );
}

function coordinatesReady() {
  return state.cubes.length === 2 && state.cubes.every(hasMatPosition);
}

function getActiveMatProfile() {
  if (!coordinatesReady()) return MAT_PROFILES.a3;

  const xPositions = state.cubes.map((cube) => cube.x);
  if (Math.max(...xPositions) <= 250) return MAT_PROFILES.a4Front;
  if (Math.min(...xPositions) >= 250) return MAT_PROFILES.a4Back;
  return MAT_PROFILES.a3;
}

function formatCubeCoordinates() {
  if (!coordinatesReady()) return "";
  const [cubeA, cubeB] = getCubesLeftToRight();
  return `A (${Math.round(cubeA.x)}, ${Math.round(cubeA.y)})・B (${Math.round(cubeB.x)}, ${Math.round(cubeB.y)})`;
}

function formatTargets(targets) {
  return targets
    .map((target, index) => {
      const label = index === 0 ? "A" : "B";
      return `${label} (${target.x}, ${target.y})`;
    })
    .join("・");
}

function renderConnectionState(message = "") {
  elements.connectCount.textContent = `${state.cubes.length} / 2`;
  elements.demoFallback.hidden = toioSupported;

  if (!toioSupported) {
    if (!hasBluetooth) {
      elements.connectionTitle.textContent = "BLUETOOTH API IS DISABLED";
      elements.connectionDetail.textContent =
        "ChromeのWeb Bluetoothが無効です。Bluetooth設定またはブラウザの管理ポリシーを確認してください。";
    } else {
      elements.connectionTitle.textContent = "TOIO LIBRARY NOT LOADED";
      elements.connectionDetail.textContent =
        "p5.toioを読み込めませんでした。ページを再読み込みしてください。";
    }
    elements.connectionDot.classList.remove("is-ready");
    elements.connectButton.hidden = true;
    return;
  }

  elements.connectButton.hidden = state.cubes.length >= 2;
  if (state.cubes.length >= 2) {
    if (coordinatesReady()) {
      const matProfile = getActiveMatProfile();
      elements.connectionTitle.textContent = "2 CUBES TRACKED";
      elements.connectionDetail.textContent = `${formatCubeCoordinates()}・${matProfile.label} 自動調整`;
      elements.connectionDot.classList.add("is-ready");
    } else {
      elements.connectionTitle.textContent = "PLACE CUBES ON SIMPLE MAT";
      elements.connectionDetail.textContent =
        "2台をシンプルマットの中央線上に置いてください。座標を取得すると開始できます";
      elements.connectionDot.classList.remove("is-ready");
    }
  } else {
    elements.connectionTitle.textContent =
      state.cubes.length === 1 ? "CUBE 1 CONNECTED" : "TOIO NOT CONNECTED";
    elements.connectionDetail.textContent =
      message ||
      (state.cubes.length === 1
        ? "もう一度ボタンを押して2台目を接続してください"
        : "Core Cubeを2台、1台ずつ接続してください");
    elements.connectionDot.classList.remove("is-ready");
  }
}

function updateActionAvailability() {
  const hardwareReady = state.mode === "demo" || coordinatesReady();
  const canHeat =
    hardwareReady &&
    !state.running &&
    state.temperature < 100 &&
    !state.connected;

  elements.heatButton.disabled = !canHeat;
  elements.fusionButton.disabled =
    !hardwareReady || state.running || state.temperature < 100;

  if (state.mode === "toio" && !hardwareReady) {
    elements.operationHint.textContent = !toioSupported
      ? "DEMO MODEならBluetoothなしで体験できます"
      : state.cubes.length < 2
        ? "Core Cubeを2台接続すると開始できます"
        : "2台をシンプルマット上に置くと開始できます";
  }
}

function initAudio() {
  if (!state.audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) state.audioContext = new AudioContext();
  }

  if (state.audioContext?.state === "suspended") {
    state.audioContext.resume();
  }

  if (
    state.audioContext &&
    !state.explosionBuffer &&
    !state.explosionLoading
  ) {
    state.explosionLoading = fetch(EXPLOSION_AUDIO_URL)
      .then((response) => {
        if (!response.ok) throw new Error("explosion audio load failed");
        return response.arrayBuffer();
      })
      .then((audioData) => state.audioContext.decodeAudioData(audioData))
      .then((audioBuffer) => {
        state.explosionBuffer = audioBuffer;
      })
      .catch((error) => {
        state.explosionLoading = null;
        console.warn("explosion audio unavailable", error);
      });
  }

  startBgm();
}

function ensureBgmAudio() {
  if (state.bgmAudio) return state.bgmAudio;
  const audio = new Audio(BGM_AUDIO_URL);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0.2;
  state.bgmAudio = audio;
  return audio;
}

function updateBgmToggle() {
  elements.bgmToggle.classList.toggle("is-on", state.bgmEnabled);
  elements.bgmToggle.setAttribute(
    "aria-pressed",
    String(state.bgmEnabled),
  );
  elements.bgmToggle.querySelector("strong").textContent =
    state.bgmEnabled ? "BGM ON" : "BGM OFF";
}

function startBgm() {
  if (!state.bgmEnabled) return;
  const audio = ensureBgmAudio();
  audio
    .play()
    .catch(() => {
      // ブラウザの自動再生制限時は、次のユーザー操作で再試行します。
    });
}

function stopBgm(resetPosition = false) {
  if (!state.bgmAudio) return;
  window.clearTimeout(state.bgmRestoreTimer);
  state.bgmRestoreTimer = null;
  state.bgmAudio.pause();
  state.bgmAudio.volume = 0.2;
  if (resetPosition) state.bgmAudio.currentTime = 0;
}

function setBgmEnabled(enabled) {
  state.bgmEnabled = enabled;
  updateBgmToggle();
  if (enabled) {
    startBgm();
  } else {
    stopBgm();
  }
}

function duckBgm(duration = 4800) {
  if (!state.bgmAudio || state.bgmAudio.paused) return;
  window.clearTimeout(state.bgmRestoreTimer);
  state.bgmAudio.volume = 0.065;
  state.bgmRestoreTimer = window.setTimeout(() => {
    if (state.bgmAudio && state.bgmEnabled) {
      state.bgmAudio.volume = 0.2;
    }
    state.bgmRestoreTimer = null;
  }, duration);
}

function stopExplosionSound() {
  if (!state.explosionSource) return;
  try {
    state.explosionSource.stop();
  } catch {
    // 再生終了済みの場合は何もしません。
  }
  state.explosionSource = null;
}

function playExplosionSound() {
  duckBgm();
  if (!state.audioContext || !state.explosionBuffer) {
    browserSweep(180, 55, 1.6, 0.08);
    return;
  }

  stopExplosionSound();
  const source = state.audioContext.createBufferSource();
  const gain = state.audioContext.createGain();
  const now = state.audioContext.currentTime;
  const fadeOutAt = Math.min(
    state.explosionBuffer.duration,
    4.75,
  );

  source.buffer = state.explosionBuffer;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.38, now + 0.035);
  gain.gain.setValueAtTime(0.38, now + Math.max(0.04, fadeOutAt - 0.7));
  gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeOutAt);
  source.connect(gain).connect(state.audioContext.destination);
  source.addEventListener(
    "ended",
    () => {
      if (state.explosionSource === source) state.explosionSource = null;
    },
    { once: true },
  );
  state.explosionSource = source;
  source.start(now);
}

function browserTone(frequency = 440, duration = 0.08, volume = 0.045) {
  if (!state.audioContext) return;

  const now = state.audioContext.currentTime;
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(state.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function browserSweep(startFrequency, endFrequency, duration, volume = 0.06) {
  if (!state.audioContext) return;

  const now = state.audioContext.currentTime;
  const oscillator = state.audioContext.createOscillator();
  const gain = state.audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    now + duration,
  );
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain).connect(state.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function browserSuccessSound() {
  [523, 659, 784, 1047].forEach((frequency, index) => {
    window.setTimeout(
      () => browserTone(frequency, index === 3 ? 0.3 : 0.12, 0.065),
      index * 120,
    );
  });
}

function safeCubeCommand(command) {
  if (state.mode !== "toio") return;
  state.cubes.forEach((cube, index) => {
    try {
      command(cube, index);
    } catch (error) {
      console.warn("toio command failed", error);
    }
  });
}

function setCubeLight([red, green, blue], duration = 0) {
  safeCubeCommand((cube) =>
    cube.turnLightOnRGB(red, green, blue, duration),
  );
}

function silenceAndStopCube(cube) {
  cube.stop();
  cube.playSingleNote(128, 1);
  cube.turnLightOff();
}

function stopAllToio() {
  state.cubes.forEach((cube) => {
    try {
      silenceAndStopCube(cube);
    } catch (error) {
      console.warn("toio stop failed", error);
    }
  });
}

function getCubeDeviceId(cube) {
  // p5.toio 0.5.0 の Cube → CubeBase → BluetoothDevice。
  return cube?.cube?.device?.id ?? null;
}

async function connectToio() {
  if (!toioSupported || state.cubes.length >= 2 || state.running) return;

  initAudio();
  elements.connectButton.disabled = true;
  elements.connectionDetail.textContent = "Bluetoothの一覧から1台選択してください…";

  try {
    // Web Bluetoothの選択画面は、必ずこのボタンクリックから開始します。
    const cube = await P5tCube.connectNewP5tCube();
    const deviceId = getCubeDeviceId(cube);
    const alreadyConnected = state.cubes.some(
      (connectedCube) =>
        deviceId && getCubeDeviceId(connectedCube) === deviceId,
    );

    if (alreadyConnected) {
      renderConnectionState(
        "同じtoioが選ばれました。もう片方の電源だけを入れて選び直してください",
      );
      return;
    }

    const cubeIndex = state.cubes.length;
    const connectionColor =
      cubeIndex === 0 ? [32, 116, 255] : [157, 74, 255];
    cube.setFrameRate(30);
    cube.turnLightOnRGB(...connectionColor, 0);
    cube.playSE(P5tCube.seId.selected);
    state.cubes.push(cube);
    renderConnectionState();
  } catch (error) {
    const cancelled = error?.name === "NotFoundError";
    renderConnectionState(
      cancelled
        ? "接続はキャンセルされました。ボタンから再試行できます"
        : "接続できませんでした。toioの電源とブラウザを確認してください",
    );
  } finally {
    elements.connectButton.disabled = false;
    updateActionAvailability();
  }
}

function updateTemperature(value) {
  state.temperature = clamp(value, 0, 100);
  const rounded = Math.round(state.temperature);
  const progress = state.temperature / 100;
  const [red, green, blue] = mixColor(progress);

  elements.temperatureValue.textContent = `${rounded}%`;
  elements.temperatureFill.style.width = `${state.temperature}%`;
  elements.temperatureTrack.setAttribute("aria-valuenow", String(rounded));
  document.documentElement.style.setProperty(
    "--heat-color",
    `${red} ${green} ${blue}`,
  );
  document.documentElement.style.setProperty(
    "--heat-progress",
    String(progress),
  );
  elements.stage.style.setProperty(
    "--shake-speed",
    `${Math.round(420 - progress * 330)}ms`,
  );
  elements.stage.style.setProperty(
    "--shake-distance",
    `${Math.round(1 + progress * 5)}px`,
  );
}

function updateHeatingHardware(now, progress) {
  if (state.mode !== "toio") return;

  if (now - state.lastHeatCommandAt > 240) {
    const speed = Math.round(
      CONFIG.HEAT_MIN_SPEED +
        (CONFIG.HEAT_MAX_SPEED - CONFIG.HEAT_MIN_SPEED) * progress,
    );
    state.heatDirection *= -1;
    safeCubeCommand((cube, index) => {
      const mirror = index === 0 ? 1 : -1;
      cube.rotate(speed * state.heatDirection * mirror, 160);
    });
    setCubeLight(mixColor(progress), 0);
    state.lastHeatCommandAt = now;
  }

  const beepInterval =
    CONFIG.HEAT_BEEP_INTERVAL_MAX -
    (CONFIG.HEAT_BEEP_INTERVAL_MAX - CONFIG.HEAT_BEEP_INTERVAL_MIN) * progress;
  if (now - state.lastHeatBeepAt > beepInterval) {
    const note = 46 + Math.round(progress * 28);
    safeCubeCommand((cube) => cube.playSingleNote(note, 8));
    state.lastHeatBeepAt = now;
  }
}

function heatingFrame(now) {
  if (!state.heating) return;
  if (state.mode === "toio" && !coordinatesReady()) {
    stopHeating();
    renderConnectionState();
    elements.operationHint.textContent =
      "座標を見失いました。2台をシンプルマット上へ戻してください";
    return;
  }

  const elapsed = now - state.heatStartedAt;
  const remaining = 100 - state.heatStartedFrom;
  const nextTemperature =
    state.heatStartedFrom + (elapsed / CONFIG.HEAT_DURATION) * 100;
  const adjustedTemperature =
    state.heatStartedFrom +
    Math.min(nextTemperature - state.heatStartedFrom, remaining);

  updateTemperature(adjustedTemperature);
  const progress = state.temperature / 100;
  updateHeatingHardware(now, progress);

  if (now - state.lastHeatBeepAt > 250) {
    browserTone(180 + progress * 520, 0.06, 0.025 + progress * 0.02);
    state.lastHeatBeepAt = now;
  }

  if (state.temperature >= 100) {
    completeHeating();
    return;
  }

  state.heatFrame = requestAnimationFrame(heatingFrame);
}

function startHeating(event) {
  if (event?.type === "keydown" && event.repeat) return;
  if (elements.heatButton.disabled || state.heating || state.running) return;

  initAudio();
  state.heating = true;
  state.heatStartedAt = performance.now();
  state.heatStartedFrom = state.temperature;
  state.lastHeatCommandAt = 0;
  state.lastHeatBeepAt = 0;
  elements.heatButton.classList.add("is-holding");
  setScene(
    "heating",
    "TEMPERATURE RISING",
    "温度上昇",
    "長押しを続けて、核融合に必要なエネルギーを蓄えます",
  );
  browserTone(150, 0.14, 0.06);
  setCubeLight([30, 90, 255]);
  safeCubeCommand((cube) => cube.playSingleNote(45, 12));
  state.heatFrame = requestAnimationFrame(heatingFrame);
}

function stopHeating() {
  if (!state.heating) return;
  state.heating = false;
  cancelAnimationFrame(state.heatFrame);
  elements.heatButton.classList.remove("is-holding");
  stopAllToio();

  if (state.temperature < 100) {
    setScene(
      "idle",
      "HEAT PAUSED",
      "加熱を一時停止",
      "もう一度長押しすると、現在の温度から再開します",
    );
  }
}

function completeHeating() {
  state.heating = false;
  cancelAnimationFrame(state.heatFrame);
  updateTemperature(100);
  elements.heatButton.classList.remove("is-holding");
  elements.heatButton.hidden = true;
  elements.fusionButton.hidden = false;
  elements.operationHint.textContent = "準備完了。FUSIONを押してください";
  setScene(
    "ready",
    "ENERGY READY",
    "臨界エネルギーに到達",
    "2つの原子核を衝突させます",
  );
  stopAllToio();
  browserSuccessSound();
  setCubeLight([255, 140, 20], 1200);
  safeCubeCommand((cube) => cube.playSE(P5tCube.seId.enter));
  updateActionAvailability();
}

function wait(ms, token) {
  return new Promise((resolve) => {
    window.setTimeout(() => resolve(token === state.runToken), ms);
  });
}

async function pause(ms, token) {
  const active = await wait(ms, token);
  if (!active) throw new Error("sequence-cancelled");
}

function distanceToTarget(cube, target) {
  return Math.hypot(cube.x - target.x, cube.y - target.y);
}

async function moveCubesTo(targets, speed) {
  if (state.mode !== "toio" || !coordinatesReady()) {
    throw new Error("mat-coordinates-lost");
  }

  const results = await Promise.allSettled(
    getCubesLeftToRight().map((cube, index) =>
      Promise.resolve().then(() =>
        cube.moveTo({ ...targets[index] }, speed),
      ),
    ),
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.warn("toio move command will retry", result.reason);
    }
  });
}

async function waitForCubeTargets(
  targets,
  speed,
  token,
  tolerance = CONFIG.TARGET_TOLERANCE,
) {
  const startedAt = performance.now();
  let lastMoveCommandAt = startedAt;

  while (performance.now() - startedAt < CONFIG.TARGET_TIMEOUT) {
    if (!coordinatesReady()) throw new Error("mat-coordinates-lost");

    const arrived = getCubesLeftToRight().every(
      (cube, index) =>
        distanceToTarget(cube, targets[index]) <= tolerance,
    );
    if (arrived) return;

    const now = performance.now();
    if (now - lastMoveCommandAt >= CONFIG.MOVE_RETRY_INTERVAL) {
      await moveCubesTo(targets, speed);
      lastMoveCommandAt = performance.now();
    }

    await pause(120, token);
  }

  stopAllToio();
  const error = new Error("coordinate-target-timeout");
  error.targets = targets;
  throw error;
}

async function runCoordinateMove(
  targets,
  speed,
  token,
  demoDuration,
  tolerance = CONFIG.TARGET_TOLERANCE,
) {
  if (state.mode === "demo") {
    await pause(demoDuration, token);
    return;
  }

  await moveCubesTo(targets, speed);
  await waitForCubeTargets(targets, speed, token, tolerance);
}

async function runFusionShake(
  token,
  cycles,
  pushSpeed = CONFIG.FUSION_PUSH_SPEED,
  wiggle = CONFIG.FUSION_WIGGLE,
) {
  const pulseDuration = CONFIG.FUSION_PULSE_DURATION;

  if (state.mode === "demo") {
    await pause(cycles * (pulseDuration + 32), token);
    return;
  }

  for (let step = 0; step < cycles; step += 1) {
    if (!coordinatesReady()) throw new Error("mat-coordinates-lost");

    const phase = step % 3;
    const leftSpeed = clamp(
      phase === 2
        ? pushSpeed + 8
        : pushSpeed + (phase === 0 ? wiggle : -wiggle),
      8,
      115,
    );
    const rightSpeed = clamp(
      phase === 2
        ? pushSpeed + 8
        : pushSpeed + (phase === 0 ? -wiggle : wiggle),
      8,
      115,
    );
    const flashColor =
      step % 4 < 2 ? [255, 245, 188] : [255, 65, 18];

    const results = await Promise.allSettled(
      getCubesLeftToRight().map((cube) =>
        Promise.resolve()
          .then(() =>
            cube.move(leftSpeed, rightSpeed, pulseDuration),
          )
          .then(() =>
            cube.turnLightOnRGB(...flashColor, pulseDuration + 30),
          ),
      ),
    );

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("toio fusion shake will continue", result.reason);
      }
    });
    await pause(pulseDuration + 32, token);
  }

  await Promise.allSettled(
    getCubesLeftToRight().map((cube) =>
      Promise.resolve().then(() =>
        cube.move(
          clamp(pushSpeed + 10, 8, 115),
          clamp(pushSpeed + 10, 8, 115),
          180,
        ),
      ),
    ),
  );
  await pause(220, token);
}

async function runSpinCharge(token) {
  const burstDuration = CONFIG.SPIN_BURST_DURATION;
  const burstInterval = burstDuration + CONFIG.SPIN_SETTLE_DELAY;

  if (state.mode === "demo") {
    await pause(CONFIG.SPIN_BURSTS * burstInterval, token);
    return;
  }

  for (let step = 0; step < CONFIG.SPIN_BURSTS; step += 1) {
    if (!coordinatesReady()) throw new Error("mat-coordinates-lost");

    const direction = step % 2 === 0 ? 1 : -1;
    const flashColor =
      step % 2 === 0 ? [118, 54, 255] : [255, 126, 24];

    const results = await Promise.allSettled(
      getCubesLeftToRight().map((cube, index) =>
        Promise.resolve().then(() => {
          const mirror = index === 0 ? 1 : -1;
          cube.rotate(
            CONFIG.SPIN_SPEED * direction * mirror,
            burstDuration,
          );
          cube.turnLightOnRGB(
            ...flashColor,
            burstDuration + CONFIG.SPIN_SETTLE_DELAY,
          );
          cube.playSingleNote(68 + step * 4 + index * 7, 8);
        }),
      ),
    );

    results.forEach((result) => {
      if (result.status === "rejected") {
        console.warn("toio spin charge will continue", result.reason);
      }
    });
    await pause(burstInterval, token);
  }

  safeCubeCommand((cube) => cube.stop());
  await pause(180, token);
}

function playApproachPulse(fast = false) {
  const notes = fast ? [68, 72, 76, 81] : [56, 60, 64];
  notes.forEach((note, index) => {
    window.setTimeout(() => {
      if (!state.running) return;
      browserTone(note * 5.2, 0.07, 0.035);
      safeCubeCommand((cube) => cube.playSingleNote(note, 7));
    }, index * (fast ? 260 : 460));
  });
}

// 画面演出と実機命令を、同じ工程内で順番に実行します。
async function runFusionSequence() {
  if (state.running || state.temperature < 100) return;
  if (state.mode === "toio" && state.cubes.length !== 2) {
    renderConnectionState("2台接続できるまでFUSIONは開始できません");
    return;
  }
  if (state.mode === "toio" && !coordinatesReady()) {
    renderConnectionState();
    elements.operationHint.textContent =
      "2台をシンプルマット上に置いて座標を取得してください";
    return;
  }

  initAudio();
  state.running = true;
  state.runToken += 1;
  const token = state.runToken;
  const matTargets = getActiveMatProfile().targets;
  elements.fusionButton.disabled = true;
  elements.resetButton.classList.add("is-armed");
  elements.modeButtons.forEach((button) => {
    button.disabled = true;
  });

  try {
    // 0. 左右を座標から判定し、中央線上の開始位置へ整列
    if (state.mode === "toio") {
      setScene(
        "ready",
        "COORDINATE LOCK",
        "開始位置へ移動",
        "マット座標を読み、2台を中央線上へ整列します",
        900,
      );
      setCubeLight([52, 116, 255]);
      await runCoordinateMove(
        matTargets.stage,
        CONFIG.POSITION_SPEED,
        token,
        0,
      );
      await pause(450, token);
    }

    // 1. 接近
    setScene(
      "approach",
      "NUCLEI APPROACHING",
      "原子核が接近",
      "電気的な反発を超える距離へ",
      2400,
    );
    setCubeLight([255, 76, 24]);
    playApproachPulse(false);
    await runCoordinateMove(
      matTargets.approach,
      CONFIG.APPROACH_SPEED,
      token,
      3900,
    );
    await pause(550, token);

    // 2. 反発
    setScene(
      "repel",
      "ELECTRIC REPULSION",
      "電気的な反発",
      "同じ電荷が、原子核を押し戻す",
      800,
    );
    browserSweep(260, 90, 0.42, 0.075);
    setCubeLight([255, 20, 35]);
    safeCubeCommand((cube) => {
      cube.playSE(P5tCube.seId.cancel);
    });
    await runCoordinateMove(
      matTargets.repel,
      CONFIG.REPEL_SPEED,
      token,
      2450,
    );
    await pause(700 + CONFIG.STEP_DELAY, token);

    // 3. プラズマ旋回。上下を入れ替えるS字軌道でエネルギーを蓄える。
    setScene(
      "orbit-a",
      "PLASMA SWIRL",
      "プラズマの渦",
      "磁場が2つの原子核を導く",
      1700,
    );
    setCubeLight([170, 55, 255]);
    browserSweep(320, 760, 0.7, 0.055);
    safeCubeCommand((cube, index) =>
      cube.playSingleNote(index === 0 ? 69 : 76, 10),
    );
    await runCoordinateMove(
      matTargets.orbitA,
      CONFIG.ORBIT_SPEED,
      token,
      1900,
    );
    await pause(300, token);

    setScene(
      "orbit-b",
      "MAGNETIC REVERSAL",
      "磁場反転",
      "軌道を反転し、さらにエネルギーを集中させる",
      1700,
    );
    setCubeLight([255, 104, 38]);
    browserSweep(760, 420, 0.7, 0.055);
    safeCubeCommand((cube, index) =>
      cube.playSingleNote(index === 0 ? 79 : 72, 10),
    );
    await runCoordinateMove(
      matTargets.orbitB,
      CONFIG.ORBIT_SPEED,
      token,
      1900,
    );
    await pause(350, token);

    // 4. 衝突前の高速スピン。十分に離れた位置で逆回転し、座標を再ロックする。
    setScene(
      "spin-charge",
      "ROTATIONAL ENERGY",
      "超高速スピン",
      "反対方向への回転で、衝突エネルギーを一気に高める",
      1750,
    );
    setCubeLight([118, 54, 255]);
    browserSweep(420, 1320, 1.55, 0.065);
    await runCoordinateMove(
      matTargets.spin,
      CONFIG.ORBIT_SPEED,
      token,
      650,
    );
    await pause(220, token);
    await runSpinCharge(token);
    await runCoordinateMove(
      matTargets.spin,
      CONFIG.POSITION_SPEED,
      token,
      420,
    );
    await pause(320, token);

    // 5. 再接近
    setScene(
      "second-approach",
      "HIGHER ENERGY",
      "さらに高いエネルギー",
      "もう一度。今度は、より速く",
      2000,
    );
    setCubeLight([255, 190, 20]);
    playApproachPulse(true);
    await runCoordinateMove(
      matTargets.fusion,
      CONFIG.SECOND_APPROACH_SPEED,
      token,
      3650,
      CONFIG.FUSION_TOLERANCE,
    );
    await pause(500, token);

    // 6. 核融合
    setScene(
      "fusion",
      "CRITICAL MOMENT",
      "FUSION",
      "2つの原子核が、ひとつになる",
      650,
    );
    safeCubeCommand((cube) => {
      cube.turnLightOnRGB(255, 245, 180, 0);
      cube.playMelody([
        { note: 72, duration: 10 },
        { note: 76, duration: 10 },
        { note: 79, duration: 10 },
        { note: 84, duration: 24 },
      ]);
    });
    playExplosionSound();
    await pause(220, token);
    await runFusionShake(
      token,
      CONFIG.FUSION_SHAKE_CYCLES,
    );
    await pause(650, token);

    // 7. エネルギー放出。2台は密着したまま、余震としてさらに激しく振動。
    setScene(
      "release",
      "ENERGY RELEASE",
      "エネルギー放出",
      "融合したまま、光と衝撃波が空間へ広がる",
      2200,
    );
    browserSweep(1100, 120, 1.25, 0.08);
    setCubeLight([255, 194, 34]);
    await runFusionShake(
      token,
      CONFIG.RELEASE_SHAKE_CYCLES,
      CONFIG.FUSION_PUSH_SPEED + 10,
      CONFIG.FUSION_WIGGLE + 6,
    );
    safeCubeCommand((cube) => {
      cube.playMelody([
        { note: 84, duration: 8 },
        { note: 76, duration: 8 },
        { note: 68, duration: 8 },
        { note: 60, duration: 12 },
      ]);
    });
    await pause(1650, token);

    // 8. 終了
    setScene(
      "finished",
      "REACTION COMPLETE",
      "小さな太陽が生まれた",
      "温度は速度に。エネルギーは光と音と動きになった。",
      900,
    );
    stopAllToio();
    setCubeLight([255, 178, 20], 1900);
    safeCubeCommand((cube) => cube.playSE(P5tCube.seId.get3));
    browserTone(784, 0.28, 0.06);
    await pause(2100, token);
    stopAllToio();
    state.running = false;
    elements.operationHint.textContent =
      "STOP / RESETで、もう一度体験できます";
  } catch (error) {
    if (error.message === "mat-coordinates-lost") {
      stopAllToio();
      setScene(
        "ready",
        "TRACKING LOST",
        "マット座標を見失いました",
        "2台をシンプルマット上へ戻してから、もう一度FUSIONを押してください",
      );
      elements.operationHint.textContent =
        "座標表示が戻ったらFUSIONを再実行できます";
      elements.fusionButton.disabled = false;
    } else if (error.message === "coordinate-target-timeout") {
      stopAllToio();
      const current = formatCubeCoordinates() || "座標取得中";
      const target = error.targets
        ? formatTargets(error.targets)
        : "目標座標を確認できません";
      setScene(
        "ready",
        "POSITION TIMEOUT",
        "目標座標へ移動できませんでした",
        `現在 ${current} ／ 目標 ${target}`,
      );
      elements.operationHint.textContent =
        "位置を直したらFUSIONをもう一度押してください";
      elements.fusionButton.disabled = false;
    } else if (error.message !== "sequence-cancelled") {
      console.error("fusion sequence failed", error);
      stopAllToio();
    }
  } finally {
    if (token === state.runToken) {
      state.running = false;
      elements.resetButton.classList.remove("is-armed");
      elements.modeButtons.forEach((button) => {
        button.disabled = false;
      });
    }
  }
}

function resetExperience() {
  state.runToken += 1;
  state.running = false;
  stopHeating();
  stopExplosionSound();
  stopBgm(true);
  stopAllToio();
  updateTemperature(0);
  elements.heatButton.hidden = false;
  elements.fusionButton.hidden = true;
  elements.fusionButton.disabled = true;
  elements.resetButton.classList.remove("is-armed");
  elements.modeButtons.forEach((button) => {
    button.disabled = false;
  });
  elements.operationHint.textContent =
    state.mode === "toio" && state.cubes.length < 2
      ? "Core Cubeを2台接続すると開始できます"
      : state.mode === "toio" && !coordinatesReady()
        ? "2台をシンプルマット上に置くと開始できます"
        : "ボタンを7秒間長押ししてください";
  setScene(
    "idle",
    "SYSTEM STANDBY",
    "核融合炉を起動してください",
    "2つの原子核にエネルギーを与えます",
  );
  updateActionAvailability();
}

elements.modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});
elements.connectButton.addEventListener("click", connectToio);
elements.demoFallback.addEventListener("click", () => setMode("demo"));
elements.bgmToggle.addEventListener("click", () => {
  setBgmEnabled(!state.bgmEnabled);
});
elements.resetButton.addEventListener("click", resetExperience);
elements.fusionButton.addEventListener("click", runFusionSequence);

elements.heatButton.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  elements.heatButton.setPointerCapture?.(event.pointerId);
  startHeating(event);
});
elements.heatButton.addEventListener("pointerup", stopHeating);
elements.heatButton.addEventListener("pointercancel", stopHeating);
elements.heatButton.addEventListener("lostpointercapture", stopHeating);
elements.heatButton.addEventListener("contextmenu", (event) =>
  event.preventDefault(),
);
elements.heatButton.addEventListener("keydown", (event) => {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    startHeating(event);
  }
});
elements.heatButton.addEventListener("keyup", (event) => {
  if (event.key === " " || event.key === "Enter") stopHeating();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") resetExperience();
});
window.addEventListener("blur", stopHeating);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopHeating();
});

window.setInterval(() => {
  if (state.mode === "toio" && state.cubes.length === 2) {
    renderConnectionState();
    updateActionAvailability();
  }
}, 350);

updateTemperature(0);
updateBgmToggle();
setMode("demo");
