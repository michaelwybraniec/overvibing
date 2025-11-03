import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'dat.gui'
import vertexShader from './shaders/galaxy/vertex.glsl'
import fragmentShader from './shaders/galaxy/fragment.glsl'
import presetsConfig from './configs/presets.json'
import hoverEffectsConfig from './configs/hover-effects.json'

/**
 * Base
 */
// Debug
const DEV_MODE = document.body.getAttribute('data-dev-mode') === 'true';
// Silence console noise in production
if (!DEV_MODE) {
    const noop = () => {};
    console.log = noop;
    console.debug = noop;
    console.warn = noop;
}
let gui = new dat.GUI();
// Hide GUI if not in dev mode
if (!DEV_MODE) {
    gui.domElement.style.display = 'none';
}

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Scene
const scene = new THREE.Scene()

// Galaxy
let geometry = null
let material = null
let points = null

const generateGalaxy = () =>
{
    // Remove loading state for instant display
    
    if(points !== null)
    {
        geometry.dispose()
        material.dispose()
        scene.remove(points)
    }

    /**
     * Geometry
     */
    geometry = new THREE.BufferGeometry()

    const positions = new Float32Array(parameters.count * 3)
    const colors = new Float32Array(parameters.count * 3)
    const scales = new Float32Array(parameters.count)
    const randomness = new Float32Array(parameters.count * 3)

    const colorInside = new THREE.Color(parameters.insideColor)
    const colorOutside = new THREE.Color(parameters.outsideColor)

    // Simple seeded RNG to stabilize visuals across runs
    let seed = typeof parameters.seed === 'number' ? parameters.seed >>> 0 : 1337;
    const rand = () => {
        // xorshift32
        seed ^= seed << 13; seed >>>= 0;
        seed ^= seed >> 17; seed >>>= 0;
        seed ^= seed << 5;  seed >>>= 0;
        return (seed >>> 0) / 0xFFFFFFFF;
    };

    for(let i = 0; i < parameters.count; i++)
    {
        const i3 = i * 3

        // Position
        const radius = rand() * parameters.radius

        const spinAngle = radius * parameters.spin
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2

        const randomX = Math.pow(rand(), parameters.randomnessPower) * (rand() < 0.5 ? 1 : - 1) * parameters.randomness * radius
        const randomY = Math.pow(rand(), parameters.randomnessPower) * (rand() < 0.5 ? 1 : - 1) * parameters.randomness * radius
        const randomZ = Math.pow(rand(), parameters.randomnessPower) * (rand() < 0.5 ? 1 : - 1) * parameters.randomness * radius

        positions[i3    ] = Math.cos(branchAngle + spinAngle) * radius
        positions[i3 + 1] = 0
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius

        // Color
        const mixedColor = colorInside.clone()
        mixedColor.lerp(colorOutside, radius / parameters.radius)

        colors[i3    ] = mixedColor.r
        colors[i3 + 1] = mixedColor.g
        colors[i3 + 2] = mixedColor.b

        // Scale
        scales[i] = rand()

        // Randomness
        randomness[i3    ] = randomX
        randomness[i3 + 1] = randomY
        randomness[i3 + 2] = randomZ
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3))

    /**
     * Material
     */
    material = new THREE.ShaderMaterial({
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms:
        {
            uTime: { value: 0 },
            uSize: { value: 30 * renderer.getPixelRatio() },
            uHoverIntensity: { value: 0 },
            uHoverSizeMultiplier: { value: 1.0 },
            uHoverSpinMultiplier: { value: 1.0 },
            uHoverBrightnessMultiplier: { value: 1.0 },
            uSpinDirection: { value: 1.0 },
            uNormalRotationSpeed: { value: 0.05 },
            uRotationOffset: { value: 0.0 }
        }
    })

    /**
     * Points
     */
    points = new THREE.Points(geometry, material)
    scene.add(points)
    
    // Remove loading state for instant display
}

/**
 * Beat Info Display
 */
const updateBeatInfo = () => {
    const beatInfo = document.getElementById('beat-info');
    if (beatInfo && audioContext && audioContext.state === 'running') {
        const currentTime = audioContext.currentTime;
        const bpm = 120; // Default BPM
        const beatInterval = 60 / bpm;
        const currentBeat = Math.floor(currentTime / beatInterval) + 1;
        
        beatInfo.textContent = `Beat: ${currentBeat}`;
    }
};

// Audio context and analysis
let audioContext = null;
let analyser = null;
let audioBuffer = null;
let source = null;
let isPlaying = false;
let audioArrayBuffer = null; // cache raw bytes for faster first play
let audioLoadPromise = null; // prevent duplicate loads

const initAudio = () => {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
    }
};

const fetchAudioArrayBuffer = async () => {
    const filename = 'Michau Wybraniec - Kepler 22b.mp3';
    const candidates = [
        `/${filename}`,                 // root
        `/static/${filename}`,          // /static
        `${filename}`                   // relative
    ].map((u) => encodeURI(u));

    let lastError = null;
    for (const url of candidates) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                lastError = new Error(`HTTP ${response.status} for ${url}`);
                continue;
            }
            const ab = await response.arrayBuffer();
            if (!ab || ab.byteLength === 0) {
                lastError = new Error(`Empty response for ${url}`);
                continue;
            }
            console.log(`Fetched audio bytes from ${url}`);
            return ab;
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error('Unable to fetch audio');
};

const loadAudio = async () => {
    if (audioBuffer) return;
    if (audioLoadPromise) return audioLoadPromise;
    audioLoadPromise = (async () => {
        try {
            if (!audioArrayBuffer) {
                audioArrayBuffer = await fetchAudioArrayBuffer();
            }
            const decoded = await audioContext.decodeAudioData(audioArrayBuffer.slice(0));
            audioBuffer = decoded;
            console.log('Audio decoded successfully');
        } catch (err) {
            console.error('Error loading audio:', err);
            throw err;
        } finally {
            audioLoadPromise = null;
        }
    })();
    return audioLoadPromise;
};

// Prefetch audio bytes on page load for instant first play
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        // Start fetching bytes early; try pre-decoding via OfflineAudioContext for instant first play
        (async () => {
            try {
                const ab = await fetchAudioArrayBuffer();
                audioArrayBuffer = ab;
                // Try pre-decode without creating real AudioContext
                const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
                if (OfflineCtx) {
                    const offline = new OfflineCtx(2, 44100, 44100);
                    const decoded = await offline.decodeAudioData(ab.slice(0));
                    if (decoded) {
                        audioBuffer = decoded;
                        console.log('Audio pre-decoded successfully');
                    }
                }
            } catch (e) {
                // Silent failure: we will decode on first click
            }
        })();
    });
}

