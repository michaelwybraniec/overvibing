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
let galaxyHoverMix = 0
let targetGalaxyHoverMix = 0
let galaxySphere = null
let galaxySphereMaterial = null
let galaxyCloudSphere = null
let galaxyCloudMaterial = null
let galaxyAtmosphereSphere = null
let galaxyAtmosphereMaterial = null

const sphereState = {
    hover: 0,
    targetHover: 0,
    scale: 0.96,
    targetScale: 0.96,
    presetScale: 1,
    cloudLayerScale: 1,
    atmosphereScale: 1,
    rotationSpeed: 0,
    targetRotationSpeed: 0,
    hoverTwist: 0
}

const getSpherePatternSeed = (preset) => {
    const source = preset?.name || `${parameters.insideColor}-${parameters.outsideColor}`;
    let hash = 0;
    for (let i = 0; i < source.length; i++) {
        hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    return Math.abs(hash % 10000) / 1000;
}

const getSunDirectionFromLocalTime = () => {
    const now = new Date()
    const hours = now.getHours() + (now.getMinutes() / 60) + (now.getSeconds() / 3600)
    const dayPhase = (hours / 24) * Math.PI * 2
    const elevation = Math.sin(dayPhase - Math.PI * 0.5) * 0.35 + 0.25
    const direction = new THREE.Vector3(
        Math.cos(dayPhase),
        elevation,
        Math.sin(dayPhase)
    )
    return direction.normalize()
}

const getSkyThemeProfile = (preset) => {
    const seed = getSpherePatternSeed(preset)
    const seedA = (Math.sin(seed * 2.13 + 0.41) + 1) * 0.5
    const seedB = (Math.sin(seed * 1.27 + 2.17) + 1) * 0.5
    const seedC = (Math.sin(seed * 2.87 + 4.93) + 1) * 0.5
    const presetName = preset?.name?.toLowerCase() || ''

    if (presetName === 'binary system') {
        return {
            cloudDensity: 0.42 + seedA * 0.12,
            cloudContrast: 0.52 + seedB * 0.18,
            atmosphereStrength: 0.38 + seedC * 0.16,
            cloudSharpness: 1.65 + seedB * 0.22,
            cloudScale: 1.45 + seedA * 0.20,
            cloudOpacity: 0.72,
            riverStrength: 0.37 + seedB * 0.08,
            riverPattern: 1.0,
            riverDarkness: 1.45,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            surfaceGlowStrength: 0.0
        }
    }

    if (presetName === 'amber spiral') {
        return {
            cloudDensity: 0.0,
            cloudContrast: 0.0,
            atmosphereStrength: 1.75 + seedC * 0.55,
            cloudSharpness: 1.2,
            cloudScale: 1.1,
            cloudOpacity: 0.0,
            riverStrength: 0.68 + seedB * 0.14,
            riverPattern: 1.0,
            riverDarkness: 1.15,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            surfaceGlowStrength: 0.0
        }
    }

    if (presetName === 'aqua dream') {
        return {
            cloudDensity: 0.34 + seedA * 0.10,
            cloudContrast: 0.72 + seedB * 0.16,
            atmosphereStrength: 0.88 + seedC * 0.22,
            cloudSharpness: 1.08 + seedB * 0.08,
            cloudScale: 1.06 + seedA * 0.06,
            cloudOpacity: 0.52,
            riverStrength: 1.15 + seedB * 0.35,
            riverPattern: 0.0,
            riverDarkness: 1.0,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            gasEscapeIntensity: 1.0,
            oceanStrength: 2.4,
            oceanPrimaryTint: 1.0,
            oceanGlowStrength: 1.9,
            oceanBrightness: 1.28,
            lakeGlowStrength: 2.2,
            megaVolcanoIntensity: 1.0,
            sphereRotationSpeed: 0.06,
            surfaceGlowStrength: 0.0
        }
    }

    if (presetName === 'purple haze') {
        return {
            cloudDensity: 0.76 + seedA * 0.22,
            cloudContrast: 1.00 + seedB * 0.24,
            atmosphereStrength: 1.02 + seedC * 0.24,
            cloudSharpness: 1.08 + seedB * 0.10,
            cloudScale: 0.96 + seedA * 0.08,
            cloudOpacity: 0.82,
            riverStrength: 0.0,
            riverPattern: 0.0,
            riverDarkness: 1.0,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            gasEscapeIntensity: 0.0,
            surfaceGlowStrength: 1.10 + seedC * 0.30
        }
    }

    if (presetName === 'maximum') {
        return {
            cloudDensity: 1.08 + seedA * 0.35,
            cloudContrast: 1.45 + seedB * 0.35,
            atmosphereStrength: 1.26 + seedC * 0.45,
            cloudSharpness: 1.60 + seedB * 0.22,
            cloudScale: 1.35 + seedA * 0.22,
            cloudOpacity: 0.98,
            riverStrength: 0.0,
            riverPattern: 0.0,
            riverDarkness: 1.0,
            tornadoIntensity: 1.0,
            toxicTint: 1.0,
            mountainCoverage: 0.62,
            mountainHeight: 1.65,
            gasEscapeIntensity: 2.15,
            gasEscapeReach: 1.35,
            atmosphereScale: 1.26,
            lavaRiverTint: 1.0,
            lakeRedStrength: 1.0,
            surfaceGlowStrength: 0.0
        }
    }

    if (presetName === 'current galaxy') {
        return {
            cloudDensity: 0.42 + seedA * 0.12,
            cloudContrast: 1.30 + seedB * 0.28,
            atmosphereStrength: 0.88 + seedC * 0.32,
            cloudSharpness: 1.34 + seedB * 0.20,
            cloudScale: 0.74 + seedA * 0.10,
            cloudOpacity: 0.90,
            cloudMotionSpeed: 0.45,
            cloudBlackTint: 0.42,
            cloudLayerScale: 1.04,
            riverStrength: 2.35 + seedB * 0.55,
            riverPattern: 0.0,
            riverDarkness: 1.0,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            gasEscapeIntensity: 0.0,
            atmosphereScale: 1.08,
            mountainLakeIntensity: 0.78,
            mountainLakeDarkness: 1.45,
            surfaceGlowStrength: 0.0
        }
    }

    if (presetName === 'acid waves') {
        return {
            cloudDensity: 0.0,
            cloudContrast: 0.0,
            atmosphereStrength: 0.95 + seedC * 0.24,
            cloudSharpness: 1.0,
            cloudScale: 1.0,
            cloudOpacity: 0.0,
            riverStrength: 0.92 + seedB * 0.22,
            riverPattern: 0.42,
            riverDarkness: 1.25,
            tornadoIntensity: 0.0,
            toxicTint: 1.0,
            gasEscapeIntensity: 1.10 + seedC * 0.30,
            gasEscapeReach: 0.72 + seedA * 0.18,
            oceanStrength: 1.0,
            oceanPrimaryTint: 0.08,
            surfaceGlowStrength: 0.26 + seedC * 0.12,
            lavaRiverTint: 1.0,
            megaVolcanoIntensity: 1.0,
            mountainCoverage: 0.54,
            mountainHeight: 2.05,
            lakeRedStrength: 1.65
        }
    }

    if (presetName === 'ultra blast') {
        return {
            cloudDensity: 0.62 + seedA * 0.16,
            cloudContrast: 1.08 + seedB * 0.20,
            atmosphereStrength: 1.10 + seedC * 0.34,
            cloudSharpness: 1.34 + seedB * 0.16,
            cloudScale: 1.05 + seedA * 0.10,
            cloudOpacity: 0.78,
            riverStrength: 0.0,
            riverPattern: 0.0,
            riverDarkness: 1.0,
            tornadoIntensity: 0.72,
            toxicTint: 0.0,
            cloudMotionSpeed: 1.35,
            lightningIntensity: 1.18,
            gasEscapeIntensity: 0.0,
            surfaceGlowStrength: 0.0
        }
    }

    if (presetName === 'black hole') {
        return {
            cloudDensity: 0.0,
            cloudContrast: 0.0,
            atmosphereStrength: 0.82 + seedC * 0.20,
            cloudSharpness: 1.0,
            cloudScale: 1.0,
            cloudOpacity: 0.0,
            riverStrength: 0.0,
            riverPattern: 0.0,
            riverDarkness: 1.0,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            cloudMotionSpeed: 0.0,
            lightningIntensity: 0.0,
            gasEscapeIntensity: 0.0,
            gasEscapeReach: 0.0,
            atmosphereScale: 1.10,
            oceanStrength: 0.0,
            oceanPrimaryTint: 0.0,
            oceanGlowStrength: 0.0,
            oceanBrightness: 0.9,
            lakeGlowStrength: 0.0,
            lavaRiverTint: 0.0,
            megaVolcanoIntensity: 0.0,
            mountainCoverage: 0.35,
            mountainHeight: 0.65,
            sphereRotationSpeed: 0.0,
            surfaceGlowStrength: 0.0,
            blackHoleMode: 1.0
        }
    }

    if (presetName === 'black singularity') {
        return {
            cloudDensity: 0.0,
            cloudContrast: 0.0,
            atmosphereStrength: 0.92 + seedC * 0.20,
            cloudSharpness: 1.0,
            cloudScale: 1.0,
            cloudOpacity: 0.0,
            riverStrength: 0.0,
            riverPattern: 1.0,
            riverDarkness: 1.0,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            cloudMotionSpeed: 0.0,
            lightningIntensity: 0.0,
            gasEscapeIntensity: 0.16 + seedC * 0.08,
            gasEscapeReach: 0.10 + seedA * 0.06,
            atmosphereScale: 1.06,
            oceanStrength: 0.0,
            oceanPrimaryTint: 0.0,
            oceanGlowStrength: 0.0,
            oceanBrightness: 0.9,
            lakeGlowStrength: 0.0,
            lavaRiverTint: 0.0,
            megaVolcanoIntensity: 0.0,
            mountainCoverage: 0.35,
            mountainHeight: 0.65,
            sphereRotationSpeed: 0.0,
            surfaceGlowStrength: 0.0,
            blackHoleMode: 0.0,
            singularityMode: 1.0
        }
    }

    if (presetName === 'frozen ring') {
        return {
            // Epic winter look: sparse streaked clouds over bright frozen basins.
            cloudDensity: 0.34 + seedA * 0.18,
            cloudContrast: 1.26 + seedB * 0.30,
            atmosphereStrength: 1.12 + seedC * 0.38,
            cloudSharpness: 1.64 + seedB * 0.18,
            cloudScale: 1.56 + seedA * 0.22,
            cloudOpacity: 0.44,
            cloudMotionSpeed: 0.22,
            cloudBlackTint: 0.06,
            lightningIntensity: 0.0,
            riverStrength: 0.0,
            riverPattern: 0.0,
            riverDarkness: 1.0,
            tornadoIntensity: 0.0,
            toxicTint: 0.0,
            gasEscapeIntensity: 0.0,
            gasEscapeReach: 0.0,
            atmosphereScale: 1.16,
            mountainCoverage: 0.88,
            mountainHeight: 1.26,
            mountainLakeIntensity: 1.35,
            mountainLakeDarkness: 0.82,
            lakeRedStrength: 0.0,
            oceanStrength: 1.95,
            oceanPrimaryTint: 1.00,
            oceanGlowStrength: 2.05,
            oceanBrightness: 1.34,
            lakeGlowStrength: 2.35,
            sphereRotationSpeed: -0.02,
            surfaceGlowStrength: 0.22,
            lavaRiverTint: 0.0,
            megaVolcanoIntensity: 0.0
        }
    }

    return {
        cloudDensity: 0.82 + seedA * 0.50,
        cloudContrast: 0.80 + seedB * 0.55,
        atmosphereStrength: 0.72 + seedC * 0.55,
        cloudSharpness: 1.0,
        cloudScale: 1.0,
        cloudOpacity: 1.0,
        cloudMotionSpeed: 1.0,
        cloudBlackTint: 0.0,
        lightningIntensity: 0.0,
        riverStrength: 0.0,
        riverPattern: 0.0,
        riverDarkness: 1.0,
        tornadoIntensity: 0.0,
        toxicTint: 0.0,
        gasEscapeIntensity: 0.0,
        gasEscapeReach: 0.0,
        atmosphereScale: 1.0,
        mountainCoverage: 1.0,
        mountainHeight: 1.0,
        mountainLakeIntensity: 0.0,
        mountainLakeDarkness: 1.0,
        lakeRedStrength: 0.0,
        oceanStrength: 1.0,
        oceanPrimaryTint: 0.62,
        oceanGlowStrength: 0.0,
        oceanBrightness: 1.0,
        lakeGlowStrength: 0.0,
        sphereRotationSpeed: 0.0,
        surfaceGlowStrength: 0.0,
        lavaRiverTint: 0.0,
        megaVolcanoIntensity: 0.0
    }
}

const isCinematicPreset = (preset) => preset?.name?.toLowerCase() === 'cinematic'
const hasMountainContinents = (preset) => {
    const presetName = preset?.name?.toLowerCase() || ''
    return presetName === 'current galaxy' || presetName === 'binary system' || presetName === 'acid waves' || presetName === 'aqua dream'
}

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
    const hoverPositions = new Float32Array(parameters.count * 3)
    const colors = new Float32Array(parameters.count * 3)
    const hoverColors = new Float32Array(parameters.count * 3)
    const scales = new Float32Array(parameters.count)
    const hoverScales = new Float32Array(parameters.count)
    const randomness = new Float32Array(parameters.count * 3)
    const hoverRandomness = new Float32Array(parameters.count * 3)

    const currentPreset = presets?.[currentPresetIndex]
    const hoverGalaxy = currentPreset?.hover?.galaxy || {}
    const getHoverNumber = (key, fallback) => typeof hoverGalaxy[key] === 'number' ? hoverGalaxy[key] : fallback
    const getHoverColor = (key, fallback) => typeof hoverGalaxy[key] === 'string' ? hoverGalaxy[key] : fallback

    const baseBranches = Math.max(1, Math.round(parameters.branches))
    const baseRadiusForColor = parameters.radius || 1
    const hoverRadius = getHoverNumber('radius', parameters.radius)
    const hoverRadiusForColor = hoverRadius || 1
    const hoverBranches = Math.max(1, Math.round(getHoverNumber('branches', parameters.branches)))
    const hoverSpin = getHoverNumber('spin', parameters.spin)
    const hoverRandomnessAmount = getHoverNumber('randomness', parameters.randomness)
    const hoverRandomnessPower = getHoverNumber('randomnessPower', parameters.randomnessPower)
    const hoverSeed = getHoverNumber('seed', parameters.seed)
    const hasHoverSeed = typeof hoverGalaxy.seed === 'number'
    const colorInside = new THREE.Color(parameters.insideColor)
    const colorOutside = new THREE.Color(parameters.outsideColor)
    const hoverColorInside = new THREE.Color(getHoverColor('insideColor', parameters.insideColor))
    const hoverColorOutside = new THREE.Color(getHoverColor('outsideColor', parameters.outsideColor))

    // Simple seeded RNG to stabilize visuals across runs
    const createRand = (sourceSeed) => {
        let seed = typeof sourceSeed === 'number' ? sourceSeed >>> 0 : 1337;
        return () => {
            // xorshift32
            seed ^= seed << 13; seed >>>= 0;
            seed ^= seed >> 17; seed >>>= 0;
            seed ^= seed << 5;  seed >>>= 0;
            return (seed >>> 0) / 0xFFFFFFFF;
        }
    };
    const rand = createRand(parameters.seed)
    const hoverRand = createRand(hoverSeed)

    for(let i = 0; i < parameters.count; i++)
    {
        const i3 = i * 3

        // Position
        const radiusSeed = rand()
        const hoverRadiusSeed = hasHoverSeed ? hoverRand() : radiusSeed
        const radius = radiusSeed * parameters.radius
        const hoverParticleRadius = hoverRadiusSeed * hoverRadius

        const spinAngle = radius * parameters.spin
        const branchAngle = (i % baseBranches) / baseBranches * Math.PI * 2
        const hoverSpinAngle = hoverParticleRadius * hoverSpin
        const hoverBranchAngle = (i % hoverBranches) / hoverBranches * Math.PI * 2

        const randomXSeed = rand()
        const randomXSignSeed = rand()
        const randomYSeed = rand()
        const randomYSignSeed = rand()
        const randomZSeed = rand()
        const randomZSignSeed = rand()
        const hoverRandomXSeed = hasHoverSeed ? hoverRand() : randomXSeed
        const hoverRandomXSignSeed = hasHoverSeed ? hoverRand() : randomXSignSeed
        const hoverRandomYSeed = hasHoverSeed ? hoverRand() : randomYSeed
        const hoverRandomYSignSeed = hasHoverSeed ? hoverRand() : randomYSignSeed
        const hoverRandomZSeed = hasHoverSeed ? hoverRand() : randomZSeed
        const hoverRandomZSignSeed = hasHoverSeed ? hoverRand() : randomZSignSeed
        const randomXSign = randomXSignSeed < 0.5 ? 1 : - 1
        const randomYSign = randomYSignSeed < 0.5 ? 1 : - 1
        const randomZSign = randomZSignSeed < 0.5 ? 1 : - 1
        const hoverRandomXSign = hoverRandomXSignSeed < 0.5 ? 1 : - 1
        const hoverRandomYSign = hoverRandomYSignSeed < 0.5 ? 1 : - 1
        const hoverRandomZSign = hoverRandomZSignSeed < 0.5 ? 1 : - 1

        const randomX = Math.pow(randomXSeed, parameters.randomnessPower) * randomXSign * parameters.randomness * radius
        const randomY = Math.pow(randomYSeed, parameters.randomnessPower) * randomYSign * parameters.randomness * radius
        const randomZ = Math.pow(randomZSeed, parameters.randomnessPower) * randomZSign * parameters.randomness * radius

        const hoverRandomX = Math.pow(hoverRandomXSeed, hoverRandomnessPower) * hoverRandomXSign * hoverRandomnessAmount * hoverParticleRadius
        const hoverRandomY = Math.pow(hoverRandomYSeed, hoverRandomnessPower) * hoverRandomYSign * hoverRandomnessAmount * hoverParticleRadius
        const hoverRandomZ = Math.pow(hoverRandomZSeed, hoverRandomnessPower) * hoverRandomZSign * hoverRandomnessAmount * hoverParticleRadius

        positions[i3    ] = Math.cos(branchAngle + spinAngle) * radius
        positions[i3 + 1] = 0
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius
        hoverPositions[i3    ] = Math.cos(hoverBranchAngle + hoverSpinAngle) * hoverParticleRadius
        hoverPositions[i3 + 1] = 0
        hoverPositions[i3 + 2] = Math.sin(hoverBranchAngle + hoverSpinAngle) * hoverParticleRadius

        // Color
        const mixedColor = colorInside.clone()
        mixedColor.lerp(colorOutside, radius / baseRadiusForColor)
        const hoverMixedColor = hoverColorInside.clone()
        hoverMixedColor.lerp(hoverColorOutside, hoverParticleRadius / hoverRadiusForColor)

        colors[i3    ] = mixedColor.r
        colors[i3 + 1] = mixedColor.g
        colors[i3 + 2] = mixedColor.b
        hoverColors[i3    ] = hoverMixedColor.r
        hoverColors[i3 + 1] = hoverMixedColor.g
        hoverColors[i3 + 2] = hoverMixedColor.b

        // Scale
        const scaleSeed = rand()
        scales[i] = scaleSeed
        hoverScales[i] = hasHoverSeed ? hoverRand() : scaleSeed

        // Randomness
        randomness[i3    ] = randomX
        randomness[i3 + 1] = randomY
        randomness[i3 + 2] = randomZ
        hoverRandomness[i3    ] = hoverRandomX
        hoverRandomness[i3 + 1] = hoverRandomY
        hoverRandomness[i3 + 2] = hoverRandomZ
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aHoverPosition', new THREE.BufferAttribute(hoverPositions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aHoverColor', new THREE.BufferAttribute(hoverColors, 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geometry.setAttribute('aHoverScale', new THREE.BufferAttribute(hoverScales, 1))
    geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3))
    geometry.setAttribute('aHoverRandomness', new THREE.BufferAttribute(hoverRandomness, 3))

    /**
     * Material
     */
    material = new THREE.ShaderMaterial({
        depthWrite: false,
        depthTest: true,
        transparent: true,
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
            uNormalRotationSpeed: { value: parameters.normalRotationSpeed },
            uRotationOffset: { value: 0.0 },
            uGalaxyHoverMix: { value: galaxyHoverMix },
            uHoverSize: { value: (typeof hoverGalaxy.size === 'number' ? hoverGalaxy.size : 30) * renderer.getPixelRatio() },
            uHoverNormalRotationSpeed: { value: typeof hoverGalaxy.normalRotationSpeed === 'number' ? hoverGalaxy.normalRotationSpeed : parameters.normalRotationSpeed }
        }
    })

    /**
     * Points
     */
    points = new THREE.Points(geometry, material)
    points.renderOrder = 2
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

