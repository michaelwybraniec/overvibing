import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as dat from 'dat.gui'
import vertexShader from './shaders/galaxy/vertex.glsl'
import fragmentShader from './shaders/galaxy/fragment.glsl'
import presetsConfig from './configs/presets.json'

/**
 * Audio System
 */
class AudioSystem {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.isInitialized = false;
        this.isPlaying = false;
        
        // Audio nodes
        this.bassOsc = null;
        this.leadOsc = null;
        this.padOsc = null;
        this.hihatOsc = null;
        this.kickOsc = null;
        
        // Effects
        this.reverb = null;
        this.delay = null;
        this.filter = null;
        
        // Configuration
        this.config = {
            bpm: 60,
            volume: 0.3,
            bassFreq: 80,
            leadFreq:120,
            padFreq: 440,
            reverbWet: 0.22,
            delayTime: 1,
            filterFreq: 500
        };
        
        this.startTime = 0;
        this.currentStep = 0;
        
        // 16-beat sequencer patterns
        this.sequencer = {
            bass: [false, false, true, false, false, true, false, true, false, false, true, false, false, true, false, false],
            lead: [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
            pad: [true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false],
            kick: [true, false, false, false, true, false, false, false, true, false, false, false, true, false, false, false]
        };
        this.currentBeat = 0;
        
        // Wind sound
        this.windOsc = null;
        this.windGain = null;
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.setValueAtTime(this.config.volume, this.audioContext.currentTime);
            this.masterGain.connect(this.audioContext.destination);
            
            // Create reverb
            await this.createReverb();
            
            // Create delay
            this.createDelay();
            
            // Create filter
            this.createFilter();
            
            this.isInitialized = true;
            console.log('Audio system initialized');
            
        } catch (error) {
            console.error('Failed to initialize audio system:', error);
        }
    }

    async createReverb() {
        const convolver = this.audioContext.createConvolver();
        const reverbTime = 3;
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * reverbTime;
        const impulse = this.audioContext.createBuffer(2, length, sampleRate);
        
        for (let channel = 0; channel < 2; channel++) {
            const channelData = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
            }
        }
        
        convolver.buffer = impulse;
        
        const reverbGain = this.audioContext.createGain();
        reverbGain.gain.setValueAtTime(this.config.reverbWet, this.audioContext.currentTime);
        
        convolver.connect(reverbGain);
        reverbGain.connect(this.masterGain);
        
        this.reverb = { convolver, gain: reverbGain };
    }

    createDelay() {
        const delayNode = this.audioContext.createDelay(1.0);
        delayNode.delayTime.setValueAtTime(this.config.delayTime, this.audioContext.currentTime);
        
        const delayGain = this.audioContext.createGain();
        delayGain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        
        const feedback = this.audioContext.createGain();
        feedback.gain.setValueAtTime(0.4, this.audioContext.currentTime);
        
        delayNode.connect(delayGain);
        delayGain.connect(feedback);
        feedback.connect(delayNode);
        delayGain.connect(this.masterGain);
        
        this.delay = { node: delayNode, gain: delayGain, feedback };
    }

    createFilter() {
        this.filter = this.audioContext.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(this.config.filterFreq, this.audioContext.currentTime);
        this.filter.Q.setValueAtTime(1, this.audioContext.currentTime);
        this.filter.connect(this.masterGain);
    }

    createBass() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.config.bassFreq, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        osc.connect(gain);
        gain.connect(this.filter);
        gain.connect(this.reverb.convolver);
        
        return { osc, gain };
    }

    createLead() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(this.config.leadFreq, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        osc.connect(gain);
        gain.connect(this.delay.node);
        gain.connect(this.masterGain);
        
        return { osc, gain };
    }

    createPad() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(this.config.padFreq, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        osc.connect(gain);
        gain.connect(this.reverb.convolver);
        
        return { osc, gain };
    }

    createKick() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        return { osc, gain };
    }

    createHihat() {
        const bufferSize = this.audioContext.sampleRate * 0.1;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
        }
        
        const source = this.audioContext.createBufferSource();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(8000, this.audioContext.currentTime);
        
        source.buffer = buffer;
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        
        return { source, gain };
    }

    createArp() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1500, this.audioContext.currentTime);
        filter.Q.setValueAtTime(2, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.delay.node);
        gain.connect(this.masterGain);
        
        return { osc, gain };
    }

    createSubBass() {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();
        
        osc.type = 'triangle';
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, this.audioContext.currentTime);
        filter.Q.setValueAtTime(3, this.audioContext.currentTime);
        
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.reverb.convolver);
        
        return { osc, gain };
    }

    createWind() {
        if (this.windOsc) return; // Already created
        
        // Create multiple oscillators for rich wind texture
        const osc1 = this.audioContext.createOscillator();
        const osc2 = this.audioContext.createOscillator();
        const osc3 = this.audioContext.createOscillator();
        
        const windGain = this.audioContext.createGain();
        const filter1 = this.audioContext.createBiquadFilter();
        const filter2 = this.audioContext.createBiquadFilter();
        
        // Configure oscillators for wind-like sound
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(80, this.audioContext.currentTime);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(120, this.audioContext.currentTime);
        
        osc3.type = 'triangle';
        osc3.frequency.setValueAtTime(200, this.audioContext.currentTime);
        
        // Filters for wind texture
        filter1.type = 'highpass';
        filter1.frequency.setValueAtTime(200, this.audioContext.currentTime);
        
        filter2.type = 'lowpass';
        filter2.frequency.setValueAtTime(1000, this.audioContext.currentTime);
        filter2.Q.setValueAtTime(0.5, this.audioContext.currentTime);
        
        // Connect wind chain
        windGain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        
        osc1.connect(filter1);
        osc2.connect(filter1);
        osc3.connect(filter1);
        filter1.connect(filter2);
        filter2.connect(windGain);
        windGain.connect(this.reverb.convolver);
        
        this.windOsc = [osc1, osc2, osc3];
        this.windGain = windGain;
        this.windFilter = filter2;
        
        return { oscs: [osc1, osc2, osc3], gain: windGain };
    }

    startWind() {
        if (!this.windOsc) {
            this.createWind();
            // Only start oscillators if they were just created
            this.windOsc.forEach(osc => osc.start());
        }
    }

    stopWind() {
        if (this.windOsc) {
            this.windOsc.forEach(osc => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch(e) {
                    console.warn('Error stopping wind oscillator:', e);
                }
            });
            if (this.windGain) {
                this.windGain.disconnect();
            }
            this.windOsc = null;
            this.windGain = null;
        }
    }

    playSequence() {
        if (!this.isInitialized) return;
        
        const stepTime = 60 / this.config.bpm / 4; // 16th notes
        const currentTime = this.audioContext.currentTime;
        
        // Bass pattern - check sequencer
        if (this.sequencer.bass[this.currentBeat]) {
            const bass = this.createBass();
            bass.osc.frequency.setValueAtTime(this.config.bassFreq, currentTime);
            bass.osc.start(currentTime);
            bass.gain.gain.setValueAtTime(0.4, currentTime);
            bass.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.5);
            bass.osc.stop(currentTime + 0.5);
        }
        
        // Kick pattern - check sequencer
        if (this.sequencer.kick[this.currentBeat]) {
            const kick = this.createKick();
            kick.osc.start(currentTime);
            kick.gain.gain.setValueAtTime(0.6, currentTime);
            kick.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.2);
            kick.osc.stop(currentTime + 0.2);
        }
        
        // Lead pattern - check sequencer
        if (this.sequencer.lead[this.currentBeat]) {
            const lead = this.createLead();
            lead.osc.frequency.setValueAtTime(this.config.leadFreq, currentTime);
            lead.osc.start(currentTime);
            lead.gain.gain.setValueAtTime(0.3, currentTime);
            lead.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.5);
            lead.osc.stop(currentTime + 1.5);
        }
        
        // Pad pattern - check sequencer
        if (this.sequencer.pad[this.currentBeat]) {
            const pad = this.createPad();
            pad.osc.frequency.setValueAtTime(this.config.padFreq, currentTime);
            pad.osc.start(currentTime);
            pad.gain.gain.setValueAtTime(0.15, currentTime);
            pad.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 4.0);
            pad.osc.stop(currentTime + 4.0);
        }
        
        this.currentBeat = (this.currentBeat + 1) % 16;
        
        // Schedule next step
        if (this.isPlaying) {
            setTimeout(() => this.playSequence(), stepTime * 1000);
        }
    }

    async start() {
        if (!this.isInitialized) {
            await this.init();
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime;
        this.startWind(); // Start continuous wind
        this.playSequence();
        
        console.log('Audio started');
    }

    stop() {
        this.isPlaying = false;
        this.stopWind(); // Stop wind
        console.log('Audio stopped');
    }

    updateParams(galaxyParams) {
        if (!this.isInitialized) return;
        
        // Map galaxy parameters to audio
        this.config.bassFreq = 40 + (galaxyParams.radius / 20) * 60;
        this.config.leadFreq = 200 + (galaxyParams.spin / 5) * 400;
        this.config.padFreq = 300 + (galaxyParams.randomness / 2) * 300;
        this.config.filterFreq = 1000 + (galaxyParams.branches / 20) * 3000;
        
        if (this.filter) {
            this.filter.frequency.exponentialRampToValueAtTime(
                this.config.filterFreq, 
                this.audioContext.currentTime + 0.1
            );
        }
    }
}