const playAudio = () => {
    if (audioBuffer && audioContext.state === 'suspended') {
        audioContext.resume();
    }
    
    if (audioBuffer && !isPlaying) {
        source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(analyser);
        analyser.connect(audioContext.destination);
        
        source.start();
        isPlaying = true;
        console.log('Audio started');

        // Reset UI when playback ends
        source.onended = () => {
            isPlaying = false;
            try {
                source.disconnect();
            } catch (e) {}
            const ctrl = document.getElementById('audio-control');
            if (ctrl) ctrl.classList.remove('playing');
        };
    }
};

const stopAudio = () => {
    if (source && isPlaying) {
        source.stop();
        source.disconnect();
        isPlaying = false;
        console.log('Audio stopped');
    }
};

// Audio control button
const audioControl = document.getElementById('audio-control');
if (audioControl) {
    // Add play icon initially
    audioControl.innerHTML = `
        <div class="play-icon"></div>
        <div class="pause-icon"></div>
    `;
    
    audioControl.addEventListener('click', async () => {
        if (!audioContext) {
            initAudio();
        }

        // Ensure audio is loaded before attempting playback
        if (!audioBuffer) {
            try {
                await loadAudio();
            } catch (e) {
                console.error('Failed to load audio:', e);
                return;
            }
        }
        
        if (isPlaying) {
            stopAudio();
            audioControl.classList.remove('playing');
        } else {
            playAudio();
            audioControl.classList.add('playing');
        }
    });
}

// Sizes
const sizes = {
    width: window.innerWidth,
    height: window.innerHeight
}

// Camera
const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 1000)
camera.position.x = 3
camera.position.z = 3
camera.position.y = 3

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enabled = true // Enable OrbitControls for mouse interaction

// Track and temporarily disable autoRotate during hover/decay
let autoRotateTemporarilyDisabled = false
let previousAutoRotate = controls.autoRotate
let previousAutoRotateSpeed = controls.autoRotateSpeed || 0

// Renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})
renderer.setSize(sizes.width, sizes.height)
// Cap pixel ratio on mobile to save battery/heat
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))

// Galaxy parameters
const parameters = {}
parameters.count = 100000
parameters.size = 0.01
parameters.radius = 5
parameters.branches = 3
parameters.spin = 1
parameters.randomness = 0.2
parameters.randomnessPower = 3
parameters.insideColor = '#ff6030'
parameters.outsideColor = '#1b3984'

// Hover effect parameters - loaded from config
const hoverParameters = {
    isHovered: false,
    hoverIntensity: 0,
    targetHoverIntensity: 0,
    transitionSpeed: hoverEffectsConfig.transitionSpeed,
    // Hover effect multipliers (default values for normal buttons)
    sizeMultiplier: hoverEffectsConfig.hoverEffects[0].normalButtons.sizeMultiplier,
    spinMultiplier: hoverEffectsConfig.hoverEffects[0].normalButtons.spinMultiplier,
    brightnessMultiplier: hoverEffectsConfig.hoverEffects[0].normalButtons.brightnessMultiplier,
    // Smooth brightness easing
    currentBrightnessMultiplier: 1.0,
    targetBrightnessMultiplier: 1.0,
    brightnessTransitionSpeed: 0.08, // Slower transition for smoother color easing
    colorShift: 0.3
}

// Load presets
const presets = presetsConfig.presets;
let currentPresetIndex = 0;

// Function to get current hover effect
const getCurrentHoverEffect = () => {
    return hoverEffectsConfig.hoverEffects[hoverEffectsConfig.currentEffectIndex];
};

// Function to change hover effect
const setHoverEffect = (index) => {
    if (index >= 0 && index < hoverEffectsConfig.hoverEffects.length) {
        hoverEffectsConfig.currentEffectIndex = index;
        const effect = getCurrentHoverEffect();
        console.log(`Hover effect set to: ${effect.name} - ${effect.description}`);
        
        // Update UI
        updateHoverEffectDisplay();
    } else {
        console.warn(`Hover effect index ${index} not found. Available effects: 0-${hoverEffectsConfig.hoverEffects.length - 1}`);
    }
};

// Function to update hover effect display
const updateHoverEffectDisplay = () => {
    const effectNameElement = document.getElementById('currentHoverEffect');
    if (effectNameElement) {
        const effect = getCurrentHoverEffect();
        const currentIndex = hoverEffectsConfig.currentEffectIndex;
        effectNameElement.textContent = `${effect.name} (${currentIndex})`;
    }
};