// Simple camera system for button hover effects and manual control handoff
let originalCameraPosition = { x: 3, y: 3, z: 3 }; // Default fallback
let targetCameraPosition = { x: 3, y: 3, z: 3 };
let cameraHoverMovementActive = false;
let cameraProgrammaticMoveActive = false;
let cameraTargetMode = 'fixed';
let cameraReturnPresetPosition = null;
let presetHoverActive = false;

// Controls
const controls = new OrbitControls(camera, document.body)
controls.enableDamping = true
controls.enabled = true // Enable OrbitControls for mouse interaction

let cameraUserInteracting = false
let cameraManualControlLocked = false
let presetAutoRotateEnabled = controls.autoRotate
let presetAutoRotateSpeed = controls.autoRotateSpeed || 0
let targetPresetAutoRotateSpeed = presetAutoRotateSpeed

const syncTargetCameraToCurrent = () => {
    targetCameraPosition = {
        x: camera.position.x,
        y: camera.position.y,
        z: camera.position.z
    }
}

const getPresetPositionAtCurrentAzimuth = (presetPosition) => {
    const presetRadius = Math.hypot(presetPosition.x, presetPosition.z)
    const currentRadius = Math.hypot(camera.position.x, camera.position.z)

    if (presetRadius <= 0 || currentRadius <= 0) {
        return { ...presetPosition }
    }

    const radiusScale = presetRadius / currentRadius
    return {
        x: camera.position.x * radiusScale,
        y: presetPosition.y,
        z: camera.position.z * radiusScale
    }
}

const markCameraInteraction = () => {
    if (cameraProgrammaticMoveActive) return

    cameraUserInteracting = true
    cameraManualControlLocked = true
    controls.autoRotate = false
    cameraHoverMovementActive = false
    syncTargetCameraToCurrent()
}

const markCameraInteractionEnd = () => {
    if (cameraProgrammaticMoveActive) return

    cameraUserInteracting = false
    controls.autoRotate = false
    syncTargetCameraToCurrent()
}

const isCameraManuallyActive = () => {
    return cameraUserInteracting || cameraManualControlLocked
}

controls.addEventListener('start', markCameraInteraction)
controls.addEventListener('end', markCameraInteractionEnd)

// Lock controls during hover decay to prevent camera shifts
let controlsDecayLockActive = false
let previousControlsEnabled = true
let previousAutoRotateState = controls.autoRotate
let previousAutoRotateSpeedState = controls.autoRotateSpeed || 0

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
parameters.normalRotationSpeed = 0.05
parameters.randomness = 0.2
parameters.randomnessPower = 3
parameters.insideColor = '#ff6030'
parameters.outsideColor = '#1b3984'
const defaultGalaxyParameters = { ...parameters }

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

