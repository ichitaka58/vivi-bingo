"use client";

import { useEffect, useRef, useState } from "react";

type GaraponDrawProps = {
  drawSeq: number;
  targetNumber: number | null;
  idleNumber: number | null;
  onRevealComplete: () => void;
};

type Vec3 = [number, number, number];

type MeshBuffers = {
  pos: WebGLBuffer;
  nrm: WebGLBuffer;
  uv: WebGLBuffer;
  idx: WebGLBuffer;
  count: number;
};

type Geometry = {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
};

// ---------- matrix helpers (column-major, no external deps) ----------
function mat4Identity(): Float32Array {
  return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
  }
  return out;
}
function mat4Translate(x: number, y: number, z: number): Float32Array {
  const m = mat4Identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}
function mat4RotateX(rad: number): Float32Array {
  const c = Math.cos(rad),
    s = Math.sin(rad);
  const m = mat4Identity();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}
function mat4RotateY(rad: number): Float32Array {
  const c = Math.cos(rad),
    s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}
function mat4RotateZ(rad: number): Float32Array {
  const c = Math.cos(rad),
    s = Math.sin(rad);
  const m = mat4Identity();
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}
function mat4Scale(s: number): Float32Array {
  const m = mat4Identity();
  m[0] = s;
  m[5] = s;
  m[10] = s;
  return m;
}
function mat4Perspective(
  fovy: number,
  aspect: number,
  near: number,
  far: number
): Float32Array {
  const f = 1 / Math.tan(fovy / 2),
    nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}
function mat3FromMat4(m: Float32Array): Float32Array {
  return new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
}

// ---------- geometry ----------
function buildSphere(latBands: number, lonBands: number, radius: number): Geometry {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let lat = 0; lat <= latBands; lat++) {
    const theta = (lat * Math.PI) / latBands;
    const sinT = Math.sin(theta),
      cosT = Math.cos(theta);
    for (let lon = 0; lon <= lonBands; lon++) {
      const phi = (lon * 2 * Math.PI) / lonBands;
      const sinP = Math.sin(phi),
        cosP = Math.cos(phi);
      const x = cosP * sinT,
        y = cosT,
        z = sinP * sinT;
      positions.push(radius * x, radius * y, radius * z);
      normals.push(x, y, z);
      uvs.push(lon / lonBands, lat / latBands);
    }
  }
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const first = lat * (lonBands + 1) + lon;
      const second = first + lonBands + 1;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }
  return { positions, normals, uvs, indices };
}

// 背面カリングは使わないため、面の巻き順は気にせず作れる
function buildBox(hw: number, hh: number, hd: number): Geometry {
  const positions = [
    hw, -hh, -hd, hw, hh, -hd, hw, hh, hd, hw, -hh, hd, // +X
    -hw, -hh, hd, -hw, hh, hd, -hw, hh, -hd, -hw, -hh, -hd, // -X
    -hw, hh, -hd, -hw, hh, hd, hw, hh, hd, hw, hh, -hd, // +Y
    -hw, -hh, hd, -hw, -hh, -hd, hw, -hh, -hd, hw, -hh, hd, // -Y
    -hw, -hh, hd, hw, -hh, hd, hw, hh, hd, -hw, hh, hd, // +Z
    hw, -hh, -hd, -hw, -hh, -hd, -hw, hh, -hd, hw, hh, -hd, // -Z
  ];
  const faceNormals: Vec3[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) normals.push(faceNormals[f][0], faceNormals[f][1], faceNormals[f][2]);
    uvs.push(0, 0, 0, 1, 1, 1, 1, 0);
    const base = f * 4;
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return { positions, normals, uvs, indices };
}