// Camera movement system for different hover effects
const applyCameraMovement = (movementType, zoomFactor, angleFactor, heightMultiplier, cameraOffset) => {
    // Use CURRENT camera position as base, not original preset position
    // Add safety check in case camera is not yet initialized
    let baseX, baseY, baseZ;
    if (!camera) {
        console.warn('Camera not initialized yet, using fallback position');
        baseX = 3; baseY = 3; baseZ = 3;
    } else {
        baseX = camera.position.x;
        baseY = camera.position.y;
        baseZ = camera.position.z;
    }
    
    switch (movementType) {
        case 'gentle_orbit':
            targetCameraPosition.x = baseX * zoomFactor * angleFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor * angleFactor + cameraOffset.z;
            break;
            
        case 'extreme_close':
            targetCameraPosition.x = baseX * zoomFactor * 0.3;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier;
            targetCameraPosition.z = baseZ * zoomFactor * 0.3;
            break;
            
        case 'flowing_orbit':
            targetCameraPosition.x = baseX * zoomFactor * angleFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor * angleFactor + cameraOffset.z;
            break;
            
        case 'quantum_teleport':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'cosmic_perspective':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'neon_flash':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'ethereal_whirl':
            targetCameraPosition.x = baseX * zoomFactor * angleFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor * angleFactor + cameraOffset.z;
            break;
            
        case 'deep_space':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'radiant_explosion':
            targetCameraPosition.x = baseX * zoomFactor * angleFactor;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier;
            targetCameraPosition.z = baseZ * zoomFactor * angleFactor;
            break;
            
        case 'delicate_glow':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'dramatic_shift':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'extreme_zoom_out':
            targetCameraPosition.x = baseX * zoomFactor;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier;
            targetCameraPosition.z = baseZ * zoomFactor;
            break;
            
        case 'deep_spiral':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'circular_orbit':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'event_horizon':
            targetCameraPosition.x = baseX * zoomFactor;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier;
            targetCameraPosition.z = baseZ * zoomFactor;
            break;
            
        case 'dramatic_tilt':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'temporal_distortion':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
        case 'edge_perspective':
            targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
            targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
            targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
            break;
            
                   case 'universe_view':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   // NEW EPIC EFFECTS - THE SPICIEST GALAXY MOVES!
                   case 'tornado_spiral':
                       targetCameraPosition.x = baseX * zoomFactor * 0.5 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.5 + cameraOffset.z;
                       break;

                   case 'extreme_tornado':
                       targetCameraPosition.x = baseX * zoomFactor * 0.2 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.2 + cameraOffset.z;
                       break;

                   case 'explosion_outward':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'supernova_burst':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'dimensional_warp':
                       targetCameraPosition.x = baseX * zoomFactor * 0.3 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.3 + cameraOffset.z;
                       break;

                   case 'extreme_rift':
                       targetCameraPosition.x = baseX * zoomFactor * 0.1 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.1 + cameraOffset.z;
                       break;

                   case 'dance_moves':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'epic_dance':
                       targetCameraPosition.x = baseX * zoomFactor * 0.4 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.4 + cameraOffset.z;
                       break;

                   case 'flip_tumble':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'extreme_flip':
                       targetCameraPosition.x = baseX * zoomFactor * 0.3 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.3 + cameraOffset.z;
                       break;

                   case 'quantum_split':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'extreme_quantum':
                       targetCameraPosition.x = baseX * zoomFactor * 0.5 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.5 + cameraOffset.z;
                       break;

                   case 'tsunami_wave':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'extreme_tsunami':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'singularity_pull':
                       targetCameraPosition.x = baseX * zoomFactor * 0.4 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.4 + cameraOffset.z;
                       break;

                   case 'extreme_singularity':
                       targetCameraPosition.x = baseX * zoomFactor * 0.02 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.02 + cameraOffset.z;
                       break;

                   case 'rave_strobe':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'extreme_rave':
                       targetCameraPosition.x = baseX * zoomFactor * 0.6 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.6 + cameraOffset.z;
                       break;

                   case 'whirlpool_spiral':
                       targetCameraPosition.x = baseX * zoomFactor + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor + cameraOffset.z;
                       break;

                   case 'extreme_whirlpool':
                       targetCameraPosition.x = baseX * zoomFactor * 0.15 + cameraOffset.x;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier + cameraOffset.y;
                       targetCameraPosition.z = baseZ * zoomFactor * 0.15 + cameraOffset.z;
                       break;

                   default:
                       // Default camera movement
                       targetCameraPosition.x = baseX * zoomFactor * angleFactor;
                       targetCameraPosition.y = baseY * zoomFactor * heightMultiplier;
                       targetCameraPosition.z = baseZ * zoomFactor * angleFactor;
                       break;
    }
};

// Make it available globally for easy testing
window.setHoverEffect = setHoverEffect;
window.getCurrentHoverEffect = getCurrentHoverEffect;
window.applyCameraMovement = applyCameraMovement;

// Initialize hover effect switcher
const initHoverEffectSwitcher = () => {
    const prevButton = document.getElementById('prevHoverEffect');
    const nextButton = document.getElementById('nextHoverEffect');
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            const newIndex = (hoverEffectsConfig.currentEffectIndex - 1 + hoverEffectsConfig.hoverEffects.length) % hoverEffectsConfig.hoverEffects.length;
            setHoverEffect(newIndex);
        });
    }
    
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            const newIndex = (hoverEffectsConfig.currentEffectIndex + 1) % hoverEffectsConfig.hoverEffects.length;
            setHoverEffect(newIndex);
        });
    }
    
    // Set initial display
    updateHoverEffectDisplay();
};

// Function to update CSS custom properties with galaxy colors
const updateGalaxyColors = (insideColor, outsideColor) => {
    const root = document.documentElement;
    root.style.setProperty('--galaxy-inside-color', insideColor);
    root.style.setProperty('--galaxy-outside-color', outsideColor);
    root.style.setProperty('--galaxy-primary', outsideColor);
    root.style.setProperty('--galaxy-secondary', insideColor);
    root.style.setProperty('--galaxy-accent', outsideColor);
};

const applyPreset = (preset) => {
    // Apply galaxy parameters
    if (preset.galaxy) {
        Object.keys(preset.galaxy).forEach(key => {
            if (parameters.hasOwnProperty(key)) {
                parameters[key] = preset.galaxy[key];
            }
        });
        
        // Update CSS custom properties with galaxy colors
        if (preset.galaxy.insideColor && preset.galaxy.outsideColor) {
            updateGalaxyColors(preset.galaxy.insideColor, preset.galaxy.outsideColor);
        }
    }
    
    // Apply camera settings
    if (preset.camera) {
        if (preset.camera.position) {
            // Set camera position and update the original position for smooth animations
            camera.position.set(
                preset.camera.position.x,
                preset.camera.position.y,
                preset.camera.position.z
            );
            
            // Update the original camera position for button hover effects
            originalCameraPosition = {
                x: preset.camera.position.x,
                y: preset.camera.position.y,
                z: preset.camera.position.z
            };
            targetCameraPosition = { ...originalCameraPosition };
        }
        
        if (preset.camera.basic) {
            controls.enableRotate = preset.camera.basic.enableRotate;
            controls.enableZoom = preset.camera.basic.enableZoom;
            controls.enablePan = preset.camera.basic.enablePan;
            // Make camera changes immediate for preset switching
            controls.dampingFactor = 0.01; // Much faster response
        }
        
        if (preset.camera.movement) {
            controls.autoRotate = preset.camera.movement.autoRotate || false;
            controls.autoRotateSpeed = preset.camera.movement.rotationSpeed || 0;
            controls.minDistance = preset.camera.movement.minDistance || 1;
            controls.maxDistance = preset.camera.movement.maxDistance || 20;
            controls.minPolarAngle = preset.camera.movement.minAngle || 0.1;
            controls.maxPolarAngle = preset.camera.movement.maxAngle || 2.0;
        }
    }
    
    generateGalaxy();
    
    // Force immediate camera update for instant preset switching
    controls.update();
    
    // Update spin direction for vinyl effect based on preset
    if (material && material.uniforms.uSpinDirection) {
        // Use the sign of the spin parameter to determine vinyl spin direction
        material.uniforms.uSpinDirection.value = Math.sign(preset.galaxy.spin || 1);
    }
    
    // Ensure normal rotation speed is consistent
    if (material && material.uniforms.uNormalRotationSpeed) {
        material.uniforms.uNormalRotationSpeed.value = 0.05; // Always keep original speed
    }
    
    // Apply preset's assigned hover effect
    if (preset.hoverEffect) {
        const effectIndex = preset.hoverEffect.index;
        if (effectIndex >= 0 && effectIndex < hoverEffectsConfig.hoverEffects.length) {
            hoverEffectsConfig.currentEffectIndex = effectIndex;
            updateHoverEffectDisplay();
            console.log(`Applied hover effect "${preset.hoverEffect.name}" to preset "${preset.name}"`);
        }
    }
    
    // Original camera position is now updated above in the camera settings section
};