const createGalaxySphere = () => {
    const sphereGeometry = new THREE.SphereGeometry(1.78, 640, 640)

    galaxySphereMaterial = new THREE.ShaderMaterial({
        depthWrite: true,
        depthTest: true,
        transparent: true,
        uniforms: {
            uTime: { value: 0 },
            uHover: { value: 0 },
            uPatternSeed: { value: getSpherePatternSeed() },
            uMarsSurface: { value: 0 },
            uMountainContinents: { value: 0 },
            uThemeMegaVolcanoIntensity: { value: 0.0 },
            uThemeRiverStrength: { value: 0 },
            uThemeRiverPattern: { value: 0 },
            uThemeRiverDarkness: { value: 1.0 },
            uThemeLavaRiverTint: { value: 0.0 },
            uThemeMountainCoverage: { value: 1.0 },
            uThemeMountainHeight: { value: 1.0 },
            uThemeMountainLakeIntensity: { value: 0.0 },
            uThemeMountainLakeDarkness: { value: 1.0 },
            uThemeLakeRedStrength: { value: 0.0 },
            uThemeOceanStrength: { value: 1.0 },
            uThemeOceanPrimaryTint: { value: 0.62 },
            uThemeOceanGlowStrength: { value: 0.0 },
            uThemeOceanBrightness: { value: 1.0 },
            uThemeLakeGlowStrength: { value: 0.0 },
            uThemeSurfaceGlowStrength: { value: 0 },
            uThemeBlackHoleMode: { value: 0 },
            uThemeSingularityMode: { value: 0 },
            uSunDirection: { value: getSunDirectionFromLocalTime() },
            uInsideColor: { value: new THREE.Color(parameters.insideColor) },
            uOutsideColor: { value: new THREE.Color(parameters.outsideColor) }
        },
        vertexShader: `
            uniform float uPatternSeed;
            uniform float uMountainContinents;
            uniform float uThemeMegaVolcanoIntensity;
            uniform float uThemeMountainCoverage;
            uniform float uThemeMountainHeight;

            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying vec3 vViewDirection;

            float hash(vec3 p) {
                p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            float ridgedFbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 5; i++) {
                    float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
                    value += n * amplitude;
                    p = p * 2.17 + vec3(3.1, 9.2, 5.7);
                    amplitude *= 0.5;
                }
                return value;
            }

            void main() {
                vec3 normalDirection = normalize(normal);
                vec3 seedOffset = vec3(uPatternSeed, uPatternSeed * 1.73, uPatternSeed * 2.41);
                float broadWarp = noise(normalDirection * 2.6 + seedOffset);
                float ridgeWarp = noise(normalDirection * 9.5 + seedOffset * 2.4);
                float continentWarpA = noise(normalDirection * 7.0 + seedOffset * 1.7) - 0.5;
                float continentWarpB = noise(normalDirection * 8.5 + seedOffset * 2.3 + vec3(11.0, 3.0, 7.0)) - 0.5;
                vec3 continentCenterA = normalize(vec3(
                    sin(uPatternSeed * 1.37 + 1.9),
                    cos(uPatternSeed * 1.91 + 0.4),
                    sin(uPatternSeed * 2.73 + 3.2)
                ));
                vec3 continentCenterB = normalize(vec3(
                    cos(uPatternSeed * 2.29 + 5.1),
                    sin(uPatternSeed * 1.61 + 2.7),
                    cos(uPatternSeed * 3.11 + 0.8)
                ));
                float mountainCoverage = clamp(uThemeMountainCoverage, 0.35, 1.6);
                float mountainHeight = clamp(uThemeMountainHeight, 0.65, 2.2);
                float continentEdgeA = 0.56 + (1.0 - mountainCoverage) * 0.15;
                float continentPeakA = 0.82 + (1.0 - mountainCoverage) * 0.12;
                float continentEdgeB = 0.58 + (1.0 - mountainCoverage) * 0.15;
                float continentPeakB = 0.84 + (1.0 - mountainCoverage) * 0.12;
                float continentA = smoothstep(continentEdgeA, continentPeakA, dot(normalDirection, continentCenterA) + continentWarpA * 0.34);
                float continentB = smoothstep(continentEdgeB, continentPeakB, dot(normalDirection, continentCenterB) + continentWarpB * 0.32);
                float mountainContinents = clamp(continentA + continentB, 0.0, 1.0) * uMountainContinents;
                float volcanicField = ridgedFbm(normalDirection * 11.5 + seedOffset * 4.8 + vec3(23.0, 5.0, 17.0)) * mountainContinents;
                float mountainMass = ridgedFbm(normalDirection * mix(18.0, 8.8, clamp(mountainHeight - 1.0, 0.0, 1.0)) + seedOffset * 2.8 + vec3(7.0, 3.0, 19.0)) * mountainContinents;
                vec3 megaVolcanoCenter = normalize(vec3(
                    sin(uPatternSeed * 3.71 + 0.63),
                    0.58 + cos(uPatternSeed * 2.17 + 1.11) * 0.18,
                    cos(uPatternSeed * 4.09 + 2.47)
                ));
                float megaVolcanoBase = smoothstep(0.76, 0.96, dot(normalDirection, megaVolcanoCenter));
                float megaVolcanoNoise = ridgedFbm(normalDirection * 20.0 + seedOffset * 7.4 + vec3(31.0, 9.0, 13.0));
                float megaVolcano = smoothstep(0.48, 0.86, megaVolcanoBase + megaVolcanoNoise * 0.28) * uThemeMegaVolcanoIntensity * mountainContinents;
                volcanicField = max(volcanicField, megaVolcano);
                float volcanoCone = smoothstep(0.70, 0.94, volcanicField);
                float volcanoCrater = smoothstep(0.91, 0.985, volcanicField);
                float volcanoTip = volcanoCone * (1.0 - volcanoCrater * 0.82);
                float displacement = ((broadWarp - 0.5) * 0.018 + (ridgeWarp - 0.5) * 0.006) * uMountainContinents;
                displacement += mountainMass * (0.010 + mountainHeight * 0.010);
                displacement += volcanoTip * (0.052 + mountainHeight * 0.014) - volcanoCrater * 0.032;
                vec3 displacedPosition = position + normalDirection * displacement;
                vec3 displacedNormal = normalize(normalDirection + normalDirection * displacement * 0.40);
                vec4 worldPosition = modelMatrix * vec4(displacedPosition, 1.0);
                vWorldPosition = worldPosition.xyz;
                vWorldNormal = normalize(mat3(modelMatrix) * displacedNormal);
                vViewDirection = normalize(cameraPosition - worldPosition.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uHover;
            uniform float uPatternSeed;
            uniform float uMarsSurface;
            uniform float uMountainContinents;
            uniform float uThemeMegaVolcanoIntensity;
            uniform float uThemeRiverStrength;
            uniform float uThemeRiverPattern;
            uniform float uThemeRiverDarkness;
            uniform float uThemeLavaRiverTint;
            uniform float uThemeMountainCoverage;
            uniform float uThemeMountainHeight;
            uniform float uThemeMountainLakeIntensity;
            uniform float uThemeMountainLakeDarkness;
            uniform float uThemeLakeRedStrength;
            uniform float uThemeOceanStrength;
            uniform float uThemeOceanPrimaryTint;
            uniform float uThemeOceanGlowStrength;
            uniform float uThemeOceanBrightness;
            uniform float uThemeLakeGlowStrength;
            uniform float uThemeSurfaceGlowStrength;
            uniform float uThemeBlackHoleMode;
            uniform float uThemeSingularityMode;
            uniform vec3 uSunDirection;
            uniform vec3 uInsideColor;
            uniform vec3 uOutsideColor;

            varying vec3 vWorldNormal;
            varying vec3 vWorldPosition;
            varying vec3 vViewDirection;

            float hash(vec3 p) {
                p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);

                return mix(
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 7; i++) {
                    value += amplitude * noise(p);
                    p = p * 2.03 + vec3(11.7, 4.2, 8.3);
                    amplitude *= 0.5;
                }
                return value;
            }

            float ridgedFbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 6; i++) {
                    float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
                    value += n * amplitude;
                    p = p * 2.17 + vec3(3.1, 9.2, 5.7);
                    amplitude *= 0.5;
                }
                return value;
            }

            float sphereAlpha(float radialDistance) {
                float edgeFade = smoothstep(0.50, 1.0, radialDistance);
                float alpha = mix(1.0, 0.22, edgeFade);
                alpha = mix(alpha, 0.12, smoothstep(0.94, 1.0, radialDistance));
                return alpha;
            }

            void main() {
                vec3 normal = normalize(vWorldNormal);
                vec3 viewDirection = normalize(vViewDirection);

                float ndv = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);
                float radialDistance = sqrt(max(0.0, 1.0 - ndv * ndv));
                float alpha = 1.0;

                vec3 deepSpace = vec3(0.006, 0.005, 0.012);
                vec3 baseTint = mix(uInsideColor, uOutsideColor, 0.45);
                vec3 mysteryBase = mix(deepSpace, baseTint, 0.46);
                vec3 themeGlow = mix(uInsideColor, uOutsideColor, smoothstep(-0.45, 0.75, normal.y));

                vec3 lightDirection = normalize(uSunDirection);

                float rawLight = dot(normal, lightDirection);
                float diffuse = clamp(rawLight * 0.5 + 0.5, 0.0, 1.0);
                diffuse = smoothstep(0.06, 0.92, diffuse);
                float terminator = smoothstep(-0.28, 0.42, rawLight);
                float rim = pow(1.0 - ndv, 2.6);
                float limbShadow = smoothstep(0.62, 1.0, radialDistance);
                float sphericalCore = 1.0 - smoothstep(0.0, 0.95, radialDistance);
                float specular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 54.0);
                float reflection = smoothstep(0.25, 0.95, dot(normal, normalize(vec3(-0.38, 0.58, 0.46))));
                vec3 seedOffset = vec3(uPatternSeed, uPatternSeed * 1.73, uPatternSeed * 2.41);
                float variantA = fract(sin(uPatternSeed * 12.9898) * 43758.5453);
                float variantB = fract(sin((uPatternSeed + 3.17) * 78.233) * 24634.6345);
                float variantC = fract(sin((uPatternSeed + 8.41) * 37.719) * 15731.7431);
                vec3 continentCenterA = normalize(vec3(
                    sin(uPatternSeed * 1.37 + 1.9),
                    cos(uPatternSeed * 1.91 + 0.4),
                    sin(uPatternSeed * 2.73 + 3.2)
                ));
                vec3 continentCenterB = normalize(vec3(
                    cos(uPatternSeed * 2.29 + 5.1),
                    sin(uPatternSeed * 1.61 + 2.7),
                    cos(uPatternSeed * 3.11 + 0.8)
                ));
                vec3 patternNormal = normalize(mix(normal, normal.zxy * vec3(1.0, -1.0, 1.0), variantA * 0.72));
                vec3 chaosNormal = normalize(mix(normal.yzx, normal.xzy * vec3(-1.0, 1.0, 1.0), variantB));
                vec3 texturePosition = patternNormal * (22.0 + variantA * 11.0) + seedOffset + vec3(0.0, uTime * 0.01, 0.0);
                float landScale = mix(1.75 + variantB * 1.35, 0.38 + variantB * 0.12, uMarsSurface);
                vec3 landPosition = chaosNormal * landScale + seedOffset * (1.15 + variantC * 0.7);
                float chaoticTexture = fbm(texturePosition);
                float microDetail = fbm(texturePosition * (14.0 + variantB * 5.0) + vec3(19.0, 3.0, 11.0));
                float ultraDetail = ridgedFbm(texturePosition * (30.0 + variantC * 10.0) + vec3(2.0, 17.0, 23.0));
                float nanoDetail = ridgedFbm(texturePosition * (68.0 + variantA * 18.0) + vec3(29.0, 7.0, 41.0));
                float picoDetail = fbm(texturePosition * (140.0 + variantB * 28.0) + vec3(71.0, 23.0, 13.0));
                float subPixelDetail = ridgedFbm(texturePosition * (260.0 + variantC * 34.0) + vec3(17.0, 89.0, 43.0));
                vec3 marsPosition = normalize(mix(normal, normal.zxy, variantC * 0.35)) * (4.8 + variantA * 1.4) + seedOffset * 1.9;
                float marsBasins = fbm(marsPosition * 0.58 + vec3(4.0, 9.0, 2.0));
                float marsRock = ridgedFbm(marsPosition * 1.35 + vec3(12.0, 3.0, 8.0));
                float marsDust = fbm(marsPosition * 2.45 + vec3(1.0, 17.0, 6.0));
                float craterSource = ridgedFbm(marsPosition * (2.6 + variantB * 0.8) + seedOffset * 2.4);
                float craterRim = smoothstep(0.68, 0.86, craterSource) * (1.0 - smoothstep(0.86, 0.96, craterSource));
                float craterDepression = smoothstep(0.78, 0.96, craterSource);
                vec3 continentWarp = vec3(
                    fbm(landPosition * 1.65 + vec3(8.0, 2.0, 5.0)),
                    fbm(landPosition * 1.45 + vec3(3.0, 11.0, 7.0)),
                    fbm(landPosition * 1.85 + vec3(13.0, 4.0, 2.0))
                ) - 0.5;
                vec3 continentPosition = landPosition + continentWarp * mix(0.22, 0.92, uMarsSurface);
                float landField = fbm(continentPosition);
                landField += fbm(continentPosition * mix(2.35 + variantA * 0.9, 0.82 + variantA * 0.16, uMarsSurface) + vec3(5.0, 13.0, 2.0)) * mix(0.42 + variantB * 0.18, 0.14 + variantB * 0.04, uMarsSurface);
                landField += ridgedFbm(continentPosition * mix(5.4 + variantC * 2.1, 1.55 + variantC * 0.32, uMarsSurface) + vec3(17.0, 3.0, 9.0)) * mix(0.16 + variantA * 0.10, 0.035 + variantA * 0.018, uMarsSurface);
                float continentWarpA = fbm(normal * 7.0 + seedOffset * 1.7) - 0.5;
                float continentWarpB = fbm(normal * 8.5 + seedOffset * 2.3 + vec3(11.0, 3.0, 7.0)) - 0.5;
                float mountainCoverage = clamp(uThemeMountainCoverage, 0.35, 1.6);
                float mountainHeight = clamp(uThemeMountainHeight, 0.65, 2.2);
                float continentEdgeA = 0.56 + (1.0 - mountainCoverage) * 0.15;
                float continentPeakA = 0.82 + (1.0 - mountainCoverage) * 0.12;
                float continentEdgeB = 0.58 + (1.0 - mountainCoverage) * 0.15;
                float continentPeakB = 0.84 + (1.0 - mountainCoverage) * 0.12;
                float continentA = smoothstep(continentEdgeA, continentPeakA, dot(normal, continentCenterA) + continentWarpA * 0.34);
                float continentB = smoothstep(continentEdgeB, continentPeakB, dot(normal, continentCenterB) + continentWarpB * 0.32);
                float mountainContinents = clamp(continentA + continentB, 0.0, 1.0) * uMountainContinents;
                float mountainRidgeScale = mix(24.0, 10.5, clamp(mountainHeight - 1.0, 0.0, 1.0));
                float mountainRidges = ridgedFbm(normal * mountainRidgeScale + seedOffset * 3.1) * mountainContinents;
                float volcanicField = ridgedFbm(normal * 11.5 + seedOffset * 4.8 + vec3(23.0, 5.0, 17.0)) * mountainContinents;
                float mountainLakeMacroField = fbm(normal * 14.5 + seedOffset * 5.1 + vec3(27.0, 2.0, 15.0));
                float mountainLakeMacroBreakup = ridgedFbm(normal * 20.0 + seedOffset * 7.4 + vec3(8.0, 19.0, 4.0));
                float mountainLakeMacroMask = smoothstep(0.80, 0.95, mountainLakeMacroField + mountainLakeMacroBreakup * 0.14);
                float mountainLakeMicroField = fbm(normal * 48.0 + seedOffset * 9.2 + vec3(11.0, 31.0, 17.0));
                float mountainLakeMicroBreakup = ridgedFbm(normal * 66.0 + seedOffset * 10.1 + vec3(33.0, 7.0, 24.0));
                float mountainLakeMicroMask = smoothstep(0.90, 0.985, mountainLakeMicroField + mountainLakeMicroBreakup * 0.08) * 0.62;
                float mountainLakeBasinMask = smoothstep(0.10, 0.84, 1.0 - mountainRidges) * smoothstep(0.35, 0.92, mountainContinents);
                float mountainLakeMask = clamp(mountainLakeMacroMask + mountainLakeMicroMask, 0.0, 1.0);
                mountainLakeMask *= mountainLakeBasinMask * (1.0 - uMarsSurface) * clamp(uThemeMountainLakeIntensity, 0.0, 1.0);
                vec3 megaVolcanoCenter = normalize(vec3(
                    sin(uPatternSeed * 3.71 + 0.63),
                    0.58 + cos(uPatternSeed * 2.17 + 1.11) * 0.18,
                    cos(uPatternSeed * 4.09 + 2.47)
                ));
                float megaVolcanoBase = smoothstep(0.76, 0.96, dot(normal, megaVolcanoCenter));
                float megaVolcanoNoise = ridgedFbm(normal * 20.0 + seedOffset * 7.4 + vec3(31.0, 9.0, 13.0));
                float megaVolcano = smoothstep(0.48, 0.86, megaVolcanoBase + megaVolcanoNoise * 0.28) * uThemeMegaVolcanoIntensity * mountainContinents;
                volcanicField = max(volcanicField, megaVolcano);
                float volcanoCones = smoothstep(0.72, 0.93, volcanicField);
                float volcanoRims = smoothstep(0.78, 0.91, volcanicField) * (1.0 - smoothstep(0.91, 0.985, volcanicField));
                float volcanoCraters = smoothstep(0.90, 0.985, volcanicField);
                float volcanoLightSide = smoothstep(0.12, 0.82, dot(normal, normalize(lightDirection + vec3(0.24, 0.10, -0.18))));
                float volcanoShadow = volcanoCones * (1.0 - volcanoLightSide) * uMountainContinents;
                landField += mountainContinents * (0.36 + mountainHeight * 0.26) + mountainRidges * (0.24 + mountainHeight * 0.24);
                float landThreshold = mix(0.56 + variantA * 0.14, 0.34 + variantA * 0.04, uMarsSurface);
                float landMask = smoothstep(landThreshold, landThreshold + mix(0.07, 0.13, uMarsSurface), landField);
                landMask = clamp(landMask + mountainContinents * 0.82, 0.0, 1.0);
                float coastline = smoothstep(landThreshold - 0.022, landThreshold + 0.018, landField) *
                                  (1.0 - smoothstep(landThreshold + 0.018, landThreshold + 0.085, landField));
                float riverSeed = ridgedFbm(normal * 44.0 + seedOffset * 6.3 + vec3(13.0, 29.0, 7.0));
                float riverChannel = 1.0 - smoothstep(0.07, 0.25, riverSeed);
                float riverBranchField = fbm(normal * 80.0 + seedOffset * 8.1 + vec3(41.0, 3.0, 19.0));
                float riverBranches = smoothstep(0.30, 0.84, riverBranchField);
                float riverGlobalField = ridgedFbm(normal * 18.0 + seedOffset * 4.4 + vec3(5.0, 37.0, 11.0));
                float globeRiverBands = 1.0 - smoothstep(0.14, 0.34, riverGlobalField);
                float longitude = atan(normal.z, normal.x);
                float latitude = asin(clamp(normal.y, -1.0, 1.0));
                float riverMeander = sin(longitude * 1.55 + latitude * 7.8 + fbm(normal * 13.0 + seedOffset * 2.1) * 5.2 + uTime * 0.12);
                float riverTrunk = 1.0 - smoothstep(0.05, 0.17, abs(riverMeander));
                float branchNoise = fbm(normal * 45.0 + seedOffset * 5.2 + vec3(9.0, 25.0, 14.0));
                float riverPatternMask = riverTrunk * smoothstep(0.24, 0.86, branchNoise);
                float riverMask = clamp((riverChannel * riverBranches * 0.72) + (globeRiverBands * 0.62), 0.0, 1.0);
                riverMask = mix(riverMask, riverPatternMask, clamp(uThemeRiverPattern, 0.0, 1.0));
                riverMask *= (1.0 - mountainContinents * 0.12) * (1.0 - uMarsSurface) * uThemeRiverStrength;
                float lakeMegaField = fbm(normal * 4.8 + seedOffset * 3.4 + vec3(2.0, 17.0, 23.0));
                float lakeMegaBreakup = ridgedFbm(normal * 8.2 + seedOffset * 4.8 + vec3(19.0, 7.0, 3.0));
                float lakeMegaMask = smoothstep(0.80, 0.95, lakeMegaField + lakeMegaBreakup * 0.16);
                float lakeSecondaryField = fbm(normal * 6.2 + seedOffset * 5.2 + vec3(11.0, 29.0, 13.0));
                float lakeSecondaryMask = smoothstep(0.84, 0.97, lakeSecondaryField) * 0.44;
                float lavaLakeMask = clamp(lakeMegaMask + lakeSecondaryMask, 0.0, 1.0);
                lavaLakeMask *= landMask * (1.0 - uMarsSurface) * clamp(uThemeLavaRiverTint, 0.0, 1.0);
                riverMask = clamp(riverMask + lavaLakeMask * 0.75, 0.0, 1.0);
                float oceanField = fbm(normal * (1.45 + variantB * 0.35) + seedOffset * 0.62 + vec3(31.0, 7.0, 15.0));
                float oceanMask = smoothstep(0.42, 0.68, oceanField) * (1.0 - landMask);
                oceanMask = clamp(oceanMask * 0.86 * uThemeOceanStrength, 0.0, 1.0) * (1.0 - uMarsSurface);
                float cracks = smoothstep(0.50, 0.72, ridgedFbm(texturePosition * (3.2 + variantB * 2.5) + chaoticTexture * 2.6 + seedOffset));
                float smokyVeins = smoothstep(0.32, 0.82, fbm(texturePosition * mix(1.8 + variantC * 1.7, 1.05 + variantC * 0.35, uMarsSurface) + vec3(7.0, 2.0, 4.0) + seedOffset));
                float surfaceVariation = mix(0.72, 1.24, chaoticTexture * 0.32 + microDetail * 0.25 + ultraDetail * 0.17 + nanoDetail * 0.11 + picoDetail * 0.07 + subPixelDetail * 0.04 + landField * 0.08);
                surfaceVariation = mix(surfaceVariation, mix(0.58, 1.36, marsBasins * 0.34 + marsRock * 0.34 + marsDust * 0.22 + microDetail * 0.10), uMarsSurface);
                float terrainRelief = (ultraDetail - 0.5) * (0.07 + landMask * 0.14) + (nanoDetail - 0.5) * 0.055 + (subPixelDetail - 0.5) * 0.025 + mountainRidges * (0.14 + 0.14 * mountainHeight) + volcanoRims * 0.18 - volcanoCraters * 0.12;
                terrainRelief = mix(terrainRelief, (marsRock - 0.5) * 0.14 + craterRim * 0.12 - craterDepression * 0.18, uMarsSurface);
                float localClouds = smoothstep(0.55, 0.86, fbm(texturePosition * (2.0 + variantC * 1.5) + vec3(4.0, 9.0, 12.0)));
                localClouds *= 1.0 - smoothstep(0.7, 1.0, radialDistance);
                vec3 windDirection = normalize(vec3(0.68 + variantA * 0.24, 0.18 + variantB * 0.18, -0.52 + variantC * 0.20));
                vec3 cloudNormal = normalize(normal + windDirection * 0.18);
                vec3 upperCloudPosition = cloudNormal * (2.4 + variantA * 0.45) + seedOffset * 0.42 + windDirection * uTime * 0.018;
                vec3 upperCloudWarp = vec3(
                    fbm(upperCloudPosition * 1.35 + vec3(12.0, 4.0, 8.0)),
                    fbm(upperCloudPosition * 1.18 + vec3(3.0, 16.0, 5.0)),
                    fbm(upperCloudPosition * 1.52 + vec3(9.0, 7.0, 19.0))
                ) - 0.5;
                vec3 cloudFieldPosition = upperCloudPosition + upperCloudWarp * 0.85;
                float upperCloudLarge = fbm(cloudFieldPosition + vec3(17.0, 4.0, 9.0));
                float upperCloudBreakup = fbm(cloudFieldPosition * 2.7 + vec3(2.0, 21.0, 6.0));
                float upperCloudWisps = fbm(cloudFieldPosition * 7.4 + windDirection * 2.0);
                float upperCloudLayer = smoothstep(0.56, 0.78, upperCloudLarge + upperCloudBreakup * 0.34 - upperCloudWisps * 0.18);
                upperCloudLayer *= smoothstep(0.18, 0.72, upperCloudBreakup);
                upperCloudLayer *= 1.0 - smoothstep(0.72, 1.0, radialDistance);
                upperCloudLayer *= mix(0.78, 0.18, uMarsSurface);
                float cityGrid = fbm(normal * 128.0 + seedOffset * 5.7);
                float cityClusters = fbm(normal * 24.0 + seedOffset * 4.3 + vec3(5.0, 19.0, 31.0));
                float cityPinpoints = smoothstep(0.925, 0.992, cityGrid) * smoothstep(0.48, 0.84, cityClusters);
                float nightSide = 1.0 - smoothstep(0.18, 0.72, diffuse);
                float cityLights = cityPinpoints * landMask * (0.35 + mountainContinents * 0.65) * nightSide * uMountainContinents;

                vec3 color = mysteryBase;
                color += themeGlow * (0.10 + 0.28 * diffuse);
                color += uInsideColor * reflection * (0.05 + 0.10 * uHover);
                color = mix(color, color + mix(uInsideColor, uOutsideColor, 0.30) * 0.24, landMask);
                float oceanDepth = smoothstep(0.30, 0.86, oceanField) * oceanMask;
                vec3 deepOceanColor = mix(
                    vec3(0.0005, 0.006, 0.020),
                    mix(uOutsideColor * 0.10, uOutsideColor * 0.36, clamp(uThemeOceanPrimaryTint, 0.0, 1.0)),
                    0.28
                );
                vec3 oceanColor = mix(
                    mix(
                        vec3(0.0015, 0.026, 0.060),
                        mix(uOutsideColor, vec3(0.012, 0.11, 0.24), mix(0.42, 0.16, clamp(uThemeOceanPrimaryTint, 0.0, 1.0))),
                        0.40
                    ),
                    deepOceanColor,
                    oceanDepth * 0.92
                );
                float oceanPrimaryTint = clamp(uThemeOceanPrimaryTint, 0.0, 1.0);
                vec3 oceanPrimaryColor = mix(uOutsideColor * 0.46, uOutsideColor * 0.88 + vec3(0.02, 0.08, 0.14), diffuse);
                oceanColor = mix(oceanColor, oceanPrimaryColor, oceanMask * oceanPrimaryTint * 0.82);
                oceanColor *= clamp(uThemeOceanBrightness, 0.85, 1.8);
                color = mix(color, oceanColor, oceanMask * 0.88);
                color += uOutsideColor * oceanMask * oceanPrimaryTint * (0.12 + 0.20 * diffuse);
                float lakeGlowLarge = fbm(normal * 12.0 + seedOffset * 4.2 + vec3(6.0, 13.0, 22.0));
                float lakeGlowMedium = fbm(normal * 24.0 + seedOffset * 6.9 + vec3(17.0, 5.0, 31.0));
                float lakeGlowSpark = ridgedFbm(normal * 38.0 + seedOffset * 8.8 + vec3(3.0, 21.0, 11.0));
                float lakeGlowClusters = smoothstep(0.56, 0.82, lakeGlowLarge) * 0.72
                    + smoothstep(0.62, 0.90, lakeGlowMedium) * 0.48
                    + smoothstep(0.54, 0.86, lakeGlowSpark) * 0.34;
                float lakeGlowRim = smoothstep(0.12, 0.88, 1.0 - oceanDepth);
                float lakeGlowMask = clamp(lakeGlowClusters, 0.0, 1.0) * lakeGlowRim * smoothstep(0.12, 0.92, oceanMask) * (1.0 - landMask);
                vec3 lakeGlowColor = mix(uOutsideColor, vec3(1.0), 0.22);
                color += lakeGlowColor * lakeGlowMask * uThemeLakeGlowStrength * (0.55 + specular * 0.85 + diffuse * 0.42);
                color += uOutsideColor * oceanMask * clamp(uThemeOceanGlowStrength, 0.0, 3.0) * (0.20 + diffuse * 0.22 + specular * 0.30);
                color += mix(vec3(0.06, 0.28, 0.46), vec3(0.56, 0.86, 0.96), diffuse) * oceanMask * specular * (0.20 + (1.0 - oceanDepth) * 0.14);
                vec3 waterRiverDark = mix(vec3(0.001, 0.010, 0.065), uOutsideColor * 0.28, 0.24) / uThemeRiverDarkness;
                vec3 waterRiverBright = mix(vec3(0.20, 0.66, 1.0), vec3(0.82, 0.97, 1.0), diffuse);
                vec3 lavaRiverDark = mix(vec3(0.17, 0.01, 0.0), vec3(0.30, 0.03, 0.0), diffuse) / max(0.75, uThemeRiverDarkness * 0.8);
                vec3 lavaRiverBright = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.78, 0.10), diffuse);
                vec3 riverDark = mix(waterRiverDark, lavaRiverDark, clamp(uThemeLavaRiverTint, 0.0, 1.0));
                vec3 riverBright = mix(waterRiverBright, lavaRiverBright, clamp(uThemeLavaRiverTint, 0.0, 1.0));
                float riverFinalMask = clamp(riverMask * 1.35, 0.0, 1.0);
                float lavaLakeGlow = lavaLakeMask * clamp(uThemeLavaRiverTint, 0.0, 1.0);
                float lakeRedStrength = clamp(uThemeLakeRedStrength, 0.0, 2.0);
                vec3 toxicLakeRed = mix(vec3(0.95, 0.02, 0.01), vec3(1.0, 0.20, 0.05), diffuse);
                vec3 lavaLakeColor = mix(lavaRiverBright, toxicLakeRed, clamp(lakeRedStrength * 0.85, 0.0, 1.0));
                color = mix(color, riverDark, riverFinalMask * 0.72);
                color += riverBright * riverFinalMask * (0.34 + diffuse * 0.40);
                color += lavaLakeColor * lavaLakeGlow * (0.34 + diffuse * 0.40 + lakeRedStrength * 0.32);
                color += mix(uOutsideColor, vec3(1.0), 0.22) * coastline * 0.18;
                vec3 mountainTone = mix(uInsideColor, vec3(1.0), 0.38);
                color = mix(color, mountainTone, mountainContinents * smoothstep(0.34, 0.92, mountainRidges) * (0.38 + 0.30 * mountainHeight));
                color += mountainTone * mountainRidges * mountainContinents * (0.08 + 0.14 * mountainHeight);
                vec3 volcanicTone = mix(uOutsideColor, vec3(0.02, 0.01, 0.006), 0.62);
                color = mix(color, volcanicTone, volcanoShadow * 0.68);
                color += mix(uInsideColor, vec3(1.0, 0.46, 0.12), 0.28) * volcanoRims * volcanoLightSide * 0.16;
                vec3 mountainLakeColor = mix(vec3(0.001, 0.003, 0.010), vec3(0.008, 0.016, 0.032), diffuse);
                mountainLakeColor /= max(1.0, uThemeMountainLakeDarkness);
                color = mix(color, mountainLakeColor, mountainLakeMask * 0.86);
                color += mountainLakeColor * mountainLakeMask * (0.05 + specular * 0.08);
                vec3 marsBase = mix(deepSpace, mix(uInsideColor, uOutsideColor, 0.42), 0.64);
                vec3 marsHighlands = mix(uInsideColor, vec3(1.0), 0.18);
                vec3 marsLowlands = mix(uOutsideColor, deepSpace, 0.36);
                vec3 marsColor = mix(marsLowlands, marsBase, marsBasins);
                marsColor = mix(marsColor, marsHighlands, smoothstep(0.48, 0.88, marsRock) * 0.52);
                marsColor += mix(uInsideColor, uOutsideColor, 0.56) * (marsDust - 0.5) * 0.22;
                marsColor = mix(marsColor, marsLowlands * 0.72, (1.0 - landMask) * 0.20);
                marsColor = mix(marsColor, mix(uInsideColor, uOutsideColor, 0.16), landMask * 0.84);
                marsColor += mix(uOutsideColor, vec3(1.0), 0.18) * coastline * 0.34;
                marsColor += mix(uOutsideColor, vec3(1.0), 0.22) * craterRim * 0.18;
                marsColor *= 1.0 - craterDepression * 0.28;
                color = mix(color, marsColor, uMarsSurface);
                vec3 craterBlack = vec3(0.002, 0.001, 0.0005);
                color = mix(color, craterBlack, volcanoCraters * uMountainContinents * 0.92);
                color += mix(vec3(1.0, 0.34, 0.04), vec3(1.0, 0.78, 0.22), volcanoLightSide) * volcanoRims * uMountainContinents * 0.22;
                color += mix(uInsideColor, uOutsideColor, 0.68) * smokyVeins * mix(0.10, 0.025, uMarsSurface);
                color += mix(uOutsideColor, uInsideColor, 0.25) * (microDetail - 0.5) * 0.08;
                color += mix(uInsideColor, vec3(1.0), 0.18) * terrainRelief * 1.18;
                color += mix(vec3(1.0, 0.55, 0.08), vec3(1.0, 0.88, 0.34), cityClusters) * cityLights * 2.85;
                float surfaceGlowMask = smoothstep(0.44, 0.90, landMask + coastline * 0.95 + (1.0 - landMask) * 0.48);
                surfaceGlowMask *= smoothstep(0.08, 0.96, diffuse);
                vec3 surfaceGlowColor = mix(uInsideColor, uOutsideColor, 0.58);
                color += surfaceGlowColor * surfaceGlowMask * uThemeSurfaceGlowStrength * 0.56;
                color *= 1.0 - (cracks * mix(0.14 + landMask * 0.12, 0.08, uMarsSurface));
                color += uOutsideColor * rim * (0.08 + 0.22 * uHover);
                color += mix(uInsideColor, vec3(1.0), 0.45) * specular * (0.05 + 0.18 * uHover);
                color *= surfaceVariation;
                color *= mix(0.24, 1.0, terminator);
                color *= 0.78 + (0.22 * sphericalCore);
                color *= 1.0 - (0.38 * limbShadow);
                color += themeGlow * (0.10 * uHover);
                color = mix(color, riverDark, riverFinalMask * 0.82);
                color += riverBright * riverFinalMask * (0.42 + diffuse * 0.44);
                color += surfaceGlowColor * surfaceGlowMask * uThemeSurfaceGlowStrength * 0.72;
                color += lakeGlowColor * lakeGlowMask * uThemeLakeGlowStrength * (0.34 + specular * 0.42);
                if (uThemeBlackHoleMode > 0.5) {
                    color = vec3(0.0, 0.0, 0.0);
                    alpha = 1.0;
                }
                if (uThemeSingularityMode > 0.5) {
                    color = vec3(0.0, 0.0, 0.0);
                    alpha = 1.0;
                }
                gl_FragColor = vec4(color, alpha);
            }
        `
    })

    galaxySphere = new THREE.Mesh(sphereGeometry, galaxySphereMaterial)
    galaxySphere.renderOrder = 1
    galaxySphere.scale.setScalar(sphereState.scale * sphereState.presetScale)
    scene.add(galaxySphere)

    const cloudGeometry = new THREE.SphereGeometry(1.84, 320, 320)
    galaxyCloudMaterial = new THREE.ShaderMaterial({
        depthWrite: false,
        depthTest: true,
        transparent: true,
        blending: THREE.NormalBlending,
        uniforms: {
            uTime: { value: 0 },
            uHover: { value: 0 },
            uPatternSeed: { value: getSpherePatternSeed() },
            uMarsSurface: { value: 0 },
            uThemeCloudDensity: { value: 1.0 },
            uThemeCloudContrast: { value: 1.0 },
            uThemeCloudSharpness: { value: 1.0 },
            uThemeCloudScale: { value: 1.0 },
            uThemeCloudOpacity: { value: 1.0 },
            uThemeCloudBlackTint: { value: 0.0 },
            uThemeTornadoIntensity: { value: 0.0 },
            uThemeToxicTint: { value: 0.0 },
            uThemeCloudMotionSpeed: { value: 1.0 },
            uThemeLightningIntensity: { value: 0.0 },
            uSunDirection: { value: getSunDirectionFromLocalTime() },
            uInsideColor: { value: new THREE.Color(parameters.insideColor) },
            uOutsideColor: { value: new THREE.Color(parameters.outsideColor) }
        },
        vertexShader: `
            varying vec3 vWorldNormal;
            varying vec3 vViewDirection;

            void main() {
                vec3 normalDirection = normalize(normal);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldNormal = normalize(mat3(modelMatrix) * normalDirection);
                vViewDirection = normalize(cameraPosition - worldPosition.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uPatternSeed;
            uniform float uMarsSurface;
            uniform float uThemeCloudDensity;
            uniform float uThemeCloudContrast;
            uniform float uThemeCloudSharpness;
            uniform float uThemeCloudScale;
            uniform float uThemeCloudOpacity;
            uniform float uThemeCloudBlackTint;
            uniform float uThemeTornadoIntensity;
            uniform float uThemeToxicTint;
            uniform float uThemeCloudMotionSpeed;
            uniform float uThemeLightningIntensity;
            uniform vec3 uSunDirection;
            uniform vec3 uInsideColor;
            uniform vec3 uOutsideColor;

            varying vec3 vWorldNormal;
            varying vec3 vViewDirection;

            float hash(vec3 p) {
                p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 6; i++) {
                    value += amplitude * noise(p);
                    p = p * 2.03 + vec3(11.7, 4.2, 8.3);
                    amplitude *= 0.5;
                }
                return value;
            }

            void main() {
                vec3 normal = normalize(vWorldNormal);
                vec3 viewDirection = normalize(vViewDirection);
                float ndv = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);
                float radialDistance = sqrt(max(0.0, 1.0 - ndv * ndv));
                vec3 lightDirection = normalize(uSunDirection);
                float rawLight = dot(normal, lightDirection);
                float diffuse = smoothstep(0.04, 0.95, clamp(rawLight * 0.5 + 0.5, 0.0, 1.0));
                float nightSide = 1.0 - smoothstep(-0.05, 0.35, rawLight);
                float terminator = smoothstep(-0.18, 0.32, rawLight);
                vec3 seedOffset = vec3(uPatternSeed, uPatternSeed * 1.73, uPatternSeed * 2.41);
                float variantA = fract(sin(uPatternSeed * 12.9898) * 43758.5453);
                float variantB = fract(sin((uPatternSeed + 3.17) * 78.233) * 24634.6345);
                float variantC = fract(sin((uPatternSeed + 8.41) * 37.719) * 15731.7431);
                float cloudScale = uThemeCloudScale;
                float stormTime = uTime * max(uThemeCloudMotionSpeed, 0.1);
                vec3 windDirection = normalize(vec3(0.68 + variantA * 0.24, 0.18 + variantB * 0.18, -0.52 + variantC * 0.20));
                vec3 crossWindDirection = normalize(vec3(-windDirection.z, 0.28 + variantA * 0.14, windDirection.x));
                vec3 cloudNormal = normalize(normal + windDirection * 0.18);
                float cloudTwistAngle = stormTime * 0.06;
                mat2 cloudTwist = mat2(cos(cloudTwistAngle), -sin(cloudTwistAngle), sin(cloudTwistAngle), cos(cloudTwistAngle));
                cloudNormal.xz = cloudTwist * cloudNormal.xz;
                vec3 driftPrimary = windDirection * stormTime * 0.012;
                vec3 driftSecondary = crossWindDirection * stormTime * 0.008;
                vec3 upperCloudPosition = cloudNormal * (2.4 + variantA * 0.45) * cloudScale + seedOffset * 0.42 + driftPrimary;
                vec3 upperCloudWarp = vec3(
                    fbm(upperCloudPosition * (1.35 * cloudScale) + vec3(12.0, 4.0, 8.0)),
                    fbm(upperCloudPosition * (1.18 * cloudScale) + vec3(3.0, 16.0, 5.0)),
                    fbm(upperCloudPosition * (1.52 * cloudScale) + vec3(9.0, 7.0, 19.0))
                ) - 0.5;
                vec3 cloudFieldPosition = upperCloudPosition + upperCloudWarp * 0.85;
                float upperCloudLarge = fbm(cloudFieldPosition + vec3(17.0, 4.0, 9.0));
                float upperCloudBreakup = fbm(cloudFieldPosition * (2.7 * cloudScale) + vec3(2.0, 21.0, 6.0) + driftSecondary * 1.6);
                float upperCloudWisps = fbm(cloudFieldPosition * (7.4 * cloudScale) + windDirection * 2.0 + driftPrimary * 2.4 - driftSecondary * 1.1);
                float cloudBillows = fbm(cloudFieldPosition * (1.75 * cloudScale) + vec3(6.0, 12.0, 3.0) + driftSecondary * 0.8);
                float cloudVeins = fbm(cloudFieldPosition * (11.2 * cloudScale) + vec3(3.0, 8.0, 22.0));
                float densityBoost = uThemeCloudDensity;
                float contrastBoost = uThemeCloudContrast;
                float sharpness = uThemeCloudSharpness;
                float tornadoIntensity = uThemeTornadoIntensity;
                float stormTurbulence = (fbm(cloudFieldPosition * (3.2 * cloudScale) + vec3(stormTime * 0.35, -stormTime * 0.24, stormTime * 0.30)) - 0.5) * tornadoIntensity;
                cloudFieldPosition += vec3(stormTurbulence * 0.32, stormTurbulence * 0.18, stormTurbulence * 0.28);
                float denseCloudLayer = smoothstep(0.50, mix(0.74, 0.66, clamp(sharpness - 1.0, 0.0, 1.0)), upperCloudLarge + upperCloudBreakup * (0.52 * densityBoost) + cloudBillows * 0.26 - upperCloudWisps * 0.10);
                denseCloudLayer *= smoothstep(0.10, mix(0.82, 0.64, clamp(sharpness - 1.0, 0.0, 1.0)), upperCloudBreakup + cloudBillows * 0.24);
                denseCloudLayer += cloudVeins * denseCloudLayer * (0.20 * contrastBoost);
                denseCloudLayer = clamp(denseCloudLayer, 0.0, 1.0);
                float midCloudLayer = smoothstep(0.58, mix(0.80, 0.70, clamp(sharpness - 1.0, 0.0, 1.0)), upperCloudLarge * 0.82 + cloudBillows * (0.36 * densityBoost) + upperCloudWisps * 0.14);
                float darkCloudLayer = smoothstep(0.62, mix(0.88, 0.76, clamp(sharpness - 1.0, 0.0, 1.0)), upperCloudBreakup * (0.96 * contrastBoost) + upperCloudWisps * 0.42 - cloudBillows * 0.10);
                darkCloudLayer *= smoothstep(0.24, mix(0.88, 0.72, clamp(sharpness - 1.0, 0.0, 1.0)), upperCloudBreakup);
                float tornadoAngle = atan(cloudFieldPosition.z, cloudFieldPosition.x);
                float tornadoRadius = length(cloudFieldPosition.xz);
                float tornadoSpiral = sin(tornadoAngle * 8.0 - stormTime * 2.3 + tornadoRadius * 22.0 + cloudFieldPosition.y * 9.0) * 0.5 + 0.5;
                float tornadoBands = smoothstep(0.48, 0.92, tornadoSpiral) * smoothstep(0.18, 0.88, upperCloudBreakup);
                darkCloudLayer = clamp(mix(darkCloudLayer, max(darkCloudLayer, tornadoBands), tornadoIntensity), 0.0, 1.0);
                denseCloudLayer = clamp(mix(denseCloudLayer, denseCloudLayer * (1.0 - tornadoBands * 0.18), tornadoIntensity), 0.0, 1.0);
                float cloudCoverage = clamp(denseCloudLayer * (0.70 * densityBoost) + midCloudLayer * 0.42 + darkCloudLayer * (0.34 * contrastBoost), 0.0, 1.0);
                cloudCoverage *= 1.0 - smoothstep(0.965, 1.0, radialDistance);
                cloudCoverage *= mix(0.82, 0.22, uMarsSurface);

                vec3 atmosphereBaseColor = mix(uInsideColor, uOutsideColor, 0.58);
                vec3 brightCloudColor = mix(vec3(1.0), atmosphereBaseColor, 0.05);
                vec3 midCloudColor = mix(vec3(0.92, 0.95, 1.0), atmosphereBaseColor, 0.20);
                vec3 darkCloudColor = mix(vec3(0.62, 0.70, 0.82), atmosphereBaseColor, 0.34);
                vec3 toxicBright = vec3(0.76, 1.0, 0.22);
                vec3 toxicMid = vec3(0.42, 0.94, 0.16);
                vec3 toxicDark = vec3(0.10, 0.36, 0.05);
                brightCloudColor = mix(brightCloudColor, toxicBright, uThemeToxicTint);
                midCloudColor = mix(midCloudColor, toxicMid, uThemeToxicTint);
                darkCloudColor = mix(darkCloudColor, toxicDark, uThemeToxicTint);
                float blackCloudMask = smoothstep(0.66, 0.96, darkCloudLayer * 0.75 + cloudVeins * 0.55 + upperCloudBreakup * 0.35);
                vec3 nearBlackCloudColor = vec3(0.005, 0.008, 0.014);
                darkCloudColor = mix(darkCloudColor, nearBlackCloudColor, blackCloudMask * clamp(uThemeCloudBlackTint, 0.0, 1.0));
                vec3 color = brightCloudColor * denseCloudLayer * (0.34 + diffuse * 0.52);
                color += midCloudColor * midCloudLayer * (0.26 + diffuse * 0.34 + nightSide * 0.08);
                color += darkCloudColor * darkCloudLayer * (0.20 + nightSide * 0.24);
                float lightningPulseA = smoothstep(0.88, 1.0, sin(stormTime * 7.1 + variantA * 6.2831) * 0.5 + 0.5);
                float lightningPulseB = smoothstep(0.93, 1.0, sin(stormTime * 11.9 + variantB * 6.2831) * 0.5 + 0.5);
                float lightningPulseC = smoothstep(0.95, 1.0, sin(stormTime * 18.3 + variantC * 6.2831) * 0.5 + 0.5);
                float lightningMask = clamp((darkCloudLayer * 0.70 + nightSide * 0.45 + (1.0 - diffuse) * 0.28), 0.0, 1.0);
                float lightningCells = fbm(cloudFieldPosition * 14.0 + vec3(stormTime * 0.9, -stormTime * 0.55, stormTime * 0.7));
                float lightningStrands = fbm(cloudFieldPosition * 28.0 + vec3(-stormTime * 1.8, stormTime * 0.9, stormTime * 1.2));
                float lightningLocalMask = smoothstep(0.70, 0.92, lightningCells) * smoothstep(0.62, 0.88, lightningStrands);
                float lightningFlash = clamp((lightningPulseA * 0.55 + lightningPulseB * 0.70 + lightningPulseC * 0.90) * uThemeLightningIntensity * lightningMask * lightningLocalMask, 0.0, 1.0);
                float lightningHalo = smoothstep(0.46, 0.92, lightningCells) * smoothstep(0.40, 0.86, lightningStrands);
                float lightningBlast = clamp(lightningFlash * 1.55 + lightningHalo * lightningFlash * 1.20, 0.0, 1.0);
                vec3 lightningWhite = vec3(1.0, 0.995, 0.98);
                color += lightningWhite * lightningBlast * 2.10;
                color = mix(color, lightningWhite, clamp(lightningBlast * 0.40, 0.0, 0.42));
                color *= mix(0.34, 1.0, terminator);
                color *= uThemeCloudOpacity;
                color += (brightCloudColor * 0.85 + vec3(1.0) * 0.45) * lightningBlast * 0.75;
                float alpha = clamp(cloudCoverage * (0.66 + diffuse * 0.28) * uThemeCloudOpacity + lightningBlast * 0.18, 0.0, 0.94);
                gl_FragColor = vec4(color, alpha);
            }
        `
    })

    galaxyCloudSphere = new THREE.Mesh(cloudGeometry, galaxyCloudMaterial)
    galaxyCloudSphere.renderOrder = 2
    galaxyCloudSphere.scale.setScalar(sphereState.scale * sphereState.presetScale * sphereState.cloudLayerScale)
    scene.add(galaxyCloudSphere)

    const atmosphereGeometry = new THREE.SphereGeometry(1.87, 320, 320)
    galaxyAtmosphereMaterial = new THREE.ShaderMaterial({
        depthWrite: false,
        depthTest: true,
        transparent: true,
        blending: THREE.NormalBlending,
        uniforms: {
            uTime: { value: 0 },
            uHover: { value: 0 },
            uPatternSeed: { value: getSpherePatternSeed() },
            uMarsSurface: { value: 0 },
            uThemeAtmosphereStrength: { value: 1.0 },
            uThemeGasEscapeIntensity: { value: 0.0 },
            uThemeGasEscapeReach: { value: 0.0 },
            uThemeToxicTint: { value: 0.0 },
            uThemeSingularityMode: { value: 0.0 },
            uSunDirection: { value: getSunDirectionFromLocalTime() },
            uInsideColor: { value: new THREE.Color(parameters.insideColor) },
            uOutsideColor: { value: new THREE.Color(parameters.outsideColor) }
        },
        vertexShader: `
            varying vec3 vWorldNormal;
            varying vec3 vViewDirection;

            void main() {
                vec3 normalDirection = normalize(normal);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldNormal = normalize(mat3(modelMatrix) * normalDirection);
                vViewDirection = normalize(cameraPosition - worldPosition.xyz);
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `,
        fragmentShader: `
            uniform float uTime;
            uniform float uHover;
            uniform float uPatternSeed;
            uniform float uMarsSurface;
            uniform float uThemeAtmosphereStrength;
            uniform float uThemeGasEscapeIntensity;
            uniform float uThemeGasEscapeReach;
            uniform float uThemeToxicTint;
            uniform float uThemeSingularityMode;
            uniform vec3 uSunDirection;
            uniform vec3 uInsideColor;
            uniform vec3 uOutsideColor;

            varying vec3 vWorldNormal;
            varying vec3 vViewDirection;

            float hash(vec3 p) {
                p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
                p *= 17.0;
                return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float noise(vec3 p) {
                vec3 i = floor(p);
                vec3 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 0.0)), hash(i + vec3(1.0, 0.0, 0.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 0.0)), hash(i + vec3(1.0, 1.0, 0.0)), f.x),
                        f.y
                    ),
                    mix(
                        mix(hash(i + vec3(0.0, 0.0, 1.0)), hash(i + vec3(1.0, 0.0, 1.0)), f.x),
                        mix(hash(i + vec3(0.0, 1.0, 1.0)), hash(i + vec3(1.0, 1.0, 1.0)), f.x),
                        f.y
                    ),
                    f.z
                );
            }

            float fbm(vec3 p) {
                float value = 0.0;
                float amplitude = 0.5;
                for (int i = 0; i < 6; i++) {
                    value += amplitude * noise(p);
                    p = p * 2.03 + vec3(11.7, 4.2, 8.3);
                    amplitude *= 0.5;
                }
                return value;
            }

            void main() {
                vec3 normal = normalize(vWorldNormal);
                vec3 viewDirection = normalize(vViewDirection);
                float ndv = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);
                float rim = pow(1.0 - ndv, 2.4);
                float radialDistance = sqrt(max(0.0, 1.0 - ndv * ndv));
                vec3 lightDirection = normalize(uSunDirection);
                float rawLight = dot(normal, lightDirection);
                float diffuse = smoothstep(0.04, 0.95, clamp(rawLight * 0.5 + 0.5, 0.0, 1.0));
                float terminator = smoothstep(-0.24, 0.38, rawLight);
                float nightSide = 1.0 - smoothstep(-0.05, 0.35, rawLight);
                vec3 atmosphereBaseColor = mix(uInsideColor, uOutsideColor, 0.58);
                vec3 atmosphereColor = mix(atmosphereBaseColor * 0.52, vec3(0.82, 0.92, 1.0), 0.26);
                vec3 atmosphereShadowColor = mix(atmosphereBaseColor * 0.42, vec3(0.04, 0.07, 0.13), 0.28);
                float atmosphere = (0.10 + rim * 0.78 + smoothstep(0.62, 1.0, radialDistance) * 0.22) * mix(1.0, 0.42, uMarsSurface);
                atmosphere *= uThemeAtmosphereStrength;
                float sunLitAtmosphere = atmosphere * (0.08 + diffuse * 0.92);
                float shadowAtmosphere = atmosphere * nightSide * 0.72;
                if (uThemeSingularityMode > 0.5) {
                    // Sharper light/shadow response for black singularity atmosphere.
                    sunLitAtmosphere = atmosphere * (0.03 + pow(diffuse, 2.2) * 1.22);
                    shadowAtmosphere = atmosphere * pow(nightSide, 1.35) * 0.74;
                }
                vec3 escapeDirection = normalize(vec3(0.18, 0.92, -0.28));
                float escapeAxis = smoothstep(0.05, 0.88, dot(normal, escapeDirection));
                float escapeFlow = fbm(normal * 24.0 + vec3(uTime * 0.25, -uTime * 0.16, uTime * 0.21));
                float escapeFilaments = fbm(normal * 52.0 + vec3(uTime * 0.52, uTime * 0.18, -uTime * 0.37));
                float gasEscape = smoothstep(0.58, 0.92, escapeFlow + escapeFilaments * 0.36) * escapeAxis * uThemeGasEscapeIntensity;
                gasEscape *= smoothstep(0.20, 1.0, rim);
                float farDriftNoise = fbm(normal * 11.0 + vec3(uTime * 0.08, -uTime * 0.05, uTime * 0.06));
                float farDriftAxis = smoothstep(0.38, 1.0, dot(normal, escapeDirection) + farDriftNoise * 0.20);
                float farDrift = farDriftAxis * rim * uThemeGasEscapeReach * 0.42;

                vec3 color = atmosphereColor * (sunLitAtmosphere * 0.74 + rim * 0.28 + diffuse * 0.020) * (1.0 + uHover * 0.08);
                color += atmosphereShadowColor * shadowAtmosphere * 0.72;
                vec3 coldEscapeColor = mix(vec3(0.50, 0.96, 1.0), vec3(0.82, 1.0, 1.0), diffuse);
                vec3 toxicEscapeColor = mix(vec3(0.44, 0.96, 0.18), vec3(0.92, 1.0, 0.26), diffuse);
                vec3 escapeColor = mix(coldEscapeColor, toxicEscapeColor, uThemeToxicTint);
                color += escapeColor * gasEscape * mix(0.52, 0.78, uThemeToxicTint);
                color += escapeColor * farDrift * mix(0.36, 0.64, uThemeToxicTint);
                color *= mix(0.28, 1.0, terminator);
                float alpha = clamp(sunLitAtmosphere * 0.38 + shadowAtmosphere * 0.16 + rim * 0.18 + gasEscape * 0.24 + farDrift * 0.12, 0.0, 0.78);
                if (uThemeSingularityMode > 0.5) {
                    alpha = clamp(sunLitAtmosphere * 0.34 + shadowAtmosphere * 0.22 + rim * 0.14 + gasEscape * 0.10 + farDrift * 0.05, 0.0, 0.72);
                }
                gl_FragColor = vec4(color, alpha);
            }
        `
    })

    galaxyAtmosphereSphere = new THREE.Mesh(atmosphereGeometry, galaxyAtmosphereMaterial)
    galaxyAtmosphereSphere.renderOrder = 3
    galaxyAtmosphereSphere.scale.setScalar(sphereState.scale * sphereState.presetScale * sphereState.atmosphereScale)
    scene.add(galaxyAtmosphereSphere)
}