function buildPrism(sides: number, radius: number, halfLength: number): Geometry {
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  let vi = 0;
  for (let i = 0; i < sides; i++) {
    const t0 = (i / sides) * Math.PI * 2,
      t1 = ((i + 1) / sides) * Math.PI * 2;
    const y0 = radius * Math.cos(t0),
      z0 = radius * Math.sin(t0);
    const y1 = radius * Math.cos(t1),
      z1 = radius * Math.sin(t1);
    const mid = (t0 + t1) / 2;
    const nY = Math.cos(mid),
      nZ = Math.sin(mid);
    const verts: Vec3[] = [
      [-halfLength, y0, z0],
      [halfLength, y0, z0],
      [halfLength, y1, z1],
      [-halfLength, y1, z1],
    ];
    verts.forEach((p) => {
      positions.push(p[0], p[1], p[2]);
      normals.push(0, nY, nZ);
    });
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
    vi += 4;
  }
  function buildCap(xPos: number, normalX: number) {
    const centerIdx = vi;
    positions.push(xPos, 0, 0);
    normals.push(normalX, 0, 0);
    uvs.push(0.5, 0.5);
    vi++;
    const start = vi;
    for (let i = 0; i <= sides; i++) {
      const t = (i / sides) * Math.PI * 2;
      positions.push(xPos, radius * Math.cos(t), radius * Math.sin(t));
      normals.push(normalX, 0, 0);
      uvs.push(0.5 + 0.5 * Math.cos(t), 0.5 + 0.5 * Math.sin(t));
      vi++;
    }
    for (let i = 0; i < sides; i++) indices.push(centerIdx, start + i, start + i + 1);
  }
  buildCap(halfLength, 1);
  buildCap(-halfLength, -1);
  return { positions, normals, uvs, indices };
}

const DRUM_RADIUS = 0.6;
const DRUM_HALF_LEN = 0.32;
const DRUM_SIDES = 8;
const DRUM_CENTER: Vec3 = [0, 0.85, 0];
const DRUM_ORIENT_Y = 0.5;
const CHUTE_POS: Vec3 = [0.3, 0.28, 0.34];
const TRAY_POS: Vec3 = [0.15, -0.35, 0.5];
const SMALL_SCALE = 0.2;
const BIG_SCALE = 0.42;
const BALL_START: Vec3 = [0.3, 0.26, 0.34];
const BALL_MOUTH: Vec3 = [0.3, 0.14, 0.42];
const BALL_END: Vec3 = [0.09, 0.02, 0.5];
const DRUM_COLOR: Vec3 = [0.541, 0.353, 0.204];
const CRANK_COLOR: Vec3 = [0.486, 0.325, 0.188];
const HANDLE_COLOR: Vec3 = [0.16, 0.14, 0.12];
const CHUTE_COLOR: Vec3 = [0.663, 0.478, 0.29];
const TRAY_COLOR: Vec3 = [0.541, 0.373, 0.22];
const TEX_W = 1024;
const TEX_H = 512;
const FRONT_X = TEX_W * 0.25 + 3;
const FRONT_Y = TEX_H * 0.5 + 22;
const LABEL_ROTATE = (-26 * Math.PI) / 180;

function columnColorFor(n: number): string {
  if (n <= 15) return "#e11d2e";
  if (n <= 30) return "#ffc93c";
  if (n <= 45) return "#1f2a44";
  if (n <= 60) return "#6b5a8a";
  return "#b3121f";
}

type BallState = { pos: Vec3; rx: number; ry: number; rz: number; scale: number } | null;

type Engine = {
  renderScene: (drumAngle: number, ball: BallState) => void;
  drawLabel: (n: number) => void;
};