// Initialize with first preset
applyPreset(presets[0]);

// Preset controls
const presetName = document.getElementById('currentPreset');
const prevPresetButton = document.getElementById('prevPreset');
const nextPresetButton = document.getElementById('nextPreset');

// Update preset display
const updatePresetDisplay = () => {
    if (presetName) {
        presetName.textContent = presets[currentPresetIndex].name;
    }
};

// Show/hide loading indicator
const showPresetLoading = () => {
    const loadingElement = document.getElementById('presetLoading');
    if (loadingElement) {
        loadingElement.style.display = 'block';
    }
};

const hidePresetLoading = () => {
    const loadingElement = document.getElementById('presetLoading');
    if (loadingElement) {
        loadingElement.style.display = 'none';
    }
};

// Initialize preset display
updatePresetDisplay();

// Preset switching - only arrow buttons are clickable, preset name is just display

if (prevPresetButton) {
    prevPresetButton.addEventListener('click', () => {
        showPresetLoading();
        currentPresetIndex = (currentPresetIndex - 1 + presets.length) % presets.length;
        applyPreset(presets[currentPresetIndex]);
        updatePresetDisplay();
        // Hide loading after a short delay to show the transition
        setTimeout(hidePresetLoading, 200);
    });
}

if (nextPresetButton) {
    nextPresetButton.addEventListener('click', () => {
        showPresetLoading();
        currentPresetIndex = (currentPresetIndex + 1) % presets.length;
        applyPreset(presets[currentPresetIndex]);
        updatePresetDisplay();
        // Hide loading after a short delay to show the transition
        setTimeout(hidePresetLoading, 200);
    });
}

// Preset functionality is now complete

// Color mode toggle
const colorModeToggle = document.querySelector('.color-mode-toggle');
const sunIcon = document.getElementById('sun-icon');
const moonIcon = document.getElementById('moon-icon');

if (colorModeToggle) {
    colorModeToggle.addEventListener('click', () => {
        const isBrightMode = document.body.classList.toggle('bright-mode');
        
        // Switch icons
        if (sunIcon && moonIcon) {
            if (isBrightMode) {
                sunIcon.style.display = 'none';
                moonIcon.style.display = 'block';
                colorModeToggle.setAttribute('aria-label', 'Switch to dark mode');
            } else {
                sunIcon.style.display = 'block';
                moonIcon.style.display = 'none';
                colorModeToggle.setAttribute('aria-label', 'Switch to bright mode');
            }
        }
        
        console.log(`Switched to ${isBrightMode ? 'bright' : 'dark'} mode`);
    });
}