// Initialize audio system
const audioSystem = new AudioSystem();

// Dev mode flag - set to true to show controls
const DEV_MODE = false;

// Set dev mode attribute on body
document.body.setAttribute('data-dev-mode', DEV_MODE);

// Create audio control element
const audioControl = document.getElementById('audio-control');
audioControl.innerHTML = `
    <div class="play-icon"></div>
    <div class="pause-icon"></div>
`;

// Function to update audio control icon
const updateAudioIcon = (isPlaying) => {
    audioControl.classList.toggle('playing', isPlaying);
};

// Handle audio toggle
const toggleAudio = async (event) => {
    if (event) event.preventDefault();
    
    if (audioSystem.isPlaying) {
        audioSystem.stop();
        updateAudioIcon(false);
    } else {
        await audioSystem.start();
        updateAudioIcon(true);
    }
};

// Add click handler for audio control
audioControl.addEventListener('click', toggleAudio);

// Initialize and start audio
(async () => {
    try {
        await audioSystem.init();
        await audioSystem.start();
        updateAudioIcon(true);
    } catch (error) {
        // If auto-start fails (which is expected), wait for user interaction
        const startAudio = async () => {
            try {
                await audioSystem.start();
                updateAudioIcon(true);
                // Remove all listeners after successful start
                window.removeEventListener('click', startAudio);
                window.removeEventListener('touchstart', startAudio);
                window.removeEventListener('keydown', startAudio);
            } catch (error) {
                console.error('Failed to start audio:', error);
            }
        };

        window.addEventListener('click', startAudio);
        window.addEventListener('touchstart', startAudio);
        window.addEventListener('keydown', startAudio);
    }
})();