const updateGalaxySphereColors = (preset = null) => {
    if (!galaxySphereMaterial) return
    const skyTheme = getSkyThemeProfile(preset)
    galaxySphereMaterial.uniforms.uInsideColor.value.set(parameters.insideColor)
    galaxySphereMaterial.uniforms.uOutsideColor.value.set(parameters.outsideColor)
    galaxySphereMaterial.uniforms.uPatternSeed.value = getSpherePatternSeed(preset)
    galaxySphereMaterial.uniforms.uMarsSurface.value = isCinematicPreset(preset) ? 1 : 0
    galaxySphereMaterial.uniforms.uMountainContinents.value = hasMountainContinents(preset) ? 1 : 0
    galaxySphereMaterial.uniforms.uThemeMegaVolcanoIntensity.value = skyTheme.megaVolcanoIntensity ?? 0.0
    galaxySphereMaterial.uniforms.uThemeRiverStrength.value = skyTheme.riverStrength
    galaxySphereMaterial.uniforms.uThemeRiverPattern.value = skyTheme.riverPattern
    galaxySphereMaterial.uniforms.uThemeRiverDarkness.value = skyTheme.riverDarkness
    galaxySphereMaterial.uniforms.uThemeLavaRiverTint.value = skyTheme.lavaRiverTint ?? 0.0
    galaxySphereMaterial.uniforms.uThemeMountainCoverage.value = skyTheme.mountainCoverage ?? 1.0
    galaxySphereMaterial.uniforms.uThemeMountainHeight.value = skyTheme.mountainHeight ?? 1.0
    galaxySphereMaterial.uniforms.uThemeMountainLakeIntensity.value = skyTheme.mountainLakeIntensity ?? 0.0
    galaxySphereMaterial.uniforms.uThemeMountainLakeDarkness.value = skyTheme.mountainLakeDarkness ?? 1.0
    galaxySphereMaterial.uniforms.uThemeLakeRedStrength.value = skyTheme.lakeRedStrength ?? 0.0
    galaxySphereMaterial.uniforms.uThemeOceanStrength.value = skyTheme.oceanStrength ?? 1.0
    galaxySphereMaterial.uniforms.uThemeOceanPrimaryTint.value = skyTheme.oceanPrimaryTint ?? 0.62
    galaxySphereMaterial.uniforms.uThemeOceanGlowStrength.value = skyTheme.oceanGlowStrength ?? 0.0
    galaxySphereMaterial.uniforms.uThemeOceanBrightness.value = skyTheme.oceanBrightness ?? 1.0
    galaxySphereMaterial.uniforms.uThemeLakeGlowStrength.value = skyTheme.lakeGlowStrength ?? 0.0
    galaxySphereMaterial.uniforms.uThemeSurfaceGlowStrength.value = skyTheme.surfaceGlowStrength
    galaxySphereMaterial.uniforms.uThemeBlackHoleMode.value = skyTheme.blackHoleMode ?? 0.0
    galaxySphereMaterial.uniforms.uThemeSingularityMode.value = skyTheme.singularityMode ?? 0.0
    galaxySphereMaterial.transparent = (skyTheme.singularityMode ?? 0.0) < 0.5
    galaxySphereMaterial.depthWrite = true
    galaxySphereMaterial.needsUpdate = true
    sphereState.targetRotationSpeed = skyTheme.sphereRotationSpeed ?? 0.0
    if (galaxyCloudMaterial) {
        galaxyCloudMaterial.uniforms.uInsideColor.value.set(parameters.insideColor)
        galaxyCloudMaterial.uniforms.uOutsideColor.value.set(parameters.outsideColor)
        galaxyCloudMaterial.uniforms.uPatternSeed.value = getSpherePatternSeed(preset)
        galaxyCloudMaterial.uniforms.uMarsSurface.value = isCinematicPreset(preset) ? 1 : 0
        galaxyCloudMaterial.uniforms.uThemeCloudDensity.value = skyTheme.cloudDensity
        galaxyCloudMaterial.uniforms.uThemeCloudContrast.value = skyTheme.cloudContrast
        galaxyCloudMaterial.uniforms.uThemeCloudSharpness.value = skyTheme.cloudSharpness
        galaxyCloudMaterial.uniforms.uThemeCloudScale.value = skyTheme.cloudScale
        galaxyCloudMaterial.uniforms.uThemeCloudOpacity.value = skyTheme.cloudOpacity
        galaxyCloudMaterial.uniforms.uThemeCloudBlackTint.value = skyTheme.cloudBlackTint ?? 0.0
        galaxyCloudMaterial.uniforms.uThemeTornadoIntensity.value = skyTheme.tornadoIntensity
        galaxyCloudMaterial.uniforms.uThemeToxicTint.value = skyTheme.toxicTint
        galaxyCloudMaterial.uniforms.uThemeCloudMotionSpeed.value = skyTheme.cloudMotionSpeed ?? 1.0
        galaxyCloudMaterial.uniforms.uThemeLightningIntensity.value = skyTheme.lightningIntensity ?? 0.0
    }
    if (galaxyAtmosphereMaterial) {
        galaxyAtmosphereMaterial.uniforms.uInsideColor.value.set(parameters.insideColor)
        galaxyAtmosphereMaterial.uniforms.uOutsideColor.value.set(parameters.outsideColor)
        galaxyAtmosphereMaterial.uniforms.uPatternSeed.value = getSpherePatternSeed(preset)
        galaxyAtmosphereMaterial.uniforms.uMarsSurface.value = isCinematicPreset(preset) ? 1 : 0
        galaxyAtmosphereMaterial.uniforms.uThemeAtmosphereStrength.value = skyTheme.atmosphereStrength
        galaxyAtmosphereMaterial.uniforms.uThemeGasEscapeIntensity.value = skyTheme.gasEscapeIntensity
        galaxyAtmosphereMaterial.uniforms.uThemeGasEscapeReach.value = skyTheme.gasEscapeReach ?? 0.0
        galaxyAtmosphereMaterial.uniforms.uThemeToxicTint.value = skyTheme.toxicTint
        galaxyAtmosphereMaterial.uniforms.uThemeSingularityMode.value = skyTheme.singularityMode ?? 0.0
    }
    const presetName = preset?.name?.toLowerCase() || ''
    sphereState.cloudLayerScale = skyTheme.cloudLayerScale ?? 1.0
    sphereState.atmosphereScale = skyTheme.atmosphereScale ?? 1.0
    if (presetName === 'black hole') {
        sphereState.presetScale = 1.1
    } else if (presetName === 'black singularity') {
        sphereState.presetScale = 1.1
    } else if (presetName === 'ultra blast') {
        sphereState.presetScale = 1.4
    } else {
        sphereState.presetScale = isCinematicPreset(preset) ? 2.5 : 1
    }
}