// Email subscription
const initializeEmailSubscription = () => {
    const emailForm = document.getElementById('emailForm');
    const mobileEmailForm = document.getElementById('mobileEmailForm');
    
    // Google Forms field mapping (from your live form)
    // Use emailAddress for collected email (system email question)
    const GOOGLE_FORM_FIELDS = {
        emailAddress: 'emailAddress',
        project: 'entry.251321992',
        source: 'entry.958441726',
        // Optional custom note field if you decide to send it later:
        // note: 'entry.1315217004'
    };

    const showToast = (message, isSuccess = true) => {
        // Remove any existing toast
        const existingToast = document.querySelector('.galaxy-toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = 'galaxy-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">${isSuccess ? '✓' : '⚠'}</div>
                <div class="toast-message">${message}</div>
                <button class="toast-close" aria-label="Close notification">×</button>
            </div>
        `;
        
        // Add to body
        document.body.appendChild(toast);
        
        // Show toast with animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        // Auto-hide after 5 seconds
        const hideToast = () => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        };
        
        setTimeout(hideToast, 5000);
        
        // Close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', hideToast);
    };

    const showMessage = (form, message, isSuccess = true) => {
        // Clear any existing inline message
        const messageElement = form.querySelector('.subscription-message');
        if (messageElement) {
                messageElement.style.display = 'none';
        }
        
        // Show toast instead
        showToast(message, isSuccess);
    };

    let isFormSubmitting = false;

    const setLoadingState = (form, isLoading) => {
        const button = form.querySelector('.subscribe-button');
        
        if (isLoading) {
            isFormSubmitting = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
        } else {
            isFormSubmitting = false;
            button.style.opacity = '1';
            button.style.cursor = 'pointer';
        }
    };

    const isValidEmail = (value) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    };

    const updateButtonState = (form) => {
        const button = form.querySelector('.subscribe-button');
        const emailInput = form.querySelector('.email-input');
        const email = (emailInput?.value || '').trim();
        const valid = isValidEmail(email);
        if (button) {
            button.disabled = !valid || isFormSubmitting;
        }
    };

    const attachValidation = (form) => {
        const emailInput = form.querySelector('.email-input');
        if (emailInput) {
            emailInput.addEventListener('input', () => updateButtonState(form));
            // Initialize
            updateButtonState(form);
        }
    };

    const submitForm = async (form) => {
        // Prevent multiple submissions
        if (isFormSubmitting) {
            return;
        }
        
        const emailInput = form.querySelector('.email-input');
        const projectInput = form.querySelector('.project-input');
        const sourceInput = form.querySelector('.source-input');
        
        const email = emailInput.value.trim();
        const project = projectInput.value.trim();
        const source = sourceInput.value.trim();
        
        if (!email) {
            showMessage(form, 'Please enter your email address.', false);
            updateButtonState(form);
            return;
        }

        if (!isValidEmail(email)) {
            showMessage(form, 'Please enter a valid email address.', false);
            updateButtonState(form);
            return;
        }
        
        // Vinyl spin already started on button click
        console.log('Form submitting - vinyl spin should already be active');
        
        setLoadingState(form, true);
        
        try {
            // Use URL-encoded payload with only the necessary fields
            const payload = new URLSearchParams();
            payload.append(GOOGLE_FORM_FIELDS.emailAddress, email);
            if (project) payload.append(GOOGLE_FORM_FIELDS.project, project);
            if (source) payload.append(GOOGLE_FORM_FIELDS.source, source);
            
            // Debug: print what keys are being sent
            try {
                console.log('Submitting to Google Forms keys:', Array.from(payload.keys()));
            } catch (_) {}
            
            const GOOGLE_FORM_ENDPOINT = 'https://docs.google.com/forms/d/e/1FAIpQLSfD2YLLpw_FlMAbi1-q9gSEu2Hw8GQzmUh3uSabsT4f7xl45g/formResponse';
            await fetch(GOOGLE_FORM_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                body: payload.toString()
            });
            
            showMessage(form, 'You\'re in! You\'ve joined the Overvibing community list. By subscribing, you consent to receive emails about updates and event invites. Unsubscribe anytime.');
            form.reset();
            
        } catch (error) {
            console.error('Form submission error:', error);
            showMessage(form, 'You\'re in! You\'ve joined the Overvibing community list. By subscribing, you consent to receive emails about updates and event invites. Unsubscribe anytime.');
            form.reset();
        } finally {
            setLoadingState(form, false);
            updateButtonState(form);
        }
    };

    if (emailForm) {
        emailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(emailForm);
        });
        attachValidation(emailForm);
    }

    if (mobileEmailForm) {
        mobileEmailForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitForm(mobileEmailForm);
        });
        attachValidation(mobileEmailForm);
    }
};

// Initialize email subscription
initializeEmailSubscription();

// Restore yesterday's NEXT MEETING timer behavior
function updateTimer() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    
    // Calculate next Tuesday 17:00 UTC+2 (15:00 UTC)
    let nextMeeting = new Date(now);
    nextMeeting.setUTCHours(15, 0, 0, 0);
    const daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
    nextMeeting.setUTCDate(nextMeeting.getUTCDate() + daysUntilTuesday);
    if (dayOfWeek === 2 && hours >= 15) {
        nextMeeting.setUTCDate(nextMeeting.getUTCDate() + 7);
    }
    
    const diff = nextMeeting - now;
    const diffMinutes = diff / (1000 * 60);
    const meetingInProgress = dayOfWeek === 2 && hours >= 15 && hours < 17;

    const timerElement = document.querySelector('.countdown-timer');
    const meetButton = document.querySelector('.modern-button');
    const meetLink = 'https://meet.google.com/svb-xcme-opq';

    if (meetingInProgress) {
        const meetingStart = new Date(now);
        meetingStart.setUTCHours(15, 0, 0, 0);
        const elapsed = now - meetingStart;
        const elapsedHours = Math.floor(elapsed / 3600000);
        const elapsedMinutes = Math.floor((elapsed % 3600000) / 60000);
        const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);
        const elapsedMs = elapsed % 1000;
        const timeStr = `${String(elapsedHours).padStart(2, '0')}:${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;
        timerElement.innerHTML = `<b>LIVE</b> ${timeStr}<span class="milliseconds">.${String(elapsedMs).padStart(3, '0')}</span>`;
        meetButton.textContent = 'JOIN NOW!';
        meetButton.href = meetLink;
    } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);
        const ms = diff % 1000;

        const timeStr = `${days}d ${String(hoursLeft).padStart(2, '0')}h ${String(minutesLeft).padStart(2, '0')}m ${String(secondsLeft).padStart(2, '0')}s ${String(ms).padStart(3, '0')}ms`;
        timerElement.innerHTML = `<b>NEXT MEETING:</b> <span style="color: rgba(255, 255, 255, 0.7);">${timeStr}</span>`;

        if (diffMinutes <= 60 && diffMinutes > 15) {
            const mins = Math.floor(diffMinutes);
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            meetButton.textContent = `JOIN SOON! ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            meetButton.href = meetLink;
        } else if (diffMinutes <= 15 && diffMinutes > 0) {
            const mins = Math.floor(diffMinutes);
            const secs = Math.floor((diff % (1000 * 60)) / 1000);
            meetButton.textContent = `JOIN NOW! ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            meetButton.href = meetLink;
        } else {
            const endMeeting = new Date(nextMeeting);
            endMeeting.setUTCHours(endMeeting.getUTCHours() + 2);
            const eventDetails = encodeURIComponent('OVERVIBING - When Humans and AI get lost together in the VIBE CODING flow.\n\n' +
                '🗓 Every Tuesday\n' +
                '🕔 17:00 – 18:00 (Europe/Paris)\n' +
                '📍 Google Meet → https://meet.google.com/svb-xcme-opq\n\n' +
                '⸻\n\n' +
                '🎯 Purpose\n\n' +
                'A weekly meeting to examine what really happens when AI becomes part of the development process.\n\n' +
                'We focus on:\n' +
                '       •       What goes wrong when AI-generated code or flow-based work causes misalignment\n' +
                '       •       How to detect early signs of confusion, lost context, and overdependence on tooling\n' +
                '       •       What practical steps teams can take to stay in control — through boundaries, checks, and better habits\n\n' +
                'No hype — just a space to talk through real examples and avoid common traps.\n\n' +
                '🔍 Definitions\n\n' +
                'VIBE-CODING → Coding with AI in a fast, creative flow that feels productive.\n' +
                'OVER-VIBING → Losing clarity, structure, or intent by going too deep into flow without critical checkpoints.\n\n' +
                '⸻\n\n' +
                '— Michael\n' +
                'one-front.com');
            const calendarLink = 'https://calendar.google.com/calendar/render' +
                '?action=TEMPLATE' +
                '&text=🌀 OVERVIBING - Weekly Meeting' +
                `&details=${eventDetails}` +
                '&location=https://meet.google.com/svb-xcme-opq' +
                `&dates=${nextMeeting.toISOString().replace(/[-:]/g, '').split('.')[0]}Z` +
                `/${endMeeting.toISOString().replace(/[-:]/g, '').split('.')[0]}Z` +
                '&recur=RRULE:FREQ=WEEKLY';
            meetButton.textContent = 'ADD TO CALENDAR!';
            meetButton.href = calendarLink;
        }
    }
}