/**
 * Base
 */
// Debug
let gui = new dat.GUI();
// Hide GUI if not in dev mode
if (!DEV_MODE) {
    gui.domElement.style.display = 'none';
}

// Canvas
const canvas = document.createElement('canvas');
const container = document.createElement('div');
container.id = 'container';
container.appendChild(canvas);
document.body.appendChild(container);

// Scene
const scene = new THREE.Scene()

// Initialize configurations
const cameraConfigs = presetsConfig.presets;
let currentConfig = JSON.parse(JSON.stringify(cameraConfigs[0]));

// Update parameters from config
const parameters = { ...currentConfig.galaxy };

// Animation state
let animationState = {
    time: 0,
    lastUpdate: Date.now()
};

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(
    currentConfig.camera.position.x,
    currentConfig.camera.position.y,
    currentConfig.camera.position.z
);
scene.add(camera)

// Controls
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// Camera animation function
const animateCamera = () => {
    if (!currentConfig.camera.automation.enabled) return;
    
    const now = Date.now();
    const deltaTime = (now - animationState.lastUpdate) / 1000;
    animationState.time += deltaTime;
    animationState.lastUpdate = now;

    const config = currentConfig.camera.automation;
    
    if (config.path === 'circular') {
        const radius = 5;
        camera.position.x = Math.cos(animationState.time * config.pathSpeed) * radius;
        camera.position.z = Math.sin(animationState.time * config.pathSpeed) * radius;
    } else if (config.path === 'spiral') {
        const radius = 5 + Math.sin(animationState.time * 0.5) * 2;
        camera.position.x = Math.cos(animationState.time * config.pathSpeed) * radius;
        camera.position.z = Math.sin(animationState.time * config.pathSpeed) * radius;
        camera.position.y = Math.cos(animationState.time * 0.5) * 2;
    } else if (config.path === 'figure8') {
        const scale = 5;
        camera.position.x = Math.sin(animationState.time * config.pathSpeed) * scale;
        camera.position.z = Math.sin(animationState.time * config.pathSpeed * 2) * scale * 0.5;
    }

    if (config.oscillation.enabled) {
        camera.position.y += Math.sin(animationState.time * config.oscillation.frequency) * 
                           config.oscillation.amplitude * deltaTime;
    }

    if (config.zoom.enabled) {
        const zoomFactor = (Math.sin(animationState.time * config.zoom.speed) + 1) * 0.5;
        const currentZoom = config.zoom.min + (config.zoom.max - config.zoom.min) * zoomFactor;
        camera.position.multiplyScalar(currentZoom / camera.position.length());
    }

    camera.lookAt(scene.position);
    
    // Update current config with new camera position
    currentConfig.camera.position.x = camera.position.x;
    currentConfig.camera.position.y = camera.position.y;
    currentConfig.camera.position.z = camera.position.z;
};

// Helper functions for configuration
const updateUIColors = (insideColor, outsideColor) => {
    // If outside color is black, use inside color for UI elements
    const uiColor = outsideColor.toLowerCase() === '#000000' ? insideColor : outsideColor;
    document.documentElement.style.setProperty('--galaxy-inside-color', insideColor);
    document.documentElement.style.setProperty('--galaxy-outside-color', uiColor);
};

