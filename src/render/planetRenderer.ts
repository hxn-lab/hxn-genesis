import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { VisualQualityPreset } from '../sim/types';
import { WorldSimulation } from '../sim/world';
import { renderScaleForRadius } from '../sim/planetPhysics';

export type OverlayLayerMode =
  | 'TRUE_COLOR'
  | 'BIOSPHERE'
  | 'HABITABILITY'
  | 'BIOMASS'
  | 'FAUNA'
  | 'BIODIVERSITY'
  | 'EXTINCTION_IMPACT'
  | 'TEMPERATURE'
  | 'ELEVATION'
  | 'PRECIPITATION'
  | 'ICE'
  | 'WIND'
  | 'RADIATION'
  | 'MINERALS'
  | 'CIVILIZATION';

export type CameraPresetMode = 'DEFAULT' | 'NORTH_POLE' | 'SOUTH_POLE' | 'EQUATOR';

export interface RaycastHitCoordinate {
  latDeg: number;
  lonDeg: number;
  point: THREE.Vector3;
}

export class PlanetRenderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public controls: OrbitControls;

  public overlayMode: OverlayLayerMode = 'TRUE_COLOR';
  public visualQuality: VisualQualityPreset = 'High';
  public graticuleVisible = false;
  public magnetosphereVisible = false;
  public colorVisionMode: 'STANDARD' | 'DEUTERANOPIA_SAFE' | 'PROTANOPIA_SAFE' | 'TRITANOPIA_SAFE' = 'STANDARD';

  private planetRootGroup: THREE.Group;
  private graticuleGroup: THREE.Group;
  private magnetosphereGroup: THREE.Group;
  private expeditionGroup: THREE.Group;
  private axisIndicator: THREE.Line;

  private terrainMesh: THREE.Mesh;
  private terrainGeo: THREE.SphereGeometry;
  private basePositions: Float32Array;
  private vertexLatRad: Float32Array;
  private vertexLonRad: Float32Array;

  private oceanMesh: THREE.Mesh;
  private oceanGeo: THREE.SphereGeometry;
  private oceanBasePositions: Float32Array;
  private oceanVertexLatRad: Float32Array;
  private oceanVertexLonRad: Float32Array;

  private cloudMesh: THREE.Mesh;
  private cloudTexture: THREE.DataTexture;
  private cloudData: Uint8Array<ArrayBuffer>;

  private atmosphereMesh: THREE.Mesh;
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.HemisphereLight;
  private selectionRing: THREE.Mesh;
  private hoverPreviewRing: THREE.Mesh;
  private hazardGroup: THREE.Group;
  private faunaPoints: THREE.Points;
  private faunaGeo: THREE.BufferGeometry;

  private cameraTargetPos: THREE.Vector3 | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private readonly planetRadius = 10.0;
  private readonly radialExaggeration = 0.000115;

  constructor(container: HTMLElement, world: WorldSimulation) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x04070d);

    this.camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / Math.max(1, container.clientHeight),
      0.1,
      1000
    );
    this.camera.position.set(0, 6.5, 25.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8.5;
    this.controls.maxDistance = 75.0;
    this.controls.rotateSpeed = 0.65;

    this.createStarfield();

    this.ambientLight = new THREE.HemisphereLight(0x6088b8, 0x151c28, 0.44);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff6e5, 2.75);
    this.sunLight.position.set(40, 8, 20);
    this.scene.add(this.sunLight);

    this.planetRootGroup = new THREE.Group();
    this.scene.add(this.planetRootGroup);

    // 1. Crust Terrain Sphere
    this.terrainGeo = new THREE.SphereGeometry(this.planetRadius, 160, 80);
    const posAttr = this.terrainGeo.attributes.position as THREE.BufferAttribute;
    this.basePositions = new Float32Array(posAttr.array.length);
    this.basePositions.set(posAttr.array);

    const vCount = posAttr.count;
    this.vertexLatRad = new Float32Array(vCount);
    this.vertexLonRad = new Float32Array(vCount);

    const colors = new Float32Array(vCount * 3);
    for (let i = 0; i < vCount; i++) {
      const vx = this.basePositions[i * 3] / this.planetRadius;
      const vy = this.basePositions[i * 3 + 1] / this.planetRadius;
      const vz = this.basePositions[i * 3 + 2] / this.planetRadius;
      this.vertexLatRad[i] = Math.asin(Math.max(-1, Math.min(1, vy)));
      this.vertexLonRad[i] = Math.atan2(vz, vx);
    }
    this.terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const terrainMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.06,
      flatShading: false
    });
    this.terrainMesh = new THREE.Mesh(this.terrainGeo, terrainMat);
    this.planetRootGroup.add(this.terrainMesh);

    // 2. Ocean Sphere
    this.oceanGeo = new THREE.SphereGeometry(this.planetRadius, 120, 60);
    const oceanPosAttr = this.oceanGeo.attributes.position as THREE.BufferAttribute;
    this.oceanBasePositions = new Float32Array(oceanPosAttr.array.length);
    this.oceanBasePositions.set(oceanPosAttr.array);
    const oCount = oceanPosAttr.count;
    this.oceanVertexLatRad = new Float32Array(oCount);
    this.oceanVertexLonRad = new Float32Array(oCount);
    const oceanColors = new Float32Array(oCount * 3);
    for (let i = 0; i < oCount; i++) {
      const vx = this.oceanBasePositions[i * 3] / this.planetRadius;
      const vy = this.oceanBasePositions[i * 3 + 1] / this.planetRadius;
      const vz = this.oceanBasePositions[i * 3 + 2] / this.planetRadius;
      this.oceanVertexLatRad[i] = Math.asin(Math.max(-1, Math.min(1, vy)));
      this.oceanVertexLonRad[i] = Math.atan2(vz, vx);
    }
    this.oceanGeo.setAttribute('color', new THREE.BufferAttribute(oceanColors, 3));

    const oceanMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.84,
      roughness: 0.18,
      metalness: 0.08,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15
    });
    this.oceanMesh = new THREE.Mesh(this.oceanGeo, oceanMat);
    this.planetRootGroup.add(this.oceanMesh);

    // 3. Dynamic Atmospheric Cloud & Storm Layer
    this.cloudData = new Uint8Array(world.gridWidth * world.gridHeight * 4);
    this.cloudTexture = new THREE.DataTexture(
      this.cloudData,
      world.gridWidth,
      world.gridHeight,
      THREE.RGBAFormat
    );
    this.cloudTexture.wrapS = THREE.RepeatWrapping;
    this.cloudTexture.wrapT = THREE.ClampToEdgeWrapping;
    this.cloudTexture.magFilter = THREE.LinearFilter;
    this.cloudTexture.minFilter = THREE.LinearFilter;

    const cloudGeo = new THREE.SphereGeometry(this.planetRadius * 1.022, 96, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: this.cloudTexture,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 0.95
    });
    this.cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    this.planetRootGroup.add(this.cloudMesh);

    // 4. Rayleigh / Fresnel Atmospheric Halo Shader
    const atmoGeo = new THREE.SphereGeometry(this.planetRadius * 1.065, 64, 32);
    const atmoMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        glowColor: { value: new THREE.Color(0x3b82f6) },
        sunDir: { value: new THREE.Vector3(1, 0.2, 0.5).normalize() }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 sunDir;
        varying vec3 vNormal;
        varying vec3 vWorldNormal;
        void main() {
          float rim = pow(clamp(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.3);
          float daySide = clamp(dot(vWorldNormal, sunDir) * 0.65 + 0.45, 0.15, 1.0);
          gl_FragColor = vec4(glowColor * daySide, rim * 0.78);
        }
      `
    });
    this.atmosphereMesh = new THREE.Mesh(atmoGeo, atmoMat);
    this.planetRootGroup.add(this.atmosphereMesh);

    // 5. Coordinate Selection Cursor Ring
    const ringGeo = new THREE.RingGeometry(0.18, 0.26, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      depthTest: false
    });
    this.selectionRing = new THREE.Mesh(ringGeo, ringMat);
    this.selectionRing.visible = false;
    this.planetRootGroup.add(this.selectionRing);

    // 5b. Brush / Impact Radius Preview Ring on Hover
    const previewGeo = new THREE.RingGeometry(0.92, 1.0, 48);
    const previewMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
      depthTest: false
    });
    this.hoverPreviewRing = new THREE.Mesh(previewGeo, previewMat);
    this.hoverPreviewRing.visible = false;
    this.planetRootGroup.add(this.hoverPreviewRing);

    // 6. Active Hazards 3D Marker Group
    this.hazardGroup = new THREE.Group();
    this.planetRootGroup.add(this.hazardGroup);

    // 7. 3D Fauna Colony Bioluminescent / Ecosystem Markers
    this.faunaGeo = new THREE.BufferGeometry();
    const faunaMat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      transparent: true,
      opacity: 0.9
    });
    this.faunaPoints = new THREE.Points(this.faunaGeo, faunaMat);
    this.planetRootGroup.add(this.faunaPoints);

    const { group, axisLine } = this.createGraticuleAndAxis();
    this.graticuleGroup = group;
    this.axisIndicator = axisLine;
    this.graticuleGroup.visible = this.graticuleVisible;
    this.planetRootGroup.add(this.graticuleGroup);

    this.magnetosphereGroup = this.createMagnetosphereLines();
    this.magnetosphereGroup.visible = this.magnetosphereVisible;
    this.planetRootGroup.add(this.magnetosphereGroup);

    this.expeditionGroup = new THREE.Group();
    this.planetRootGroup.add(this.expeditionGroup);

    this.controls.addEventListener('start', () => {
      this.cameraTargetPos = null;
    });

    this.syncWithSimulation(world);
  }

  private createMagnetosphereLines(): THREE.Group {
    const group = new THREE.Group();
    const fieldMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.55 });
    const windMat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.4 });
    const lShells = [1.45, 1.95, 2.55];
    const meridians = [0, 45, 90, 135, 180, 225, 270, 315];

    for (const L of lShells) {
      for (const lonDeg of meridians) {
        const lon = (lonDeg * Math.PI) / 180;
        const pts: THREE.Vector3[] = [];
        for (let s = -36; s <= 36; s++) {
          const lam = (s / 36) * 1.15;
          const cosLam = Math.cos(lam);
          const r = this.planetRadius * L * cosLam * cosLam;
          if (r < this.planetRadius * 0.98) continue;
          const x = r * cosLam * Math.cos(lon);
          const y = r * Math.sin(lam);
          const z = r * cosLam * Math.sin(lon);
          pts.push(new THREE.Vector3(x, y, z));
        }
        if (pts.length > 2) {
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          group.add(new THREE.Line(geo, fieldMat));
        }
      }
    }

    for (let w = -2; w <= 2; w++) {
      const yOff = w * 3.8;
      const pts = [
        new THREE.Vector3(this.planetRadius * 3.2, yOff, -6),
        new THREE.Vector3(this.planetRadius * 2.2, yOff * 1.15, 0),
        new THREE.Vector3(this.planetRadius * 3.2, yOff, 6)
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, windMat));
    }

    return group;
  }

  public setMagnetosphereVisible(visible: boolean): void {
    this.magnetosphereVisible = visible;
    this.magnetosphereGroup.visible = visible;
  }

  public toggleMagnetosphere(): boolean {
    this.setMagnetosphereVisible(!this.magnetosphereVisible);
    return this.magnetosphereVisible;
  }

  public setCameraSpeedMultiplier(mult: number): void {
    const safe = Math.max(0.2, Math.min(3.5, mult));
    this.controls.rotateSpeed = 0.65 * safe;
    this.controls.zoomSpeed = 1.0 * safe;
    this.controls.panSpeed = 0.8 * safe;
  }

  public setColorVisionPalette(mode: 'STANDARD' | 'DEUTERANOPIA_SAFE' | 'PROTANOPIA_SAFE' | 'TRITANOPIA_SAFE'): void {
    this.colorVisionMode = mode;
  }

  private createGraticuleAndAxis(): { group: THREE.Group; axisLine: THREE.Line } {
    const group = new THREE.Group();
    const r = this.planetRadius * 1.036;
    const stdMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.25 });
    const eqMat = new THREE.LineBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.65 });

    // Latitude parallels (-60, -30, 0, 30, 60)
    for (const latDeg of [-60, -30, 0, 30, 60]) {
      const lat = (latDeg * Math.PI) / 180;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 72; s++) {
        const lon = (s / 72) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, latDeg === 0 ? eqMat : stdMat));
    }

    // Longitude meridians every 30 deg
    for (let lonDeg = -180; lonDeg < 180; lonDeg += 30) {
      const lon = (lonDeg * Math.PI) / 180;
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 48; s++) {
        const lat = ((s / 48) - 0.5) * Math.PI;
        pts.push(new THREE.Vector3(r * Math.cos(lat) * Math.cos(lon), r * Math.sin(lat), r * Math.cos(lat) * Math.sin(lon)));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, lonDeg === 0 ? eqMat : stdMat));
    }

    // Polar rotation axis indicator line
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -this.planetRadius * 1.32, 0),
      new THREE.Vector3(0, this.planetRadius * 1.32, 0)
    ]);
    const axisMat = new THREE.LineBasicMaterial({ color: 0xf43f5e, transparent: true, opacity: 0.85 });
    const axisLine = new THREE.Line(axisGeo, axisMat);
    group.add(axisLine);

    return { group, axisLine };
  }

  public setGraticuleVisible(visible: boolean): void {
    this.graticuleVisible = visible;
    this.graticuleGroup.visible = visible;
  }

  public toggleGraticule(): boolean {
    this.setGraticuleVisible(!this.graticuleVisible);
    return this.graticuleVisible;
  }

  public setCameraPreset(preset: 'DEFAULT' | 'NORTH_POLE' | 'SOUTH_POLE' | 'EQUATOR'): void {
    const scale = this.planetRootGroup.scale.x || 1;
    const dist = 25.5 * Math.max(0.8, scale);
    if (preset === 'NORTH_POLE') {
      this.cameraTargetPos = new THREE.Vector3(0.01, dist, 0.01);
    } else if (preset === 'SOUTH_POLE') {
      this.cameraTargetPos = new THREE.Vector3(0.01, -dist, 0.01);
    } else if (preset === 'EQUATOR') {
      this.cameraTargetPos = new THREE.Vector3(0, 0, dist);
    } else {
      this.cameraTargetPos = new THREE.Vector3(0, 6.5 * scale, dist);
    }
  }

  public setVisualQuality(quality: VisualQualityPreset): void {
    this.visualQuality = quality;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (quality === 'Low') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.0));
      this.cloudMesh.visible = false;
    } else if (quality === 'Medium') {
      this.renderer.setPixelRatio(Math.min(dpr, 1.35));
      this.cloudMesh.visible = true;
    } else {
      this.renderer.setPixelRatio(Math.min(dpr, 2.0));
      this.cloudMesh.visible = true;
    }
  }

  private createStarfield(): void {
    const starCount = 2200;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const r = 180 + Math.random() * 140;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      const tint = 0.78 + Math.random() * 0.22;
      colors[i * 3] = tint;
      colors[i * 3 + 1] = tint;
      colors[i * 3 + 2] = Math.min(1, tint + 0.1);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.65, vertexColors: true, transparent: true, opacity: 0.85 });
    this.scene.add(new THREE.Points(geo, mat));
  }

  public syncWithSimulation(world: WorldSimulation): void {
    const seaLevel = world.telemetry.effectiveSeaLevelMeters;
    const radiusScale = renderScaleForRadius(world.params.planet?.radiusKm ?? 6371);
    this.planetRootGroup.scale.setScalar(radiusScale);
    this.axisIndicator.rotation.z = (world.params.axialTiltDeg * Math.PI) / 180;

    const sunLat = world.params.sunLatitudeRad;
    const sunLon = world.params.sunLongitudeRad;
    const sx = Math.cos(sunLat) * Math.cos(sunLon);
    const sy = Math.sin(sunLat);
    const sz = Math.cos(sunLat) * Math.sin(sunLon);
    this.sunLight.position.set(sx * 50, sy * 50, sz * 50);
    this.sunLight.intensity = 2.4 * Math.sqrt(Math.max(0.1, world.params.solarLuminosity));

    const atmoMat = this.atmosphereMesh.material as THREE.ShaderMaterial;
    atmoMat.uniforms.sunDir.value.set(sx, sy, sz).normalize();

    const hazeFactor = Math.min(
      1,
      (world.params.co2Ppm - 280) / 4000 +
        world.params.volcanicActivity * 0.15 +
        world.telemetry.extinctionSeverity * 0.35
    );
    atmoMat.uniforms.glowColor.value.setRGB(
      0.23 + hazeFactor * 0.38,
      0.51 - hazeFactor * 0.14,
      0.96 - hazeFactor * 0.44
    );

    const posAttr = this.terrainGeo.attributes.position as THREE.BufferAttribute;
    const colAttr = this.terrainGeo.attributes.color as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    const vCount = posAttr.count;

    for (let i = 0; i < vCount; i++) {
      const lat = this.vertexLatRad[i];
      const lon = this.vertexLonRad[i];

      const elev = world.sampleFieldBilinear(world.elevation, lat, lon);
      const ice = world.sampleFieldBilinear(world.iceThickness, lat, lon);
      const tempK = world.sampleFieldBilinear(world.temperature, lat, lon);
      const hum = world.sampleFieldBilinear(world.humidity, lat, lon);
      const precip = world.sampleFieldBilinear(world.precipitation, lat, lon);
      const volc = world.sampleFieldBilinear(world.volcanicHeat, lat, lon);
      const sed = world.sampleFieldBilinear(world.sediment, lat, lon);
      const bio = world.sampleFieldBilinear(world.biomass, lat, lon);
      const fau = world.sampleFieldBilinear(world.fauna, lat, lon);
      const hab = world.sampleFieldBilinear(world.habitability, lat, lon);
      const biodiv = world.sampleFieldBilinear(world.biodiversity, lat, lon);
      const extImp = world.sampleFieldBilinear(world.extinctionImpact, lat, lon);

      const totalElev = elev + ice * 0.65;
      const rScale = 1.0 + (totalElev * this.radialExaggeration) / this.planetRadius;

      posArr[i * 3] = this.basePositions[i * 3] * rScale;
      posArr[i * 3 + 1] = this.basePositions[i * 3 + 1] * rScale;
      posArr[i * 3 + 2] = this.basePositions[i * 3 + 2] * rScale;

      let r = 0.35;
      let g = 0.33;
      let b = 0.3;

      if (this.overlayMode === 'TRUE_COLOR') {
        const aboveSea = elev - seaLevel;
        if (aboveSea < 0) {
          const depthFrac = Math.min(1, Math.abs(aboveSea) / 6000);
          r = 0.08 * (1 - depthFrac) + 0.03 * depthFrac;
          g = 0.14 * (1 - depthFrac) + 0.05 * depthFrac;
          b = 0.22 * (1 - depthFrac) + 0.09 * depthFrac;
        } else {
          const hNorm = Math.min(1, aboveSea / 5500);
          const aridity = Math.max(0, 1.0 - hum * 1.35);
          const rockR = 0.42 - hNorm * 0.14 + aridity * 0.22 + Math.min(0.12, sed * 0.002);
          const rockG = 0.37 - hNorm * 0.12 + aridity * 0.08 + Math.min(0.09, sed * 0.0015);
          const rockB = 0.33 - hNorm * 0.1 - aridity * 0.06;
          r = rockR;
          g = rockG;
          b = rockB;

          if (bio > 0.02) {
            const vegWeight = Math.min(1, bio * 1.15);
            const tempC = tempK - 273.15;
            const tropic = Math.max(0, Math.min(1, (tempC - 10) / 20)) * Math.min(1, precip / 3.0);
            const vegR = 0.18 - tropic * 0.11 + (1 - hum) * 0.14;
            const vegG = 0.46 + tropic * 0.12 - (1 - hum) * 0.08;
            const vegB = 0.14 + (1 - tropic) * 0.05;
            r = r * (1 - vegWeight) + vegR * vegWeight;
            g = g * (1 - vegWeight) + vegG * vegWeight;
            b = b * (1 - vegWeight) + vegB * vegWeight;
          }
        }

        if (ice > 1.0) {
          const iceBlend = Math.min(1, ice / 65.0);
          r = r * (1 - iceBlend) + 0.88 * iceBlend;
          g = g * (1 - iceBlend) + 0.94 * iceBlend;
          b = b * (1 - iceBlend) + 0.99 * iceBlend;
        }

        if (volc > 8.0) {
          const lavaBlend = Math.min(1, volc / 180.0);
          r = r * (1 - lavaBlend) + 1.0 * lavaBlend;
          g = g * (1 - lavaBlend) + 0.32 * lavaBlend;
          b = b * (1 - lavaBlend) + 0.04 * lavaBlend;
        }
      } else if (this.overlayMode === 'BIOSPHERE') {
        r = 0.08 + hab * 0.1 + fau * 0.82;
        g = 0.1 + hab * 0.25 + bio * 0.65 + fau * 0.18;
        b = 0.16 + hab * 0.35 - bio * 0.15;
      } else if (this.overlayMode === 'HABITABILITY') {
        r = 0.06 + (1 - hab) * 0.32;
        g = 0.12 + hab * 0.78;
        b = 0.22 + hab * 0.55;
      } else if (this.overlayMode === 'BIOMASS') {
        r = 0.12 * (1 - bio) + 0.1 * bio;
        g = 0.14 + bio * 0.82;
        b = 0.15 * (1 - bio) + 0.28 * bio;
      } else if (this.overlayMode === 'FAUNA') {
        r = 0.1 + fau * 0.9;
        g = 0.12 + fau * 0.65;
        b = 0.2 + (1 - fau) * 0.15;
      } else if (this.overlayMode === 'BIODIVERSITY') {
        r = 0.12 + biodiv * 0.75;
        g = 0.14 + Math.sin(biodiv * Math.PI) * 0.72;
        b = 0.28 + biodiv * 0.68;
      } else if (this.overlayMode === 'EXTINCTION_IMPACT') {
        r = 0.14 + extImp * 0.86;
        g = 0.14 * (1 - extImp) + 0.08 * extImp;
        b = 0.2 * (1 - extImp) + 0.35 * extImp;
      } else if (this.overlayMode === 'TEMPERATURE') {
        const tNorm = Math.max(0, Math.min(1, (tempK - 220) / 110));
        r = Math.min(1, Math.max(0, (tNorm - 0.35) * 2.1));
        g = Math.sin(tNorm * Math.PI) * 0.85;
        b = Math.min(1, Math.max(0, (0.68 - tNorm) * 1.9));
      } else if (this.overlayMode === 'ELEVATION') {
        const eNorm = Math.max(0, Math.min(1, (elev + 7000) / 14000));
        r = eNorm;
        g = 0.2 + 0.65 * Math.sin(eNorm * Math.PI);
        b = 1.0 - eNorm;
      } else if (this.overlayMode === 'PRECIPITATION') {
        const pNorm = Math.max(0, Math.min(1, precip / 12.0));
        r = 0.15 * (1 - pNorm);
        g = 0.25 + 0.65 * pNorm;
        b = 0.3 + 0.7 * pNorm;
      } else if (this.overlayMode === 'ICE') {
        const iNorm = Math.max(0, Math.min(1, ice / 800));
        r = 0.12 + 0.82 * iNorm;
        g = 0.16 + 0.8 * iNorm;
        b = 0.24 + 0.76 * iNorm;
      } else if (this.overlayMode === 'WIND') {
        const u = world.sampleFieldBilinear(world.windU, lat, lon);
        const v = world.sampleFieldBilinear(world.windV, lat, lon);
        const wNorm = Math.max(0, Math.min(1, Math.hypot(u, v) / 32.0));
        r = 0.15 + 0.85 * wNorm;
        g = 0.2 + 0.55 * (1 - Math.abs(wNorm - 0.5) * 2);
        b = 0.85 - 0.6 * wNorm;
      } else if (this.overlayMode === 'RADIATION') {
        const rad = world.sampleFieldBilinear(world.radiationField, lat, lon);
        r = 0.12 + 0.88 * rad;
        g = 0.14 + 0.5 * (1 - rad);
        b = 0.35 + 0.6 * rad;
      } else if (this.overlayMode === 'MINERALS') {
        const minVal = world.sampleFieldBilinear(world.mineralField, lat, lon);
        r = 0.16 + 0.78 * minVal;
        g = 0.18 + 0.64 * Math.pow(minVal, 0.8);
        b = 0.22 + 0.25 * (1 - minVal);
      } else if (this.overlayMode === 'CIVILIZATION') {
        r = 0.08 + hab * 0.18;
        g = 0.12 + hab * 0.28;
        b = 0.22 + hab * 0.32;
        if (world.civilization.civilizations.length > 0) {
          const cellIdx = world.latLonToCellIndex((lat * 180) / Math.PI, (lon * 180) / Math.PI);
          for (const civ of world.civilization.civilizations) {
            if (civ.active && civ.territoryCells.includes(cellIdx)) {
              r = 0.96;
              g = 0.78;
              b = 0.18;
              break;
            }
          }
        }
      }

      if (this.colorVisionMode === 'DEUTERANOPIA_SAFE' || this.colorVisionMode === 'PROTANOPIA_SAFE') {
        const rg = 0.5 * (r + g);
        r = rg * 1.05;
        g = rg * 0.92;
        b = Math.min(1, b * 1.15 + 0.05);
      } else if (this.colorVisionMode === 'TRITANOPIA_SAFE') {
        const gb = 0.5 * (g + b);
        g = gb;
        b = gb;
      }

      colArr[i * 3] = r;
      colArr[i * 3 + 1] = g;
      colArr[i * 3 + 2] = b;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    this.terrainGeo.computeVertexNormals();

    // 3. Update Ocean Sphere
    const oceanPosAttr = this.oceanGeo.attributes.position as THREE.BufferAttribute;
    const oceanColAttr = this.oceanGeo.attributes.color as THREE.BufferAttribute;
    const oPosArr = oceanPosAttr.array as Float32Array;
    const oColArr = oceanColAttr.array as Float32Array;
    const oCount = oceanPosAttr.count;

    this.oceanMesh.visible = this.overlayMode === 'TRUE_COLOR';

    if (this.oceanMesh.visible) {
      for (let i = 0; i < oCount; i++) {
        const lat = this.oceanVertexLatRad[i];
        const lon = this.oceanVertexLonRad[i];
        const wave = world.sampleFieldBilinear(world.waterWaveAnomaly, lat, lon);
        const crustElev = world.sampleFieldBilinear(world.elevation, lat, lon);
        const seaIce = world.sampleFieldBilinear(world.iceThickness, lat, lon);
        const marineBio = world.sampleFieldBilinear(world.biomass, lat, lon);

        const waterRadiusScale =
          1.0 + ((seaLevel + wave * 35.0) * this.radialExaggeration) / this.planetRadius;

        oPosArr[i * 3] = this.oceanBasePositions[i * 3] * waterRadiusScale;
        oPosArr[i * 3 + 1] = this.oceanBasePositions[i * 3 + 1] * waterRadiusScale;
        oPosArr[i * 3 + 2] = this.oceanBasePositions[i * 3 + 2] * waterRadiusScale;

        const waterDepth = Math.max(0, seaLevel - crustElev);
        const shallow = Math.exp(-waterDepth / 950.0);

        let or = 0.03 + shallow * 0.08;
        let og = 0.16 + shallow * 0.24 + marineBio * 0.18 * (0.4 + 0.6 * shallow);
        let ob = 0.36 + shallow * 0.25 + marineBio * 0.06;

        if (wave > 0.8) {
          const crest = Math.min(1, wave / 14.0);
          or = or * (1 - crest) + 0.78 * crest;
          og = og * (1 - crest) + 0.94 * crest;
          ob = ob * (1 - crest) + 1.0 * crest;
        }

        if (seaIce > 1.5) {
          const icePack = Math.min(1, seaIce / 25.0);
          or = or * (1 - icePack) + 0.85 * icePack;
          og = og * (1 - icePack) + 0.92 * icePack;
          ob = ob * (1 - icePack) + 0.98 * icePack;
        }

        oColArr[i * 3] = or;
        oColArr[i * 3 + 1] = og;
        oColArr[i * 3 + 2] = ob;
      }
      oceanPosAttr.needsUpdate = true;
      oceanColAttr.needsUpdate = true;
      this.oceanGeo.computeVertexNormals();
    }

    // 4. Update Cloud Layer
    if (this.visualQuality !== 'Low') {
      const gw = world.gridWidth;
      const gh = world.gridHeight;
      for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
          const idx = y * gw + x;
          const hum = world.humidity[idx];
          const precip = world.precipitation[idx];
          const volc = world.volcanicHeat[idx];

          const cloudDensity = Math.max(0, Math.min(1, (hum - 0.38) * 1.45 + precip * 0.04));
          const p4 = idx * 4;
          if (volc > 25) {
            this.cloudData[p4] = 95;
            this.cloudData[p4 + 1] = 75;
            this.cloudData[p4 + 2] = 68;
            this.cloudData[p4 + 3] = Math.min(240, Math.floor(cloudDensity * 180 + volc * 1.2));
          } else {
            this.cloudData[p4] = 244;
            this.cloudData[p4 + 1] = 248;
            this.cloudData[p4 + 2] = 255;
            this.cloudData[p4 + 3] = Math.floor(cloudDensity * 205);
          }
        }
      }
      this.cloudTexture.needsUpdate = true;
    }

    this.syncHazardMarkers(world);
    this.syncFaunaPoints(world, seaLevel);
    this.syncExpeditionAndSettlementMarkers(world);
    if (this.magnetosphereGroup.visible) {
      const magScale = Math.max(0.4, Math.min(2.2, Math.cbrt(Math.max(0.05, world.magnetosphere.dipoleMomentEarths))));
      this.magnetosphereGroup.scale.setScalar(magScale);
    }
  }

  private syncExpeditionAndSettlementMarkers(world: WorldSimulation): void {
    while (this.expeditionGroup.children.length > 0) {
      const child = this.expeditionGroup.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.expeditionGroup.remove(child);
    }

    if (world.exploration.expeditionActive) {
      const lat = (world.exploration.roverLatDeg * Math.PI) / 180;
      const lon = (world.exploration.roverLonDeg * Math.PI) / 180;
      const r = this.planetRadius * 1.038;
      const pos = new THREE.Vector3(
        Math.cos(lat) * Math.cos(lon) * r,
        Math.sin(lat) * r,
        Math.cos(lat) * Math.sin(lon) * r
      );
      const geo = new THREE.RingGeometry(0.14, 0.24, 24);
      const mat = new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide, depthTest: false });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.lookAt(pos.clone().multiplyScalar(2));
      this.expeditionGroup.add(mesh);
    }

    for (const civ of world.civilization.civilizations) {
      if (!civ.active) continue;
      for (const s of civ.settlements) {
        const lat = (s.latDeg * Math.PI) / 180;
        const lon = (s.lonDeg * Math.PI) / 180;
        const r = this.planetRadius * 1.036;
        const pos = new THREE.Vector3(
          Math.cos(lat) * Math.cos(lon) * r,
          Math.sin(lat) * r,
          Math.cos(lat) * Math.sin(lon) * r
        );
        const geo = new THREE.RingGeometry(0.08, 0.16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide, depthTest: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.lookAt(pos.clone().multiplyScalar(2));
        this.expeditionGroup.add(mesh);
      }
    }
  }

  private syncFaunaPoints(world: WorldSimulation, seaLevel: number): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const stride = this.visualQuality === 'Low' ? 4 : 2;

    for (let i = 0; i < world.numCells; i += stride) {
      const f = world.fauna[i];
      if (f > 0.16) {
        const elev = Math.max(seaLevel, world.elevation[i] + world.iceThickness[i] * 0.65);
        const r = this.planetRadius * (1.004 + (elev * this.radialExaggeration) / this.planetRadius);
        positions.push(world.cellNx[i] * r, world.cellNy[i] * r, world.cellNz[i] * r);

        const isOcean = world.elevation[i] < seaLevel;
        if (isOcean) {
          colors.push(0.2, 0.95, 0.85);
        } else {
          colors.push(0.98, 0.82, 0.25);
        }
      }
    }

    this.faunaGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.faunaGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.faunaPoints.visible =
      positions.length > 0 &&
      (this.overlayMode === 'TRUE_COLOR' ||
        this.overlayMode === 'BIOSPHERE' ||
        this.overlayMode === 'FAUNA' ||
        this.overlayMode === 'BIODIVERSITY');
  }

  private syncHazardMarkers(world: WorldSimulation): void {
    while (this.hazardGroup.children.length > 0) {
      const child = this.hazardGroup.children[0] as THREE.Mesh;
      child.geometry?.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      this.hazardGroup.remove(child);
    }

    for (const haz of world.activeHazards) {
      const r = this.planetRadius * 1.035;
      const pos = new THREE.Vector3(haz.nx * r, haz.ny * r, haz.nz * r);

      const color =
        haz.type === 'VOLCANO' ? 0xff4500 :
        haz.type === 'METEOR' ? 0xff1155 :
        haz.type === 'EARTHQUAKE' ? 0xfacc15 :
        haz.type === 'TSUNAMI' ? 0x38bdf8 :
        haz.type === 'FLOOD' ? 0x0ea5e9 :
        haz.type === 'STORM' ? 0xc084fc : 0xf97316;

      const ringRadius = haz.type === 'TSUNAMI'
        ? Math.sin(Math.min(Math.PI * 0.8, haz.waveRadiusRad || 0.1)) * this.planetRadius
        : 0.35 + haz.intensity * 0.25;

      const geo = new THREE.RingGeometry(Math.max(0.08, ringRadius * 0.82), ringRadius, 36);
      const mat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthTest: false
      });
      const marker = new THREE.Mesh(geo, mat);
      marker.position.copy(pos);
      marker.lookAt(pos.clone().multiplyScalar(2));
      this.hazardGroup.add(marker);
    }
  }

  public raycastCoordinate(clientX: number, clientY: number): RaycastHitCoordinate | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.oceanMesh.visible ? [this.terrainMesh, this.oceanMesh] : [this.terrainMesh];
    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length === 0) return null;

    const pt = hits[0].point;
    const norm = pt.clone().normalize();
    const latRad = Math.asin(Math.max(-1, Math.min(1, norm.y)));
    const lonRad = Math.atan2(norm.z, norm.x);

    return {
      latDeg: (latRad * 180) / Math.PI,
      lonDeg: (lonRad * 180) / Math.PI,
      point: pt
    };
  }

  public setSelectionMarker(latDeg: number, lonDeg: number): void {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const r = this.planetRadius * 1.032;
    const nx = Math.cos(lat) * Math.cos(lon);
    const ny = Math.sin(lat);
    const nz = Math.cos(lat) * Math.sin(lon);

    this.selectionRing.position.set(nx * r, ny * r, nz * r);
    this.selectionRing.lookAt(nx * r * 2, ny * r * 2, nz * r * 2);
    this.selectionRing.visible = true;
  }

  public setHoverPreview(
    latDeg: number,
    lonDeg: number,
    radiusDeg: number,
    visible: boolean,
    colorHex = 0xf59e0b
  ): void {
    if (!visible) {
      this.hoverPreviewRing.visible = false;
      return;
    }
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const r = this.planetRadius * 1.034;
    const nx = Math.cos(lat) * Math.cos(lon);
    const ny = Math.sin(lat);
    const nz = Math.cos(lat) * Math.sin(lon);

    const scale = Math.max(0.25, Math.sin((radiusDeg * Math.PI) / 180) * this.planetRadius);
    this.hoverPreviewRing.scale.set(scale, scale, 1);
    (this.hoverPreviewRing.material as THREE.MeshBasicMaterial).color.setHex(colorHex);
    this.hoverPreviewRing.position.set(nx * r, ny * r, nz * r);
    this.hoverPreviewRing.lookAt(nx * r * 2, ny * r * 2, nz * r * 2);
    this.hoverPreviewRing.visible = true;
  }

  public focusOnLatLon(latDeg: number, lonDeg: number): void {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const dist = Math.max(18, Math.min(34, this.camera.position.length()));
    const nx = Math.cos(lat) * Math.cos(lon);
    const ny = Math.sin(lat);
    const nz = Math.cos(lat) * Math.sin(lon);
    this.cameraTargetPos = new THREE.Vector3(nx * dist, ny * dist, nz * dist);
  }

  public resize(width: number, height: number): void {
    if (width <= 0 || height <= 0 || !Number.isFinite(width) || !Number.isFinite(height)) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public renderFrame(): void {
    if (this.cloudMesh.visible) {
      this.cloudMesh.rotation.y += 0.00035;
    }
    if (this.cameraTargetPos) {
      this.camera.position.lerp(this.cameraTargetPos, 0.08);
      if (this.camera.position.distanceTo(this.cameraTargetPos) < 0.15) {
        this.cameraTargetPos = null;
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.renderer.dispose();
    this.controls.dispose();

    this.terrainGeo.dispose();
    (this.terrainMesh.material as THREE.Material).dispose();

    this.oceanGeo.dispose();
    (this.oceanMesh.material as THREE.Material).dispose();

    this.cloudTexture.dispose();
    (this.cloudMesh.geometry as THREE.BufferGeometry).dispose();
    (this.cloudMesh.material as THREE.Material).dispose();

    (this.atmosphereMesh.geometry as THREE.BufferGeometry).dispose();
    (this.atmosphereMesh.material as THREE.Material).dispose();

    (this.selectionRing.geometry as THREE.BufferGeometry).dispose();
    (this.selectionRing.material as THREE.Material).dispose();

    (this.hoverPreviewRing.geometry as THREE.BufferGeometry).dispose();
    (this.hoverPreviewRing.material as THREE.Material).dispose();

    this.faunaGeo.dispose();
    (this.faunaPoints.material as THREE.Material).dispose();

    const disposeGroup = (group: THREE.Group) => {
      while (group.children.length > 0) {
        const c = group.children[0] as THREE.Mesh | THREE.Line;
        c.geometry?.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose());
          else c.material.dispose();
        }
        group.remove(c);
      }
    };

    disposeGroup(this.hazardGroup);
    disposeGroup(this.expeditionGroup);
    disposeGroup(this.graticuleGroup);
    disposeGroup(this.magnetosphereGroup);

    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