function initEngine(canvas: HTMLCanvasElement, cssW: number, cssH: number): Engine | null {
  const gl = canvas.getContext("webgl");
  if (!gl) return null;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  const vsSource = `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec2 aUv;
    uniform mat4 uModel;
    uniform mat4 uView;
    uniform mat4 uProjection;
    uniform mat3 uNormalMatrix;
    varying vec3 vNormalWorld;
    varying vec3 vWorldPos;
    varying vec2 vUv;
    void main() {
      vec4 worldPos = uModel * vec4(aPosition, 1.0);
      vWorldPos = worldPos.xyz;
      vNormalWorld = normalize(uNormalMatrix * aNormal);
      vUv = aUv;
      gl_Position = uProjection * uView * worldPos;
    }
  `;
  const fsSource = `
    precision mediump float;
    varying vec3 vNormalWorld;
    varying vec3 vWorldPos;
    varying vec2 vUv;
    uniform vec3 uBaseColor;
    uniform sampler2D uTex;
    uniform float uUseTexture;
    uniform vec3 uLightDir;
    uniform vec3 uCameraPos;
    uniform vec3 uRimColor;
    void main() {
      vec3 N = normalize(vNormalWorld);
      vec3 V = normalize(uCameraPos - vWorldPos);
      vec3 texColor = texture2D(uTex, vUv).rgb;
      vec3 albedo = mix(uBaseColor, texColor, uUseTexture);
      float ambient = 0.42;
      float diff = max(dot(N, uLightDir), 0.0);
      vec3 H = normalize(uLightDir + V);
      float spec = pow(max(dot(N, H), 0.0), 30.0);
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), 2.5);
      vec3 color = albedo * (ambient + diff * 0.72)
        + vec3(1.0, 0.95, 0.78) * spec * 0.85
        + uRimColor * fresnel * 0.5;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compileShader(type: number, src: string) {
    const s = gl!.createShader(type)!;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    return s;
  }
  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram()!;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aNormal = gl.getAttribLocation(program, "aNormal");
  const aUv = gl.getAttribLocation(program, "aUv");
  const uModel = gl.getUniformLocation(program, "uModel");
  const uView = gl.getUniformLocation(program, "uView");
  const uProjection = gl.getUniformLocation(program, "uProjection");
  const uNormalMatrix = gl.getUniformLocation(program, "uNormalMatrix");
  const uBaseColor = gl.getUniformLocation(program, "uBaseColor");
  const uTex = gl.getUniformLocation(program, "uTex");
  const uUseTexture = gl.getUniformLocation(program, "uUseTexture");
  const uLightDir = gl.getUniformLocation(program, "uLightDir");
  const uCameraPos = gl.getUniformLocation(program, "uCameraPos");
  const uRimColor = gl.getUniformLocation(program, "uRimColor");

  function makeBuffer(target: number, data: number[], Ctor: typeof Float32Array | typeof Uint16Array) {
    const buf = gl!.createBuffer()!;
    gl!.bindBuffer(target, buf);
    gl!.bufferData(target, new Ctor(data), gl!.STATIC_DRAW);
    return buf;
  }
  function makeMesh(geo: Geometry): MeshBuffers {
    return {
      pos: makeBuffer(gl!.ARRAY_BUFFER, geo.positions, Float32Array),
      nrm: makeBuffer(gl!.ARRAY_BUFFER, geo.normals, Float32Array),
      uv: makeBuffer(gl!.ARRAY_BUFFER, geo.uvs, Float32Array),
      idx: makeBuffer(gl!.ELEMENT_ARRAY_BUFFER, geo.indices, Uint16Array),
      count: geo.indices.length,
    };
  }

  const sphereBuf = makeMesh(buildSphere(28, 28, 1.0));
  const drumBuf = makeMesh(buildPrism(DRUM_SIDES, DRUM_RADIUS, DRUM_HALF_LEN));
  const crankArmBuf = makeMesh(buildBox(0.045, DRUM_RADIUS * 0.5, 0.045));
  const crankHandleBuf = makeMesh(buildBox(0.11, 0.05, 0.05));
  const crankArmLocal: Vec3 = [DRUM_HALF_LEN + 0.05, DRUM_RADIUS * 0.55, 0];
  const crankHandleLocal: Vec3 = [DRUM_HALF_LEN + 0.05, DRUM_RADIUS * 1.05, 0];
  const chuteBuf = makeMesh(buildBox(0.11, 0.13, 0.11));
  const trayBuf = makeMesh(buildBox(0.32, 0.06, 0.28));

  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = TEX_W;
  labelCanvas.height = TEX_H;
  const labelCtx = labelCanvas.getContext("2d")!;

  function drawLabel(number: number) {
    const ballColor = columnColorFor(number);
    const ctx = labelCtx;
    ctx.clearRect(0, 0, TEX_W, TEX_H);
    ctx.fillStyle = ballColor;
    ctx.fillRect(0, 0, TEX_W, TEX_H);

    ctx.save();
    ctx.translate(FRONT_X, FRONT_Y);
    ctx.rotate(LABEL_ROTATE);
    ctx.translate(-FRONT_X, -FRONT_Y);
    ctx.translate(FRONT_X, 0);
    ctx.scale(-1, 1);
    ctx.translate(-FRONT_X, 0);

    ctx.fillStyle = "#fffaf0";
    ctx.beginPath();
    ctx.arc(FRONT_X, FRONT_Y, 86, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1a1a1a";
    ctx.font = '800 96px "Baloo 2", sans-serif';
    ctx.fillText(String(number), FRONT_X, FRONT_Y + 6);
    ctx.restore();

    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.pixelStorei(gl!.UNPACK_FLIP_Y_WEBGL, false);
    gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, gl!.RGBA, gl!.UNSIGNED_BYTE, labelCanvas);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
  }

  const projection = mat4Perspective((34 * Math.PI) / 180, cssW / cssH, 0.1, 30);
  const view = mat4Translate(0, -0.5, -6.2);
  const cameraPos: Vec3 = [0, -0.5, 6.2];
  const lightDirRaw: Vec3 = [0.55, 0.72, 0.55];
  const lightLen = Math.hypot(lightDirRaw[0], lightDirRaw[1], lightDirRaw[2]);
  const lightDir: Vec3 = [lightDirRaw[0] / lightLen, lightDirRaw[1] / lightLen, lightDirRaw[2] / lightLen];
  const rimColor: Vec3 = [1.0, 0.82, 0.4];

  function drawMesh(buf: MeshBuffers, model: Float32Array, baseColor: Vec3, useTexture: number) {
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf.pos);
    gl!.vertexAttribPointer(aPosition, 3, gl!.FLOAT, false, 0, 0);
    gl!.enableVertexAttribArray(aPosition);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf.nrm);
    gl!.vertexAttribPointer(aNormal, 3, gl!.FLOAT, false, 0, 0);
    gl!.enableVertexAttribArray(aNormal);
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf.uv);
    gl!.vertexAttribPointer(aUv, 2, gl!.FLOAT, false, 0, 0);
    gl!.enableVertexAttribArray(aUv);
    gl!.bindBuffer(gl!.ELEMENT_ARRAY_BUFFER, buf.idx);

    gl!.uniformMatrix4fv(uModel, false, model);
    gl!.uniformMatrix4fv(uView, false, view);
    gl!.uniformMatrix4fv(uProjection, false, projection);
    gl!.uniformMatrix3fv(uNormalMatrix, false, mat3FromMat4(model));
    gl!.uniform3fv(uBaseColor, baseColor);
    gl!.uniform1f(uUseTexture, useTexture);
    gl!.uniform3fv(uLightDir, lightDir);
    gl!.uniform3fv(uCameraPos, cameraPos);
    gl!.uniform3fv(uRimColor, rimColor);
    gl!.activeTexture(gl!.TEXTURE0);
    gl!.bindTexture(gl!.TEXTURE_2D, texture);
    gl!.uniform1i(uTex, 0);

    gl!.drawElements(gl!.TRIANGLES, buf.count, gl!.UNSIGNED_SHORT, 0);
  }

  function renderScene(drumAngle: number, ball: BallState) {
    gl!.viewport(0, 0, canvas.width, canvas.height);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);

    const drumOrient = mat4RotateY(DRUM_ORIENT_Y);
    const drumSpin = mat4RotateX(drumAngle);
    const drumRot = mat4Multiply(drumOrient, drumSpin);
    const drumCenterT = mat4Translate(DRUM_CENTER[0], DRUM_CENTER[1], DRUM_CENTER[2]);
    const drumModel = mat4Multiply(drumCenterT, drumRot);
    drawMesh(drumBuf, drumModel, DRUM_COLOR, 0.0);

    const armLocalT = mat4Translate(crankArmLocal[0], crankArmLocal[1], crankArmLocal[2]);
    const armModel = mat4Multiply(drumCenterT, mat4Multiply(drumRot, armLocalT));
    drawMesh(crankArmBuf, armModel, CRANK_COLOR, 0.0);

    const handleLocalT = mat4Translate(crankHandleLocal[0], crankHandleLocal[1], crankHandleLocal[2]);
    const handleModel = mat4Multiply(drumCenterT, mat4Multiply(drumRot, handleLocalT));
    drawMesh(crankHandleBuf, handleModel, HANDLE_COLOR, 0.0);

    drawMesh(chuteBuf, mat4Translate(CHUTE_POS[0], CHUTE_POS[1], CHUTE_POS[2]), CHUTE_COLOR, 0.0);
    drawMesh(trayBuf, mat4Translate(TRAY_POS[0], TRAY_POS[1], TRAY_POS[2]), TRAY_COLOR, 0.0);

    if (ball) {
      const t = mat4Translate(ball.pos[0], ball.pos[1], ball.pos[2]);
      const r = mat4Multiply(mat4RotateX(ball.rx), mat4Multiply(mat4RotateY(ball.ry), mat4RotateZ(ball.rz)));
      const s = mat4Scale(ball.scale);
      const ballModel = mat4Multiply(t, mat4Multiply(r, s));
      drawMesh(sphereBuf, ballModel, [1, 1, 1], 1.0);
    }
  }

  return { renderScene, drawLabel };
}

const REVEAL_PAUSE_MS = 900;

export default function GaraponDraw({ drawSeq, targetNumber, idleNumber, onRevealComplete }: GaraponDrawProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const drumAngleRef = useRef(0);
  const busyRef = useRef(false);
  const lastSeqRef = useRef(drawSeq);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = initEngine(canvas, 260, 300);
    if (!engine) {
      setWebglOk(false);
      return;
    }
    engineRef.current = engine;
    if (idleNumber !== null) {
      engine.drawLabel(idleNumber);
      engine.renderScene(0, { pos: BALL_END, rx: 0, ry: 0, rz: 0, scale: BIG_SCALE });
      shadowRef.current?.classList.add("show");
    } else {
      engine.renderScene(0, null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (drawSeq === lastSeqRef.current || targetNumber === null) return;
    lastSeqRef.current = drawSeq;
    const engine = engineRef.current;
    if (!engine || busyRef.current) return;
    busyRef.current = true;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const turns = 3 + Math.random() * 1.5;
    const startAngle = drumAngleRef.current;
    const targetAngle = startAngle + turns * Math.PI * 2;
    const spinDuration = reduceMotion ? 0 : 1700;
    const fallDuration = reduceMotion ? 0 : 850;
    const rollDuration = reduceMotion ? 0 : 300;

    let lastRX = 0;
    let lastRY = 0;

    function easeInOutCubic(t: number) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function spinFrame(now: number, t0: number) {
      const t = Math.min((now - t0) / spinDuration, 1);
      const e = easeInOutCubic(t);
      const angle = startAngle + (targetAngle - startAngle) * e;
      drumAngleRef.current = angle;
      engine!.renderScene(angle, null);
      if (t < 1) {
        requestAnimationFrame((n) => spinFrame(n, t0));
      } else {
        startFall();
      }
    }

    if (spinDuration === 0) {
      drumAngleRef.current = targetAngle;
      engine.renderScene(drumAngleRef.current, null);
      startFall();
    } else {
      const t0 = performance.now();
      requestAnimationFrame((n) => spinFrame(n, t0));
    }

    function startFall() {
      engine!.drawLabel(targetNumber as number);
      function rollFrame(now: number, t0r: number) {
        const t = Math.min((now - t0r) / rollDuration, 1);
        const pos: Vec3 = [
          BALL_START[0] + (BALL_MOUTH[0] - BALL_START[0]) * t,
          BALL_START[1] + (BALL_MOUTH[1] - BALL_START[1]) * t,
          BALL_START[2] + (BALL_MOUTH[2] - BALL_START[2]) * t,
        ];
        const rz = t * Math.PI * 2 * 1.4;
        lastRX = 0;
        lastRY = 0;
        engine!.renderScene(drumAngleRef.current, { pos, rx: 0, ry: 0, rz, scale: SMALL_SCALE });
        if (t < 1) {
          requestAnimationFrame((n) => rollFrame(n, t0r));
        } else {
          fall();
        }
      }
      if (rollDuration === 0) {
        engine!.renderScene(drumAngleRef.current, { pos: BALL_MOUTH, rx: 0, ry: 0, rz: 0, scale: SMALL_SCALE });
        fall();
      } else {
        const t0r = performance.now();
        requestAnimationFrame((n) => rollFrame(n, t0r));
      }
    }

    function fall() {
      function fallFrame(now: number, t1: number) {
        const t = Math.min((now - t1) / fallDuration, 1);
        const te = t * t;
        const pos: Vec3 = [
          BALL_MOUTH[0] + (BALL_END[0] - BALL_MOUTH[0]) * t,
          BALL_MOUTH[1] + (BALL_END[1] - BALL_MOUTH[1]) * te,
          BALL_MOUTH[2] + (BALL_END[2] - BALL_MOUTH[2]) * t,
        ];
        lastRX = t * Math.PI * 2 * 3;
        lastRY = t * Math.PI * 2 * 2;
        const rz = t * Math.PI * 2 * 1.8;
        engine!.renderScene(drumAngleRef.current, { pos, rx: lastRX, ry: lastRY, rz, scale: SMALL_SCALE });
        if (t < 1) {
          requestAnimationFrame((n) => fallFrame(n, t1));
        } else {
          shadowRef.current?.classList.add("show");
          runHops(0, [BALL_END[0], BALL_END[2]], 0, performance.now());
        }
      }
      if (fallDuration === 0) {
        lastRX = 0;
        lastRY = 0;
        engine!.renderScene(drumAngleRef.current, { pos: BALL_END, rx: 0, ry: 0, rz: 0, scale: SMALL_SCALE });
        shadowRef.current?.classList.add("show");
        runHops(0, [BALL_END[0], BALL_END[2]], 0, performance.now());
      } else {
        const t1 = performance.now();
        requestAnimationFrame((n) => fallFrame(n, t1));
      }
    }

    const hops = [
      { peak: 0.16, duration: 230, driftX: 0.06, driftZ: 0.04 },
      { peak: 0.07, duration: 180, driftX: 0.03, driftZ: 0.02 },
      { peak: 0.028, duration: 140, driftX: 0.012, driftZ: 0.008 },
    ];

    function runHops(index: number, restXZ: [number, number], rollAngle: number, tHop: number) {
      if (index >= hops.length || reduceMotion) {
        finish(restXZ, rollAngle);
        return;
      }
      const hop = hops[index];
      const startXZ = restXZ.slice() as [number, number];
      const endXZ: [number, number] = [restXZ[0] + hop.driftX, restXZ[1] + hop.driftZ];
      function hopFrame(now: number) {
        const u = Math.min((now - tHop) / hop.duration, 1);
        const y = BALL_END[1] + hop.peak * Math.sin(Math.PI * u);
        const x = startXZ[0] + (endXZ[0] - startXZ[0]) * u;
        const z = startXZ[1] + (endXZ[1] - startXZ[1]) * u;
        const rollDelta = (Math.hypot(hop.driftX, hop.driftZ) / 0.3) * u;
        const angle = rollAngle + rollDelta;
        let scale: number;
        if (index === 0) {
          const st = Math.min((now - tHop) / 150, 1);
          scale = SMALL_SCALE + (BIG_SCALE - SMALL_SCALE) * (1 - Math.pow(1 - st, 3));
        } else {
          scale = BIG_SCALE;
        }
        engine!.renderScene(drumAngleRef.current, { pos: [x, y, z], rx: lastRX, ry: lastRY, rz: angle, scale });
        if (u < 1) {
          requestAnimationFrame(hopFrame);
        } else {
          runHops(index + 1, [x, z], angle, performance.now());
        }
      }
      requestAnimationFrame(hopFrame);
    }

    function finish(restXZ: [number, number], rollAngle: number) {
      engine!.renderScene(drumAngleRef.current, {
        pos: [restXZ[0], BALL_END[1], restXZ[1]],
        rx: lastRX,
        ry: lastRY,
        rz: rollAngle,
        scale: BIG_SCALE,
      });
      setTimeout(() => {
        busyRef.current = false;
        onRevealComplete();
      }, REVEAL_PAUSE_MS);
    }
  }, [drawSeq, targetNumber, onRevealComplete]);

  if (!webglOk) {
    return (
      <p className="flex h-24 items-center justify-center text-sm font-bold text-matsuri-red">
        お使いの環境ではこの演出を表示できません。
      </p>
    );
  }

  return (
    <div className="relative mx-auto" style={{ width: 260, height: 300 }}>
      <div ref={shadowRef} className="admin-garapon-shadow" />
      <canvas ref={canvasRef} style={{ width: 260, height: 300, display: "block" }} />
    </div>
  );
}