const applyGalaxyConfiguration = (config) => {
    Object.assign(parameters, config.galaxy);
    generateGalaxy();
    updateUIColors(config.galaxy.insideColor, config.galaxy.outsideColor);
};

const applyCameraConfiguration = (config) => {
    const cameraConfig = config.camera;
    
    // Apply basic settings
    controls.enableRotate = cameraConfig.basic.enableRotate;
    controls.enableZoom = cameraConfig.basic.enableZoom;
    controls.enablePan = cameraConfig.basic.enablePan;
    controls.dampingFactor = cameraConfig.basic.smoothness;
    
    // Apply position
    camera.position.set(
        cameraConfig.position.x,
        cameraConfig.position.y,
        cameraConfig.position.z
    );
    camera.lookAt(scene.position);
    
    // Apply movement settings
    controls.autoRotate = cameraConfig.movement.autoRotate;
    controls.autoRotateSpeed = cameraConfig.movement.rotationSpeed;
    controls.zoomSpeed = cameraConfig.movement.zoomSpeed;
    controls.minDistance = cameraConfig.movement.minDistance;
    controls.maxDistance = cameraConfig.movement.maxDistance;
    controls.minPolarAngle = cameraConfig.movement.minAngle;
    controls.maxPolarAngle = cameraConfig.movement.maxAngle;
};

const applyConfiguration = (config) => {
    currentConfig = JSON.parse(JSON.stringify(config));
    applyGalaxyConfiguration(config);
    applyCameraConfiguration(config);
    gui.updateDisplay();
};

let geometry = null
let material = null
let points = null

const generateGalaxy = () =>
{
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
    const randomness = new Float32Array(parameters.count * 3)
    const colors = new Float32Array(parameters.count * 3)
    const scales = new Float32Array(parameters.count * 1)

    const insideColor = new THREE.Color(parameters.insideColor)
    const outsideColor = new THREE.Color(parameters.outsideColor)

    for(let i = 0; i < parameters.count; i++)
    {
        const i3 = i * 3

        // Position
        const radius = Math.random() * parameters.radius

        const spinAngle = radius * parameters.spin
        const branchAngle = (i % parameters.branches) / parameters.branches * Math.PI * 2

        const randomX = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : - 1) * parameters.randomness * radius
        const randomY = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : - 1) * parameters.randomness * radius
        const randomZ = Math.pow(Math.random(), parameters.randomnessPower) * (Math.random() < 0.5 ? 1 : - 1) * parameters.randomness * radius

        positions[i3 + 0] = Math.cos(branchAngle + spinAngle) * radius
        positions[i3 + 1] = 0
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius

        randomness[i3 + 0] = randomX
        randomness[i3 + 1] = randomY
        randomness[i3 + 2] = randomZ

        // Color
        const mixedColor = insideColor.clone()
        mixedColor.lerp(outsideColor, radius / parameters.radius)

        colors[i3 + 0] = mixedColor.r
        colors[i3 + 1] = mixedColor.g
        colors[i3 + 2] = mixedColor.b

        // Scale
        scales[i] = Math.random()
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('aRandomness', new THREE.BufferAttribute(randomness, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))

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
            uSize: { value: 30 * renderer.getPixelRatio() }
        }
    })

    /**
     * Points
     */
    points = new THREE.Points(geometry, material)
    scene.add(points)
}

/**
 * Beat Info Display
 */
const beatInfo = document.createElement('div');
beatInfo.style.position = 'fixed';
beatInfo.style.bottom = '20px';
beatInfo.style.left = '20px';
beatInfo.style.color = 'white';
beatInfo.style.fontFamily = 'monospace';
beatInfo.style.fontSize = '12px';
beatInfo.style.pointerEvents = 'none';
document.body.appendChild(beatInfo);

const updateBeatInfo = () => {
    if (!audioSystem.isInitialized) return;
    
    const bpm = audioSystem.config.bpm;
    const currentBeat = audioSystem.currentBeat + 1;
    const totalBeats = 16;
    
    beatInfo.textContent = `BPM: ${bpm} | Beat: ${currentBeat}/${totalBeats}`;
};

/**
 * Animation Setup
 */
let clock = new THREE.Clock();

/**
 * Animation Loop
 */
function tick() {
    const elapsedTime = clock.getElapsedTime();

    // Update material
    if(material) {
        material.uniforms.uTime.value = elapsedTime;
    }

    // Animate camera if automation is enabled
    if (currentConfig && currentConfig.camera) {
        animateCamera();
    }

    // Update beat info
    if (typeof updateBeatInfo === 'function') {
        updateBeatInfo();
    }

    // Update controls
    if (controls) {
        controls.update();
    }

    // Render
    renderer.render(scene, camera);

    // Call tick again on the next frame
    window.requestAnimationFrame(tick);
}