//  Update timer every 10ms for smooth milliseconds display
setInterval(updateTimer, 10);
updateTimer(); // Initial call

// Generate initial galaxy
generateGalaxy()

// Animate
const clock = new THREE.Clock()
let lastElapsedTime = 0
let rotationPhaseOffset = 0 // feeds uRotationOffset for seamless continuity
let galaxyPaused = false

const pauseGalaxy = () => {
    galaxyPaused = true
    vinylSpinActive = false
    vinylSpinSpeed = 1.0
    hoverParameters.targetHoverIntensity = 0.0
}

const resumeGalaxy = () => {
    galaxyPaused = false
}

const tick = () =>
{
    if (galaxyPaused) {
        // Keep rendering the current frame without updating motion
        controls.update()
        renderer.render(scene, camera)
        window.requestAnimationFrame(tick)
        return
    }

    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - lastElapsedTime

    // Update hover intensity with smooth transition
    hoverParameters.hoverIntensity += (hoverParameters.targetHoverIntensity - hoverParameters.hoverIntensity) * hoverParameters.transitionSpeed;
    
    // Update brightness multiplier with smooth easing
    hoverParameters.currentBrightnessMultiplier += (hoverParameters.targetBrightnessMultiplier - hoverParameters.currentBrightnessMultiplier) * hoverParameters.brightnessTransitionSpeed;
    
    // Update material uniforms
    material.uniforms.uTime.value = elapsedTime
    material.uniforms.uHoverIntensity.value = hoverParameters.hoverIntensity
    material.uniforms.uHoverSizeMultiplier.value = 1.0 + (hoverParameters.hoverIntensity * (hoverParameters.sizeMultiplier - 1.0))
    
    // Use vinyl spin speed if active, otherwise use hover-based spin
    if (vinylSpinActive) {
        // Vinyl spin takes priority - ignore hover effects
        material.uniforms.uHoverSpinMultiplier.value = vinylSpinSpeed;
        // Keep normal brightness - no color intensification on vinyl spin
        material.uniforms.uHoverBrightnessMultiplier.value = 1.0;
        // Accumulate rotation phase offset difference to avoid jump when we switch back
        const spinDir = material && material.uniforms.uSpinDirection ? material.uniforms.uSpinDirection.value : 1.0;
        const currentSpeed = 0.2 * vinylSpinSpeed * spinDir;
        const normalSpeed = material && material.uniforms.uNormalRotationSpeed ? material.uniforms.uNormalRotationSpeed.value * spinDir : 0.05 * spinDir;
        rotationPhaseOffset += Math.max(0, deltaTime) * (currentSpeed - normalSpeed);
        if (material && material.uniforms.uRotationOffset) {
            material.uniforms.uRotationOffset.value = rotationPhaseOffset;
        }
        // Debug: log every 60 frames (about once per second) when vinyl is active
        if (Math.floor(elapsedTime) % 1 === 0 && Math.floor(elapsedTime * 60) % 60 === 0) {
            console.log('FRAME: Vinyl spin active, speed:', vinylSpinSpeed, 'uniform value:', material.uniforms.uHoverSpinMultiplier.value);
        }
    } else {
        // Normal hover effects only when vinyl spin is not active
        // Use smooth transitions for all hover effects
        material.uniforms.uHoverSpinMultiplier.value = 1.0 + (hoverParameters.hoverIntensity * (hoverParameters.spinMultiplier - 1.0));
        // Use smooth brightness easing instead of instant calculation
        material.uniforms.uHoverBrightnessMultiplier.value = hoverParameters.currentBrightnessMultiplier;
    }

    // Smooth camera movement for button hover effects (only when not being controlled by user)
    if (!controls.isUserInteracting) {
        const easeFactor = 0.05;
        const distance = Math.sqrt(
            Math.pow(targetCameraPosition.x - camera.position.x, 2) +
            Math.pow(targetCameraPosition.y - camera.position.y, 2) +
            Math.pow(targetCameraPosition.z - camera.position.z, 2)
        );
        
        // Only move if distance is significant enough
        if (distance > 0.001) {
            camera.position.x += (targetCameraPosition.x - camera.position.x) * easeFactor;
            camera.position.y += (targetCameraPosition.y - camera.position.y) * easeFactor;
            camera.position.z += (targetCameraPosition.z - camera.position.z) * easeFactor;
        }
    }
    
    // Option 1: Temporarily disable autoRotate while hover is active or decaying
    const hoverActiveOrDecaying = hoverParameters.isHovered || hoverParameters.hoverIntensity > 0.01;
    if (hoverActiveOrDecaying && !autoRotateTemporarilyDisabled) {
        previousAutoRotate = controls.autoRotate;
        previousAutoRotateSpeed = controls.autoRotateSpeed || 0;
        controls.autoRotate = false;
        autoRotateTemporarilyDisabled = true;
    }
    if (!hoverActiveOrDecaying && autoRotateTemporarilyDisabled) {
        controls.autoRotate = previousAutoRotate;
        controls.autoRotateSpeed = previousAutoRotateSpeed;
        autoRotateTemporarilyDisabled = false;
    }

    // Option 2: Pin targetCameraPosition to live camera position while decaying after hover-out
    if (!hoverParameters.isHovered && hoverParameters.hoverIntensity > 0.01) {
        targetCameraPosition.x = camera.position.x;
        targetCameraPosition.y = camera.position.y;
        targetCameraPosition.z = camera.position.z;
    }
    
    // Make camera look at the galaxy center
    camera.lookAt(0, 0, 0);

    // Update controls
    controls.update()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
    lastElapsedTime = elapsedTime
}

tick()

// Handle resize
window.addEventListener('resize', () =>
{
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = window.innerHeight

    // Update camera
    camera.aspect = sizes.width / sizes.height
    camera.updateProjectionMatrix()

    // Update renderer
    renderer.setSize(sizes.width, sizes.height)
    // Keep the same cap on resize
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
})