createGalaxySphere()

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

const getPresetRotationDirection = (preset) => {
    return preset?.hover?.camera?.movement?.rotationDirection ||
        preset?.camera?.movement?.rotationDirection ||
        null
}

const applyRotationDirection = (preset, speed) => {
    const direction = getPresetRotationDirection(preset)

    if (direction === 'clockwise') {
        return Math.abs(speed)
    }

    if (direction === 'counterclockwise') {
        return -Math.abs(speed)
    }

    return speed
}

const getPresetRotationSpeed = (preset) => {
    return applyRotationDirection(preset, preset?.camera?.movement?.rotationSpeed || 0)
}

const getPresetHoverRotationSpeed = (preset) => {
    const speed = preset?.hover?.camera?.movement?.rotationSpeed ?? preset?.hover?.galaxy?.rotationSpeed
    return typeof speed === 'number' ? applyRotationDirection(preset, speed) : null
}

const isCameraPosition = (position) => {
    return position &&
        typeof position.x === 'number' &&
        typeof position.y === 'number' &&
        typeof position.z === 'number'
}

const hasPresetHoverGalaxyOverrides = (preset) => {
    const hoverGalaxy = preset?.hover?.galaxy
    return !!hoverGalaxy && Object.keys(hoverGalaxy).some((key) => key !== 'count')
}