/**
 * Settings Management
 */
const saveCurrentSettings = () => {
    return {
        name: `Custom-${Date.now()}`,
        galaxy: { ...parameters },
        camera: { ...currentConfig.camera }
    };
};

const copySettingsToClipboard = () => {
    const settings = saveCurrentSettings();
    const settingsString = JSON.stringify(settings, null, 2);
    navigator.clipboard.writeText(settingsString)
        .then(() => {
            console.log('Settings copied to clipboard');
            // Show feedback in status text
            statusText.textContent = '✅ Settings copied to clipboard';
            statusText.style.display = 'block';
            setTimeout(() => {
                statusText.style.display = 'none';
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy settings:', err);
            statusText.textContent = '❌ Failed to copy settings';
            statusText.style.display = 'block';
            setTimeout(() => {
                statusText.style.display = 'none';
            }, 2000);
        });
};

// Initialize GUI controls
const initializeGUI = () => {
    // Clear existing GUI
    gui.destroy();
    const newGui = new dat.GUI();

    // Galaxy controls
    const galaxyFolder = newGui.addFolder('Galaxy');
    galaxyFolder.add(parameters, 'count', 100, 1000000).step(100)
        .onFinishChange(() => {
            generateGalaxy();
            audioSystem.updateParams(parameters);
        });
    galaxyFolder.add(parameters, 'size', 0.001, 0.1).step(0.001)
        .onFinishChange(() => {
            generateGalaxy();
            audioSystem.updateParams(parameters);
        });
    galaxyFolder.add(parameters, 'radius', 0.01, 20).step(0.01)
        .onChange(() => {
            // Update audio immediately
            audioSystem.updateParams(parameters);
        })
        .onFinishChange(() => {
            // Only regenerate galaxy when finished to avoid performance issues
            generateGalaxy();
        });
    galaxyFolder.add(parameters, 'branches', 2, 20).step(1)
        .onChange(() => {
            // Update audio immediately
            audioSystem.updateParams(parameters);
        })
        .onFinishChange(() => {
            // Only regenerate galaxy when finished
            generateGalaxy();
        });
    galaxyFolder.add(parameters, 'spin', -5, 5).step(0.001)
        .onChange(() => {
            // Update audio immediately
            audioSystem.updateParams(parameters);
        })
        .onFinishChange(() => {
            // Only regenerate galaxy when finished
            generateGalaxy();
        });
    galaxyFolder.add(parameters, 'randomness', 0, 2).step(0.001)
        .onChange(() => {
            // Update audio immediately
            audioSystem.updateParams(parameters);
        })
        .onFinishChange(() => {
            // Only regenerate galaxy when finished
            generateGalaxy();
        });
    galaxyFolder.add(parameters, 'randomnessPower', 1, 10).step(0.001)
        .onFinishChange(() => {
            generateGalaxy();
            audioSystem.updateParams(parameters);
        });
    galaxyFolder.addColor(parameters, 'insideColor')
        .onFinishChange(() => {
            generateGalaxy();
            audioSystem.updateParams(parameters);
            updateUIColors(parameters.insideColor, parameters.outsideColor);
        });
    galaxyFolder.addColor(parameters, 'outsideColor')
        .onFinishChange(() => {
            generateGalaxy();
            audioSystem.updateParams(parameters);
            updateUIColors(parameters.insideColor, parameters.outsideColor);
        });

    // Camera controls
    const cameraControls = newGui.addFolder('Camera Controls');

    // Presets and Settings Management
    const presetsFolder = cameraControls.addFolder('Presets & Settings');
    const presetController = {
        currentPreset: currentConfig.name,
        copySettings: copySettingsToClipboard,
        saveToFile: () => {
            const settings = saveCurrentSettings();
            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `galaxy-preset-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    presetsFolder.add(presetController, 'currentPreset', cameraConfigs.map(config => config.name))
        .name('📋 Load Preset')
        .onChange((presetName) => {
            const config = cameraConfigs.find(c => c.name === presetName);
            if (config) {
                applyConfiguration(config);
            }
        });

    presetsFolder.add(presetController, 'copySettings').name('📝 Copy Settings');
    presetsFolder.add(presetController, 'saveToFile').name('💾 Save to File');

    // Basic controls
    const basicControls = cameraControls.addFolder('Basic Controls');
    basicControls.add(currentConfig.camera.basic, 'enableRotate').name('🖱️ Enable Rotation').onChange(value => {
        controls.enableRotate = value;
    });
    basicControls.add(currentConfig.camera.basic, 'enableZoom').name('🔍 Enable Zoom').onChange(value => {
        controls.enableZoom = value;
    });
    basicControls.add(currentConfig.camera.basic, 'enablePan').name('✋ Enable Panning').onChange(value => {
        controls.enablePan = value;
    });
    basicControls.add(currentConfig.camera.basic, 'smoothness', 0.01, 0.2).name('Smoothness').onChange(value => {
        controls.dampingFactor = value;
    });

    // Position controls
    const positionControls = cameraControls.addFolder('Position');
    positionControls.add(camera.position, 'x', -10, 10).name('X Position').onChange(() => {
        currentConfig.camera.position.x = camera.position.x;
        camera.lookAt(scene.position);
    });
    positionControls.add(camera.position, 'y', -10, 10).name('Y Position').onChange(() => {
        currentConfig.camera.position.y = camera.position.y;
        camera.lookAt(scene.position);
    });
    positionControls.add(camera.position, 'z', -10, 10).name('Z Position').onChange(() => {
        currentConfig.camera.position.z = camera.position.z;
        camera.lookAt(scene.position);
    });

    // Movement settings
    const movementSettings = cameraControls.addFolder('Movement Settings');
    movementSettings.add(currentConfig.camera.movement, 'autoRotate').name('🔄 Auto Rotate').onChange((value) => {
        controls.autoRotate = value;
    });
    movementSettings.add(currentConfig.camera.movement, 'rotationSpeed', 0.1, 10).name('Rotation Speed').onChange((value) => {
        controls.autoRotateSpeed = value;
    });
    movementSettings.add(currentConfig.camera.movement, 'zoomSpeed', 0.1, 3).name('Zoom Speed').onChange((value) => {
        controls.zoomSpeed = value;
    });
    movementSettings.add(currentConfig.camera.movement, 'minDistance', 1, 10).name('Min Distance').onChange((value) => {
        controls.minDistance = value;
    });
    movementSettings.add(currentConfig.camera.movement, 'maxDistance', 10, 50).name('Max Distance').onChange((value) => {
        controls.maxDistance = value;
    });
    movementSettings.add(currentConfig.camera.movement, 'minAngle', 0, Math.PI).name('Min Angle').onChange((value) => {
        controls.minPolarAngle = value;
    });
    movementSettings.add(currentConfig.camera.movement, 'maxAngle', 0, Math.PI).name('Max Angle').onChange((value) => {
        controls.maxPolarAngle = value;
    });

    // Automation controls
    const automationControls = cameraControls.addFolder('Auto Movement');
    automationControls.add(currentConfig.camera.automation, 'enabled')
        .name('🤖 Enable Auto Movement')
        .onChange(() => {
            // Reset animation state when enabling
            if (currentConfig.camera.automation.enabled) {
                animationState.time = 0;
                animationState.lastUpdate = Date.now();
            }
        });
    
    automationControls.add(currentConfig.camera.automation, 'path', ['circular', 'spiral', 'figure8'])
        .name('Movement Pattern')
        .onChange(() => {
            // Reset position when changing pattern
            camera.position.set(
                currentConfig.camera.position.x,
                currentConfig.camera.position.y,
                currentConfig.camera.position.z
            );
        });
    
    automationControls.add(currentConfig.camera.automation, 'pathSpeed', 0.1, 5)
        .name('Pattern Speed');

    const oscillationControls = automationControls.addFolder('Oscillation');
    oscillationControls.add(currentConfig.camera.automation.oscillation, 'enabled')
        .name('Enable Oscillation')
        .onChange(() => {
            if (!currentConfig.camera.automation.oscillation.enabled) {
                // Reset Y position when disabling oscillation
                camera.position.y = currentConfig.camera.position.y;
            }
        });
    oscillationControls.add(currentConfig.camera.automation.oscillation, 'amplitude', 0.1, 5)
        .name('Amplitude');
    oscillationControls.add(currentConfig.camera.automation.oscillation, 'frequency', 0.1, 2)
        .name('Frequency');

    const zoomControls = automationControls.addFolder('Auto Zoom');
    zoomControls.add(currentConfig.camera.automation.zoom, 'enabled')
        .name('Enable Auto Zoom')
        .onChange(() => {
            if (!currentConfig.camera.automation.zoom.enabled) {
                // Reset camera distance when disabling zoom
                const direction = camera.position.clone().normalize();
                const distance = (currentConfig.camera.movement.minDistance + currentConfig.camera.movement.maxDistance) * 0.5;
                camera.position.copy(direction.multiplyScalar(distance));
            }
        });
    zoomControls.add(currentConfig.camera.automation.zoom, 'min', 1, 10)
        .name('Min Zoom')
        .onChange(value => {
            if (value >= currentConfig.camera.automation.zoom.max) {
                currentConfig.camera.automation.zoom.min = currentConfig.camera.automation.zoom.max - 1;
                gui.updateDisplay();
            }
        });
    zoomControls.add(currentConfig.camera.automation.zoom, 'max', 11, 30)
        .name('Max Zoom')
        .onChange(value => {
            if (value <= currentConfig.camera.automation.zoom.min) {
                currentConfig.camera.automation.zoom.max = currentConfig.camera.automation.zoom.min + 1;
                gui.updateDisplay();
            }
        });
    zoomControls.add(currentConfig.camera.automation.zoom, 'speed', 0.1, 2)
        .name('Zoom Speed');

    // Reset button
    cameraControls.add({
        reset: () => {
            applyConfiguration(cameraConfigs[0]); // Reset to default configuration
            presetController.currentPreset = "Default";
            initializeGUI(); // Reinitialize GUI with default values
        }
    }, 'reset').name('🔄 Reset Camera');

    return newGui;
};

// Initialize with default configuration and GUI
applyConfiguration(cameraConfigs[0]);
gui = initializeGUI();

// Start animation loop
tick();

// Handle window resize
window.addEventListener('resize', () => {
    // Update sizes
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Update camera
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Update renderer
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// Add after the existing updateUIColors function
let currentPresetIndex = 0;

const updatePresetDisplay = () => {
    const presetName = cameraConfigs[currentPresetIndex].name;
    document.getElementById('currentPreset').textContent = presetName;
};

const switchPreset = (direction) => {
    const totalPresets = cameraConfigs.length;
    currentPresetIndex = (currentPresetIndex + direction + totalPresets) % totalPresets;
    const newPreset = cameraConfigs[currentPresetIndex];
    applyConfiguration(newPreset);
    updatePresetDisplay();
};

// Add to the end of the file, just before the last closing brace
// Initialize preset switcher controls
document.getElementById('prevPreset').addEventListener('click', () => switchPreset(-1));
document.getElementById('nextPreset').addEventListener('click', () => switchPreset(1));

// Add keyboard controls for preset switching
document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
        switchPreset(-1);
    } else if (event.key === 'ArrowRight') {
        switchPreset(1);
    }
});

// Initialize the preset display
updatePresetDisplay();

// Timer functionality
function updateTimer() {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const hours = now.getUTCHours();
    const minutes = now.getUTCMinutes();
    
    // Calculate next Tuesday 17:00 UTC+2
    let nextMeeting = new Date(now);
    nextMeeting.setUTCHours(15, 0, 0, 0); // 17:00 UTC+2 = 15:00 UTC
    
    // Adjust to next Tuesday
    const daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
    nextMeeting.setUTCDate(nextMeeting.getUTCDate() + daysUntilTuesday);
    
    // If it's Tuesday after 17:00 UTC+2, move to next week
    if (dayOfWeek === 2 && hours >= 15) {
        nextMeeting.setUTCDate(nextMeeting.getUTCDate() + 7);
    }
    
    const diff = nextMeeting - now;
    const diffMinutes = diff / (1000 * 60);
    const meetingInProgress = dayOfWeek === 2 && hours >= 15 && hours < 17;
    
    const timerElement = document.querySelector('.countdown-timer');
    const meetButton = document.querySelector('.modern-button');
    const meetLink = 'https://meet.google.com/svb-xcme-opq';

    // Keep all existing countdown-timer logic
    if (meetingInProgress) {
        // Count up during the meeting
        const meetingStart = new Date(now);
        meetingStart.setUTCHours(15, 0, 0, 0);
        const elapsed = now - meetingStart;
        const elapsedHours = Math.floor(elapsed / 3600000);
        const elapsedMinutes = Math.floor((elapsed % 3600000) / 60000);
        const elapsedSeconds = Math.floor((elapsed % 60000) / 1000);
        const elapsedMs = elapsed % 1000;
        
        const timeStr = `${String(elapsedHours).padStart(2, '0')}:${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;
        timerElement.innerHTML = `<b>LIVE</b> ${timeStr}<span class="milliseconds">.${String(elapsedMs).padStart(3, '0')}</span>`;
        
        // Update button during meeting
        meetButton.textContent = 'JOIN NOW!';
        meetButton.href = meetLink;
    } else {
        // Countdown to next meeting
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        const ms = diff % 1000;

        let timeStr = '';
        if (days > 0) {
            timeStr = `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
        } else if (hours > 0) {
            timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }

        timerElement.innerHTML = `<b>NEXT MEETING:</b> ${timeStr}<span class="milliseconds">.${String(ms).padStart(3, '0')}</span>`;

        // Update button based on time until meeting
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
            // Generate Google Calendar link
            const endMeeting = new Date(nextMeeting);
            endMeeting.setUTCHours(endMeeting.getUTCHours() + 2); // 2 hour duration
            
            const eventDetails = encodeURIComponent(
                'OVERVIBING - When Humans and AI get lost together in the VIBE CODING flow.\n\n' +
                '🗓 Every Tuesday\n' +
                '🕔 17:00 – 18:00 (Europe/Paris)\n' +
                '📍 Google Meet → https://meet.google.com/svb-xcme-opq\n\n' +
                '⸻\n\n' +
                '🎯 Purpose\n\n' +
                'A weekly meeting to examine what really happens when AI becomes part of the development process.\n\n' +
                'We focus on:\n' +
                '	•	What goes wrong when AI-generated code or flow-based work causes misalignment\n' +
                '	•	How to detect early signs of confusion, lost context, and overdependence on tooling\n' +
                '	•	What practical steps teams can take to stay in control — through boundaries, checks, and better habits\n\n' +
                'No hype — just a space to talk through real examples and avoid common traps.\n\n' +
                '🔍 Definitions\n\n' +
                'VIBE-CODING → Coding with AI in a fast, creative flow that feels productive.\n' +
                'OVER-VIBING → Losing clarity, structure, or intent by going too deep into flow without critical checkpoints.\n\n' +
                '⸻\n\n' +
                '— Michael\n' +
                'one-front.com'
            );
            
            const calendarLink = 
                'https://calendar.google.com/calendar/render' +
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

// Add keyboard controls for audio manipulation
document.addEventListener('keydown', (event) => {
    if (!audioSystem.isInitialized) return;
    
    switch(event.code) {
        case 'Space':
            event.preventDefault();
            if (audioSystem.isPlaying) {
                audioSystem.stop();
                statusText.textContent = '🎵 Audio paused';
                statusText.style.display = 'block';
            } else {
                audioSystem.start();
                statusText.textContent = '🎵 Audio playing';
                statusText.style.display = 'block';
            }
            setTimeout(() => {
                statusText.style.display = 'none';
            }, 3000);
            break;
            
        case 'KeyM':
            event.preventDefault();
            if (audioSystem.masterGain) {
                const currentVolume = audioSystem.config.volume;
                audioSystem.config.volume = currentVolume > 0 ? 0 : 0.3;
                audioSystem.masterGain.gain.setValueAtTime(
                    audioSystem.config.volume, 
                    audioSystem.audioContext.currentTime
                );
                statusText.textContent = audioSystem.config.volume > 0 ? '🔊 Unmuted' : '🔇 Muted';
                statusText.style.display = 'block';
                setTimeout(() => {
                    statusText.style.display = 'none';
                }, 3000);
            }
            break;
        
        // Manual sound triggers
        case 'KeyZ':
        case 'KeyA':
            event.preventDefault();
            if (audioSystem.isInitialized) {
                const currentTime = audioSystem.audioContext.currentTime;
                const bass = audioSystem.createBass();
                bass.osc.frequency.setValueAtTime(audioSystem.config.bassFreq, currentTime);
                bass.osc.start(currentTime);
                bass.gain.gain.setValueAtTime(0.4, currentTime);
                bass.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.5);
                bass.osc.stop(currentTime + 0.5);
            }
            break;
            
        case 'KeyX':
        case 'KeyS':
            event.preventDefault();
            if (audioSystem.isInitialized) {
                const currentTime = audioSystem.audioContext.currentTime;
                const lead = audioSystem.createLead();
                lead.osc.frequency.setValueAtTime(audioSystem.config.leadFreq, currentTime);
                lead.osc.start(currentTime);
                lead.gain.gain.setValueAtTime(0.3, currentTime);
                lead.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 1.5);
                lead.osc.stop(currentTime + 1.5);
            }
            break;
            
        case 'KeyC':
        case 'KeyD':
            event.preventDefault();
            if (audioSystem.isInitialized) {
                const currentTime = audioSystem.audioContext.currentTime;
                const pad = audioSystem.createPad();
                pad.osc.frequency.setValueAtTime(audioSystem.config.padFreq, currentTime);
                pad.osc.start(currentTime);
                pad.gain.gain.setValueAtTime(0.15, currentTime);
                pad.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 4.0);
                pad.osc.stop(currentTime + 4.0);
            }
            break;
            
        case 'KeyV':
        case 'KeyF':
            event.preventDefault();
            if (audioSystem.isInitialized) {
                const currentTime = audioSystem.audioContext.currentTime;
                const kick = audioSystem.createKick();
                kick.osc.start(currentTime);
                kick.gain.gain.setValueAtTime(0.6, currentTime);
                kick.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.2);
                kick.osc.stop(currentTime + 0.2);
            }
            break;
            
        case 'KeyB':
        case 'KeyG':
            event.preventDefault();
            if (audioSystem.isInitialized) {
                const currentTime = audioSystem.audioContext.currentTime;
                const hihat = audioSystem.createHihat();
                hihat.source.start(currentTime);
                hihat.gain.gain.setValueAtTime(0.2, currentTime);
                hihat.gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.1);
            }
            break;
    }
}); 