// Simple cursor effect for buttons (performance optimized)
function initSimpleCursorEffect() {
    const buttons = document.querySelectorAll('.modern-button[href*="calendar.google.com"], .subscribe-button');
    
    buttons.forEach(button => {
        button.addEventListener('mousemove', (e) => {
            const rect = button.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            
            button.style.setProperty('--mouse-x', `${x}%`);
            button.style.setProperty('--mouse-y', `${y}%`);
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.setProperty('--mouse-x', '50%');
            button.style.setProperty('--mouse-y', '50%');
        });
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initSimpleCursorEffect);

// Button hover effects for camera zoom and galaxy color intensity
const initButtonHoverEffects = () => {
    const buttons = document.querySelectorAll('.modern-button, .corner-link, .subscribe-button');
    
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            // Check if it's the "Add to Calendar" button for maximum effects
            const isCalendarButton = button.textContent.includes('ADD TO CALENDAR') || 
                                   button.textContent.includes('JOIN NOW') || 
                                   button.textContent.includes('JOIN SOON');
            
            const isSubscribeButton = button.classList.contains('subscribe-button');
            
            if (isCalendarButton) {
                // EPIC CALENDAR BUTTON EFFECTS - Current hover effect
                hoverParameters.targetHoverIntensity = 1.0; // Maximum intensity
                hoverParameters.isHovered = true;
                
                // Get current hover effect from config
                const currentEffect = getCurrentHoverEffect();
                const calendarEffects = currentEffect.calendarButton;
                
                // Set epic multipliers for calendar button from current effect
                hoverParameters.sizeMultiplier = calendarEffects.sizeMultiplier;
                hoverParameters.spinMultiplier = calendarEffects.spinMultiplier;
                hoverParameters.brightnessMultiplier = calendarEffects.brightnessMultiplier;
                // Set target brightness for smooth easing
                hoverParameters.targetBrightnessMultiplier = calendarEffects.brightnessMultiplier;
                
                // Update spin direction in shader
                if (material && material.uniforms.uSpinDirection) {
                    material.uniforms.uSpinDirection.value = calendarEffects.spinDirection || 1;
                }
                
                // Epic camera movement - configurable zoom, angle, and movement type
                const zoomFactor = calendarEffects.zoomFactor;
                const angleFactor = calendarEffects.angleFactor;
                const cameraMovement = calendarEffects.cameraMovement || 'default';
                const cameraOffset = calendarEffects.cameraOffset || {x: 0, y: 0, z: 0};
                
                // Apply camera movement based on effect type
                applyCameraMovement(cameraMovement, zoomFactor, angleFactor, calendarEffects.heightMultiplier, cameraOffset);
                
                // Don't immediately set galaxy effects - let them transition smoothly
                // The hover intensity will handle the smooth transition
            } else {
                // Normal button effects
                hoverParameters.targetHoverIntensity = 0.3; // Light intensity
                hoverParameters.isHovered = true;
                
                // Set target brightness for smooth easing
                const currentEffect = getCurrentHoverEffect();
                hoverParameters.targetBrightnessMultiplier = currentEffect.normalButtons.brightnessMultiplier;
                
                const zoomFactor = 0.8; // Normal zoom
                targetCameraPosition.x *= zoomFactor;
                targetCameraPosition.y *= zoomFactor;
                targetCameraPosition.z *= zoomFactor;
                
                // Don't immediately set galaxy effects - let them transition smoothly
                // The hover intensity will handle the smooth transition
            }
        });
        
        button.addEventListener('mouseleave', () => {
            // Check if it's the "Add to Calendar" button for proper reset
            const isCalendarButton = button.textContent.includes('ADD TO CALENDAR') || 
                                   button.textContent.includes('JOIN NOW') || 
                                   button.textContent.includes('JOIN SOON');
            
            const isSubscribeButton = button.classList.contains('subscribe-button');
            
            if (isCalendarButton) {
                // Reset epic galaxy event - galaxy returns to normal size
                hoverParameters.targetHoverIntensity = 0.0; // Reset to normal
                hoverParameters.isHovered = false;
                
                // Reset multipliers back to normal values from current effect
                const currentEffect = getCurrentHoverEffect();
                hoverParameters.sizeMultiplier = currentEffect.normalButtons.sizeMultiplier;
                hoverParameters.spinMultiplier = currentEffect.normalButtons.spinMultiplier;
                hoverParameters.brightnessMultiplier = currentEffect.normalButtons.brightnessMultiplier;
                // Reset target brightness for smooth easing back to normal
                hoverParameters.targetBrightnessMultiplier = 1.0;
                
                // Reset spin direction to normal
                if (material && material.uniforms.uSpinDirection) {
                    material.uniforms.uSpinDirection.value = currentEffect.normalButtons.spinDirection || 1;
                }
                
                // Return camera to original preset position
                targetCameraPosition.x = originalCameraPosition.x;
                targetCameraPosition.y = originalCameraPosition.y;
                targetCameraPosition.z = originalCameraPosition.z;
                
                // Don't immediately reset galaxy effects - let them transition smoothly
                // The hover intensity will handle the smooth transition back to normal
            } else {
                // Reset normal button effects
                hoverParameters.targetHoverIntensity = 0.0; // Reset to normal
                hoverParameters.isHovered = false;
                
                // Reset target brightness for smooth easing back to normal
                hoverParameters.targetBrightnessMultiplier = 1.0;
                
                // Return camera to exact original position (same as calendar buttons)
                targetCameraPosition.x = originalCameraPosition.x;
                targetCameraPosition.y = originalCameraPosition.y;
                targetCameraPosition.z = originalCameraPosition.z;
                
                // Don't immediately reset galaxy effects - let them transition smoothly
                // The hover intensity will handle the smooth transition back to normal
            }
        });
    });
};

// Initialize button hover effects
document.addEventListener('DOMContentLoaded', initButtonHoverEffects);

// Initialize hover effect switcher
document.addEventListener('DOMContentLoaded', initHoverEffectSwitcher);

// Simple camera system for button hover effects only
let originalCameraPosition = { x: 3, y: 3, z: 3 }; // Default fallback
let targetCameraPosition = { x: 3, y: 3, z: 3 };

const initCameraSystem = () => {
    // Store the current preset's camera position as the original
    originalCameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
    };
    targetCameraPosition = { ...originalCameraPosition };
    
    // Camera animation is now handled in the main tick loop
    // No separate animation loop needed
};

// Vinyl record spin effect for subscribe button
let vinylSpinActive = false;
let vinylSpinSpeed = 1.0;
let newNormalRotationSpeed = 0.05; // This will be updated after vinyl spin

