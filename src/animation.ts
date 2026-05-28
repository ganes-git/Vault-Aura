import * as THREE from 'three';
import { gsap } from 'gsap';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let mesh: THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshStandardMaterial>;
let originalPositions: THREE.BufferAttribute;

// Post-processing components
let composer: EffectComposer | null = null;

// Animation loop state
let animationFrameId: number | null = null;
let isTabActive = true;

// Morphing parameters
const morphState = { factor: 0 };
let currentSeed = 0;

/**
 * Initializes the 3D WebGL background layer
 */
export function initWebGL(canvasElement: HTMLCanvasElement): void {
  try {
    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = null; // transparent to let index.css full background shine

    // 2. Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.z = 4.5;

    // 3. Renderer setup
    renderer = new THREE.WebGLRenderer({
      canvas: canvasElement,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // 4. Geometry and Material setup
    const geometry = new THREE.IcosahedronGeometry(1.5, 3); // 3 subdivisions for ~320 faces
    originalPositions = geometry.attributes.position.clone() as THREE.BufferAttribute;

    const material = new THREE.MeshStandardMaterial({
      color: 0x1a1a1f,    // near-black charcoal
      metalness: 0.85,
      roughness: 0.3,
      wireframe: false,
      flatShading: true   // critical for B&O facets tactile luxury look
    });

    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 5. Lighting architecture
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    // Primary champagne gold directional spotlight
    const dirLight = new THREE.DirectionalLight(0xd4af37, 1.2);
    dirLight.position.set(3, 5, 2);
    scene.add(dirLight);

    // Secondary soft fill pointlight
    const pointLight = new THREE.PointLight(0xffffff, 0.6);
    pointLight.position.set(-4, -2, -3);
    scene.add(pointLight);

    // 6. Optional WebGL2 post-processing UnrealBloom
    setupPostProcessing();

    // 7. Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 8. Start loop
    renderLoop();
  } catch (error) {
    console.warn("WebGL initialization failed. Gracefully degrading to silent canvas hiding.", error);
    // Silent degradation
    canvasElement.style.display = 'none';
  }
}

/**
 * Configure UnrealBloomPass post-processing if supported and packages resolve
 */
function setupPostProcessing(): void {
  try {
    const isWebGL2 = renderer.capabilities.isWebGL2;
    if (!isWebGL2) {
      console.log("WebGL2 not supported, skipping post-processing bloom.");
      return;
    }

    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Subtle golden bloom filter setup
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.18,  // Strength
      0.4,   // Radius
      0.85   // Threshold
    );

    composer.addPass(bloomPass);
  } catch (err) {
    console.warn("Post-processing setup failed, using standard forward renderer.", err);
    composer = null;
  }
}

/**
 * Passive idle rotation loop and active vertex rendering
 */
function renderLoop(): void {
  if (!isTabActive) return;

  animationFrameId = requestAnimationFrame(renderLoop);

  // 1. Continuous rotation (calm and slow)
  if (mesh) {
    mesh.rotation.x += 0.0015;
    mesh.rotation.y += 0.0025;
  }

  // 2. Render frame
  if (composer) {
    composer.render();
  } else if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Handle screen rescales without stretch
 */
function onWindowResize(): void {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}

/**
 * Pause frame computations when tab moves to background
 */
function onVisibilityChange(): void {
  isTabActive = !document.hidden;
  if (isTabActive) {
    renderLoop();
  } else if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

/**
 * Displace mesh vertices mathematically using a sine wave scaled by active morph values
 */
function applyDisplacement(seed: number, factor: number): void {
  if (!mesh) return;

  const geometry = mesh.geometry;
  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const orig = originalPositions.array as Float32Array;
  const arr = pos.array as Float32Array;

  for (let i = 0; i < pos.count; i++) {
    const x = orig[i * 3];
    const y = orig[i * 3 + 1];
    const z = orig[i * 3 + 2];

    const dist = Math.sqrt(x * x + y * y + z * z);
    if (dist === 0) continue;

    // Fast trigonometric displacement pattern simulating crystals warping
    const wave = Math.sin(x * 3.5 + seed) * Math.cos(y * 3.5 + seed) * Math.sin(z * 3.5 + seed);
    const displace = wave * factor * 0.45;

    arr[i * 3]     = x + (x / dist) * displace;
    arr[i * 3 + 1] = y + (y / dist) * displace;
    arr[i * 3 + 2] = z + (z / dist) * displace;
  }

  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Reactive Vertex Morphing triggered by slider drag
 */
export function handleSliderWarp(sliderValue: number): void {
  if (!mesh) return;

  // Amplitude is proportional to slider input value
  const amplitude = Math.min(sliderValue / 180, 0.4);
  currentSeed = sliderValue;

  gsap.killTweensOf(morphState);
  morphState.factor = amplitude;

  // GSAP interpolation back to flat baseline over 0.8 seconds
  gsap.to(morphState, {
    factor: 0,
    duration: 0.8,
    ease: "power2.out",
    onUpdate: () => {
      applyDisplacement(currentSeed, morphState.factor);
    }
  });
}

/**
 * Generation Trigger cinematic camera sequence (1.2 seconds total duration)
 */
export function triggerGenerateAnimation(onUnscrambleStart: () => void): void {
  if (!camera || !mesh) {
    // Quick fallback if WebGL is disabled
    onUnscrambleStart();
    return;
  }

  gsap.killTweensOf(camera.position);
  gsap.killTweensOf(morphState);

  const timeline = gsap.timeline();

  // Phase 1 (0-0.3s): Camera rushes forward, z drops from 4.5 to 2.8
  timeline.to(camera.position, {
    z: 2.8,
    duration: 0.3,
    ease: "power3.in"
  });

  // Phase 2 (0.3-0.7s): Radially explode mesh vertices (displacement spike 2.5x base)
  timeline.to(morphState, {
    factor: 0.75, // Explosion amplitude
    duration: 0.4,
    ease: "expo.out",
    onUpdate: () => {
      applyDisplacement(42, morphState.factor);
    }
  }, 0.3);

  // Phase 3 (0.7-1.2s): Camera retreats back to z: 4.5, mesh resolves back, unscramble starts
  timeline.to(camera.position, {
    z: 4.5,
    duration: 0.5,
    ease: "power2.out",
    onStart: () => {
      // Execute the synchronized alphanumeric unscramble reveal
      onUnscrambleStart();
    }
  }, 0.7);

  // Smoothly decay mesh displacement back to 0 concurrently with retreat
  timeline.to(morphState, {
    factor: 0,
    duration: 0.5,
    ease: "power2.out",
    onUpdate: () => {
      applyDisplacement(42, morphState.factor);
    }
  }, 0.7);
}