const setPresetHoverState = (isHovered) => {
    const preset = presets[currentPresetIndex]
    const effect = getCurrentHoverEffect()
    const normalHover = effect?.normalButtons || {}
    const hoverRotationSpeed = getPresetHoverRotationSpeed(preset)
    const hoverCameraPosition = preset?.hover?.camera?.position
    const presetCameraPosition = preset?.camera?.position

    presetHoverActive = isHovered
    hoverParameters.isHovered = isHovered
    hoverParameters.targetHoverIntensity = isHovered ? 1.0 : 0.0
    hoverParameters.sizeMultiplier = normalHover.sizeMultiplier ?? 1.2
    hoverParameters.spinMultiplier = normalHover.spinMultiplier ?? 1.1
    hoverParameters.brightnessMultiplier = normalHover.brightnessMultiplier ?? 1.3
    hoverParameters.targetBrightnessMultiplier = isHovered ? hoverParameters.brightnessMultiplier : 1.0
    if (isHovered && hoverRotationSpeed !== null) {
        targetPresetAutoRotateSpeed = hoverRotationSpeed
    } else {
        targetPresetAutoRotateSpeed = getPresetRotationSpeed(preset)
    }

    targetGalaxyHoverMix = isHovered && hasPresetHoverGalaxyOverrides(preset) ? 1 : 0

    if (isHovered && isCameraPosition(hoverCameraPosition)) {
        cameraManualControlLocked = false
        cameraTargetMode = 'preserveOrbit'
        cameraReturnPresetPosition = { ...hoverCameraPosition }
        targetCameraPosition = getPresetPositionAtCurrentAzimuth(hoverCameraPosition)
        cameraHoverMovementActive = true
        cameraProgrammaticMoveActive = true
    } else if (!isHovered && isCameraPosition(presetCameraPosition)) {
        cameraManualControlLocked = false
        cameraTargetMode = 'preserveOrbit'
        cameraReturnPresetPosition = { ...presetCameraPosition }
        targetCameraPosition = getPresetPositionAtCurrentAzimuth(presetCameraPosition)
        cameraHoverMovementActive = true
        cameraProgrammaticMoveActive = true
    }
}

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
    // Always start from clean defaults so presets don't leak values between each other.
    Object.keys(defaultGalaxyParameters).forEach((key) => {
        parameters[key] = defaultGalaxyParameters[key]
    })

    // Preset switching should snap to the new preset, not keep old hover camera tweening.
    cameraHoverMovementActive = false
    cameraProgrammaticMoveActive = false
    cameraTargetMode = 'fixed'
    cameraReturnPresetPosition = null

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
        updateGalaxySphereColors(preset);
    }
    
    // Apply camera settings
    if (preset.camera) {
        if (preset.camera.position) {
            cameraManualControlLocked = false;
            cameraUserInteracting = false;
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
            presetAutoRotateEnabled = preset.camera.movement.autoRotate || false;
            presetAutoRotateSpeed = getPresetRotationSpeed(preset);
            targetPresetAutoRotateSpeed = presetAutoRotateSpeed;
            galaxyHoverMix = 0;
            targetGalaxyHoverMix = 0;
            controls.autoRotate = presetAutoRotateEnabled && !isCameraManuallyActive();
            controls.autoRotateSpeed = presetAutoRotateSpeed;
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
        material.uniforms.uNormalRotationSpeed.value = parameters.normalRotationSpeed;
    }
    
    // Apply preset's assigned hover effect
    if (preset.hoverEffect) {
        const effectIndex = preset.hoverEffect.index;
        if (effectIndex >= 0 && effectIndex < hoverEffectsConfig.hoverEffects.length) {
            hoverEffectsConfig.currentEffectIndex = effectIndex;
            updateHoverEffectDisplay();
            console.log(`Applied hover effect "${preset.hoverEffect.name}" to preset "${preset.name}"`);
        }
    } else {
        // Fall back to the default hover theme when preset doesn't define one.
        hoverEffectsConfig.currentEffectIndex = 0;
        updateHoverEffectDisplay();
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
        setPresetHoverState(false);
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
        setPresetHoverState(false);
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

// Simple NEXT MEETING timer (no button state changes)
function updateTimer() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hours = now.getUTCHours();

    // Calculate next Tuesday 17:00 UTC+2 (15:00 UTC)
    let nextMeeting = new Date(now);
    nextMeeting.setUTCHours(15, 0, 0, 0);
    const daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
    nextMeeting.setUTCDate(nextMeeting.getUTCDate() + daysUntilTuesday);
    if (dayOfWeek === 2 && hours >= 15) {
        nextMeeting.setUTCDate(nextMeeting.getUTCDate() + 7);
    }

    const diff = nextMeeting - now;

    const timerElement = document.querySelector('.countdown-timer');
    if (!timerElement) return;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);
    const ms = diff % 1000;

    const timeStr = `${days}d ${String(hoursLeft).padStart(2, '0')}h ${String(minutesLeft).padStart(2, '0')}m ${String(secondsLeft).padStart(2, '0')}s ${String(ms).padStart(3, '0')}ms`;
    timerElement.innerHTML = `<b>NEXT MEETING:</b> <span style="color: rgba(255, 255, 255, 0.7);">${timeStr}</span>`;
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
    galaxyHoverMix += (targetGalaxyHoverMix - galaxyHoverMix) * 0.08
    if (material.uniforms.uGalaxyHoverMix) {
        material.uniforms.uGalaxyHoverMix.value = galaxyHoverMix
    }
    
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

    const cameraManuallyActive = isCameraManuallyActive()
    presetAutoRotateSpeed += (targetPresetAutoRotateSpeed - presetAutoRotateSpeed) * 0.08
    const hoverCanDriveCamera = !cameraUserInteracting && (presetHoverActive || !cameraManuallyActive)
    controls.autoRotate = hoverCanDriveCamera && presetAutoRotateEnabled
    controls.autoRotateSpeed = presetAutoRotateSpeed

    // Smooth camera movement only while a hover effect is actively steering the camera.
    if (cameraHoverMovementActive && hoverCanDriveCamera && !controlsDecayLockActive) {
        if (cameraTargetMode === 'preserveOrbit' && cameraReturnPresetPosition) {
            targetCameraPosition = getPresetPositionAtCurrentAzimuth(cameraReturnPresetPosition)
        }

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
        } else {
            cameraHoverMovementActive = false;
            cameraProgrammaticMoveActive = false;
            cameraTargetMode = 'fixed';
            cameraReturnPresetPosition = null;
            syncTargetCameraToCurrent();
        }
    }
    
    // Re-enable controls when decay completes
    if (controlsDecayLockActive && hoverParameters.hoverIntensity <= 0.01) {
        controls.enabled = previousControlsEnabled
        presetAutoRotateEnabled = previousAutoRotateState
        presetAutoRotateSpeed = previousAutoRotateSpeedState
        targetPresetAutoRotateSpeed = previousAutoRotateSpeedState
        controls.autoRotate = !isCameraManuallyActive() && presetAutoRotateEnabled
        controls.autoRotateSpeed = presetAutoRotateSpeed
        controlsDecayLockActive = false
    }

    if (galaxySphere && galaxySphereMaterial) {
        const sunDirection = getSunDirectionFromLocalTime()
        const currentPreset = presets[currentPresetIndex]
        const isFrozenRingHovering = (currentPreset?.name?.toLowerCase() === 'frozen ring') && presetHoverActive
        const hoverTwistTarget = isFrozenRingHovering ? Math.min(1, hoverParameters.hoverIntensity * 1.35) : 0
        sphereState.hover += (sphereState.targetHover - sphereState.hover) * 0.08
        sphereState.scale += (sphereState.targetScale - sphereState.scale) * 0.08
        const frozenBaseSpin = -0.08
        const frozenHoverSpinBoost = -0.36
        const desiredRotationSpeed = (currentPreset?.name?.toLowerCase() === 'frozen ring')
            ? frozenBaseSpin + (frozenHoverSpinBoost * sphereState.hoverTwist)
            : sphereState.targetRotationSpeed
        sphereState.rotationSpeed += (desiredRotationSpeed - sphereState.rotationSpeed) * 0.12
        sphereState.hoverTwist += (hoverTwistTarget - sphereState.hoverTwist) * 0.08
        galaxySphere.scale.setScalar(sphereState.scale * sphereState.presetScale)
        const frozenTwistPulse = elapsedTime * (1.8 + sphereState.hoverTwist * 3.0)
        const frozenTwistX = Math.sin(frozenTwistPulse) * 0.11 * sphereState.hoverTwist
        const frozenTwistZ = Math.cos(frozenTwistPulse * 0.86) * 0.08 * sphereState.hoverTwist
        galaxySphere.rotation.x = frozenTwistX
        galaxySphere.rotation.z = frozenTwistZ
        const frozenTwistSpinBoost = 1.0 + sphereState.hoverTwist * 0.9
        galaxySphere.rotation.y += sphereState.rotationSpeed * frozenTwistSpinBoost * Math.max(deltaTime, 0)
        galaxySphereMaterial.uniforms.uTime.value = elapsedTime
        galaxySphereMaterial.uniforms.uHover.value = sphereState.hover
        galaxySphereMaterial.uniforms.uSunDirection.value.copy(sunDirection)
        if (galaxyCloudSphere && galaxyCloudMaterial) {
            galaxyCloudSphere.scale.setScalar(sphereState.scale * sphereState.presetScale * sphereState.cloudLayerScale)
            galaxyCloudSphere.rotation.x = frozenTwistX * 0.72
            galaxyCloudSphere.rotation.z = frozenTwistZ * 0.72
            galaxyCloudSphere.rotation.y += sphereState.rotationSpeed * 1.08 * frozenTwistSpinBoost * Math.max(deltaTime, 0)
            galaxyCloudMaterial.uniforms.uTime.value = elapsedTime
            galaxyCloudMaterial.uniforms.uHover.value = sphereState.hover
            galaxyCloudMaterial.uniforms.uSunDirection.value.copy(sunDirection)
        }
        if (galaxyAtmosphereSphere && galaxyAtmosphereMaterial) {
            galaxyAtmosphereSphere.scale.setScalar(sphereState.scale * sphereState.presetScale * sphereState.atmosphereScale)
            galaxyAtmosphereSphere.rotation.x = frozenTwistX * 0.45
            galaxyAtmosphereSphere.rotation.z = frozenTwistZ * 0.45
            galaxyAtmosphereSphere.rotation.y += sphereState.rotationSpeed * 0.92 * frozenTwistSpinBoost * Math.max(deltaTime, 0)
            galaxyAtmosphereMaterial.uniforms.uTime.value = elapsedTime
            galaxyAtmosphereMaterial.uniforms.uHover.value = sphereState.hover
            galaxyAtmosphereMaterial.uniforms.uSunDirection.value.copy(sunDirection)
        }
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

// Button hover can adjust cheap preset movement values without steering the camera.
const initButtonHoverEffects = () => {
    hoverParameters.targetHoverIntensity = 0.0;
    hoverParameters.isHovered = false;
    hoverParameters.targetBrightnessMultiplier = 1.0;
    cameraHoverMovementActive = false;
    sphereState.targetHover = 0;
    sphereState.targetScale = 0.96;
    syncTargetCameraToCurrent();

    const hoverTargets = document.querySelectorAll(
        '.modern-button, .subscribe-button, .preset-arrow, .hover-effect-arrow, .vinyl-stop-button, .color-mode-toggle, .preset-name, a.subscribe-button'
    );
    hoverTargets.forEach((target) => {
        target.addEventListener('mouseenter', () => setPresetHoverState(true));
        target.addEventListener('mouseleave', () => setPresetHoverState(false));
    });
};

const initInteractiveControlGuards = () => {
    const interactiveTargets = document.querySelectorAll('a, button, input, textarea, select, #audio-control');

    interactiveTargets.forEach((target) => {
        target.addEventListener('pointerdown', (event) => event.stopPropagation());
        target.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
    });
}

// Initialize normalized hover state without galaxy/camera reset effects.
document.addEventListener('DOMContentLoaded', initButtonHoverEffects);
document.addEventListener('DOMContentLoaded', initInteractiveControlGuards);

// Initialize hover effect switcher
document.addEventListener('DOMContentLoaded', initHoverEffectSwitcher);

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
                material.uniforms.uNormalRotationSpeed.value = parameters.normalRotationSpeed;
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