const startVinylSpin = () => {
    console.log('startVinylSpin called');
    console.log('material exists:', !!material);
    console.log('uHoverSpinMultiplier exists:', !!(material && material.uniforms.uHoverSpinMultiplier));
    
            if (material && material.uniforms.uHoverSpinMultiplier) {
                console.log('Starting vinyl spin effect');
        vinylSpinActive = true;
        vinylSpinSpeed = 1.0; // Start at normal speed
        
        // Change camera position for vinyl spin - move to top view
        targetCameraPosition.x = 0;
        targetCameraPosition.y = 8; // Higher up for top-down view
        targetCameraPosition.z = 0; // Directly above the galaxy
        
        console.log('Set vinylSpinActive to true, starting smooth spin animation');
        
        // Start smooth 2-second spin animation
        animateVinylSpin();
                    } else {
        console.log('Cannot start vinyl spin - material or uniform not available');
    }
};

const animateVinylSpin = () => {
    console.log('Starting smooth 2-second vinyl spin animation');
    
    const startTime = Date.now();
    const totalDuration = 2000; // 2 seconds total
    
    const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / totalDuration, 1.0);
        
        if (vinylSpinActive && progress < 1.0) {
            // Smooth ease-in-out curve: slow start, fast middle, slow end
            const easeInOut = progress < 0.5 
                ? 2 * progress * progress  // Ease in (first half)
                : 1 - Math.pow(-2 * progress + 2, 3) / 2; // Ease out (second half)
            
            // Speed goes from 1.0 to 8.0 and back to 1.0 smoothly
            const speedMultiplier = 1.0 + (7.0 * Math.sin(easeInOut * Math.PI)); // Sine wave for smooth curve
            vinylSpinSpeed = speedMultiplier;
            
            // Continue animation
            requestAnimationFrame(animate);
            } else {
            // Animation complete - finish smoothly
            vinylSpinActive = false;
            vinylSpinSpeed = 1.0;
            
            // Calculate rotation offset to maintain continuity
            const currentTime = Date.now() / 1000; // Convert to seconds
            const vinylRotationAtEnd = currentTime * 0.2 * 1.0; // Final vinyl rotation
            const normalRotationAtEnd = currentTime * 0.05; // What normal rotation would be
            const rotationOffset = vinylRotationAtEnd - normalRotationAtEnd;
            
            // Set the rotation offset to maintain continuity
            if (material && material.uniforms.uRotationOffset) {
                material.uniforms.uRotationOffset.value = rotationOffset;
            }
            
            // Keep the normal rotation speed consistent (don't change it permanently)
            // The galaxy should return to its original rotation speed
            if (material && material.uniforms.uNormalRotationSpeed) {
                material.uniforms.uNormalRotationSpeed.value = 0.05; // Keep original speed
            }
            
            // Keep camera in top-down position - don't return to original
            // targetCameraPosition stays at (0, 8, 0)
            
            console.log('Smooth vinyl spin animation completed - rotation offset set to:', rotationOffset);
        }
    };
    
    // Start animation
    requestAnimationFrame(animate);
};

// Removed stop button logic

const initVinylSpinEffect = () => {
    const subscribeButtons = document.querySelectorAll('.subscribe-button');
    console.log('Found subscribe buttons:', subscribeButtons.length);
    
    subscribeButtons.forEach((button, index) => {
        console.log(`Adding click listener to button ${index}:`, button);
        button.addEventListener('click', (e) => {
            console.log('Subscribe button clicked - no galaxy effect triggered.');
            // No galaxy effects on subscribe click
        });
    });
    
    // Stop button removed
};

// Initialize camera system after galaxy is created
setTimeout(() => {
    if (points) {
        console.log('Initializing camera system and vinyl spin effect');
        initCameraSystem();
        initVinylSpinEffect();
    } else {
        console.log('Points not found, skipping vinyl spin effect initialization');
    }
}, 100);

// Initialize keyboard controls for preset switching
const initKeyboardControls = () => {
    document.addEventListener('keydown', (event) => {
        // Only handle arrow keys when not typing in input fields
        const activeElement = document.activeElement;
        const isInputField = activeElement && (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );

        if (isInputField) {
            // Allow default behavior while typing
            return;
        }

        // Toggle settings (color mode button and effect selector)
        if ((event.ctrlKey || event.metaKey) && (event.key === 'o' || event.key === 'O')) {
            event.preventDefault();
            toggleSettingsVisibility();
            return;
        }

        switch (event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                showPresetLoading();
                // Previous preset
                currentPresetIndex = (currentPresetIndex - 1 + presets.length) % presets.length;
                applyPreset(presets[currentPresetIndex]);
                updatePresetDisplay();
                console.log(`Keyboard: Switched to previous preset "${presets[currentPresetIndex].name}"`);
                // Hide loading after a short delay to show the transition
                setTimeout(hidePresetLoading, 200);
                break;

            case 'ArrowRight':
                event.preventDefault();
                showPresetLoading();
                // Next preset
                currentPresetIndex = (currentPresetIndex + 1) % presets.length;
                applyPreset(presets[currentPresetIndex]);
                updatePresetDisplay();
                console.log(`Keyboard: Switched to next preset "${presets[currentPresetIndex].name}"`);
                // Hide loading after a short delay to show the transition
                setTimeout(hidePresetLoading, 200);
                break;
        }
    });

    console.log('Keyboard controls initialized - use Left/Right arrow keys to switch presets');
};

// Also try to initialize vinyl spin effect when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, trying to initialize vinyl spin effect');
    setTimeout(() => {
        initVinylSpinEffect();
    }, 500); // Wait a bit longer for all elements to be ready
    
    // Initialize keyboard controls
    initKeyboardControls();
    // Hide settings UI by default
    setSettingsVisibility(false);
});

// Settings visibility (color mode button + hover effect selector)
let settingsVisible = false;

const setSettingsVisibility = (visible) => {
    settingsVisible = !!visible;
    const colorToggle = document.getElementById('color-mode-toggle');
    const effectSection = document.querySelector('.hover-effect-section');
    if (colorToggle) {
        colorToggle.style.display = settingsVisible ? '' : 'none';
    }
    if (effectSection) {
        effectSection.style.display = settingsVisible ? '' : 'none';
    }
};

const toggleSettingsVisibility = () => {
    setSettingsVisibility(!settingsVisible);
};
