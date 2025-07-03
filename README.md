# OVERVIBING - Cyberpunk Galaxy Experience

> **Epic cyberpunk 3D tunnel intro leading to "OVERVIBING" text** - Built with advanced Three.js and GLSL shaders, inspired by [Galaxy-M2999](https://github.com/the-halfbloodprince/Galaxy-M2999)

[![Live Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://your-demo-link.com)
[![Three.js](https://img.shields.io/badge/Three.js-r132-blue)](https://threejs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-Enabled-orange)](https://webgl.org/)
[![GLSL](https://img.shields.io/badge/GLSL-Shaders-purple)](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)

## 🌟 Features

### Galaxy-M2999 Architecture
- **Professional bundler setup** with Webpack 5
- **Modular GLSL shaders** for advanced visual effects
- **Real-time galaxy generation** with 100,000+ particles
- **DAT.GUI controls** for real-time parameter tuning
- **Advanced particle systems** with custom attributes

### Visual Effects
- **Procedural galaxy generation** with spiral arms and realistic physics
- **Cyberpunk tunnel** with animated circuit patterns and data streams
- **Dynamic shader effects** using Simplex noise and procedural generation
- **Multi-layered particle systems** (Galaxy: 8K + Streams: 20K particles)
- **ACES Filmic tone mapping** for cinematic quality
- **Responsive mouse controls** with smooth camera interpolation

### Audio Experience
- **Multi-oscillator procedural audio** with real-time modulation
- **Phase-synchronized sound design** matching visual transitions
- **Web Audio API** for immersive cyberpunk soundscape

### Performance
- **Optimized rendering** with efficient geometry and materials
- **Adaptive quality** based on device capabilities
- **Smooth 60fps experience** on modern hardware

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm install

# Start development server (with hot reload)
npm run dev

# Open http://localhost:8080 in your browser
```

### Production Build
```bash
# Build for production
npm run build

# Deploy to GitHub Pages
npm run deploy
```

## 🏗️ Project Structure

```
overvibing/
├── bundler/                 # Webpack configuration
│   ├── webpack.common.js    # Common webpack settings
│   ├── webpack.dev.js       # Development configuration
│   └── webpack.prod.js      # Production configuration
├── src/                     # Source code
│   ├── shaders/            # GLSL shader files
│   │   ├── galaxy/         # Galaxy particle shaders
│   │   │   ├── vertex.glsl
│   │   │   └── fragment.glsl
│   │   └── tunnel/         # Tunnel effect shaders
│   │       ├── vertex.glsl
│   │       └── fragment.glsl
│   ├── index.html          # Main HTML template
│   ├── style.css           # Cyberpunk UI styles
│   └── script.js           # Main application code
├── static/                 # Static assets
├── dist/                   # Production build output
└── package.json           # Dependencies and scripts
```

## 🎮 Controls

### Galaxy Controls
- **Mouse Movement**: Camera control and perspective shift
- **Galaxy Controls Button**: Toggle real-time parameter editing
- **DAT.GUI Panel**: Fine-tune galaxy generation parameters
  - Particle count (100-200,000)
  - Galaxy radius and branches
  - Spin and randomness factors
  - Color gradients

### Experience Phases
1. **Initialization** - Loading and system setup
2. **Galaxy Formation** - Procedural galaxy generation
3. **OVERVIBING** - Final text reveal with full effects

## 🔧 Configuration

### Performance Tuning
Edit `CONFIG` object in `src/script.js`:

```javascript
const CONFIG = {
    // Particle counts (adjust for performance)
    GALAXY_PARTICLES: 8000,      // Galaxy particles
    STREAM_PARTICLES: 20000,     // Stream particles
    TUNNEL_SEGMENTS: 604,        // Tunnel geometry detail
    
    // Animation speeds
    TUNNEL_SPEED: 9.015,         // Tunnel animation speed
    GALAXY_ROTATION: 9.001,      // Galaxy rotation speed
    TEXT_FADE_SPEED: 9.015,      // Text transition speed
    
    // Galaxy generation parameters
    GALAXY: {
        COUNT: 100000,           // Total galaxy particles
        BRANCHES: 3,             // Spiral arm count
        SPIN: 1,                 // Spiral tightness
        RANDOMNESS: 0.2,         // Particle scatter
        // ... more parameters
    }
};
```

### Color Palette
```javascript
COLORS: {
    primary: 0x00ffff,      // Cyan
    secondary: 0xff00ff,    // Magenta  
    accent: 0x00ff00,       // Green
    electricBlue: 0x0080ff, // Electric Blue
    neonPink: 0xff1493,     // Neon Pink
    // ... more colors
}
```

## 🛠️ Development

### Adding New Shaders
1. Create shader files in `src/shaders/[system]/`
2. Import in `script.js`: `import myShader from './shaders/my/shader.glsl'`
3. Use in ShaderMaterial: `vertexShader: myShader`

### Extending the Galaxy
The `AdvancedGalaxy` class supports real-time parameter editing:
- Modify `CONFIG.GALAXY` for default settings
- Use DAT.GUI for live tweaking
- Custom attributes: `aScale`, `aRandomness` for per-particle effects

### Performance Optimization
- Adjust particle counts in CONFIG
- Use `geometry.setAttribute()` for custom attributes
- Implement LOD (Level of Detail) for distant objects
- Profile with browser dev tools

## 🎨 Visual Techniques

### GLSL Shaders
- **Procedural noise** for organic patterns
- **Vertex displacement** for wave effects
- **Fragment patterns** for circuit aesthetics
- **Time-based animations** for dynamic effects

### Particle Systems
- **BufferGeometry** for efficient rendering
- **Custom attributes** for per-particle properties
- **Additive blending** for glowing effects
- **Point sprites** for star-like particles

## 🔊 Audio System

### Web Audio API Features
- **Multiple oscillators** for rich soundscape
- **Dynamic filtering** with real-time modulation
- **Phase-locked audio** synchronized with visuals
- **Procedural generation** for endless variations

## 📱 Browser Support

### Minimum Requirements
- **WebGL 1.0** support
- **ES6** compatibility
- **Web Audio API** for sound
- **Modern browser** (Chrome 60+, Firefox 55+, Safari 12+)

### Recommended
- **WebGL 2.0** for enhanced performance
- **Hardware acceleration** enabled
- **4GB+ RAM** for smooth operation
- **Dedicated GPU** for best experience

## 🚀 Deployment

### GitHub Pages
```bash
npm run deploy
```

### Manual Deployment
```bash
npm run build
# Upload dist/ folder to your hosting provider
```

### Environment Variables
Create `.env` file for custom settings:
```env
PUBLIC_URL=/overvibing
NODE_ENV=production
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-effect`
3. Commit changes: `git commit -m 'Add amazing visual effect'`
4. Push to branch: `git push origin feature/amazing-effect`
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Galaxy-M2999](https://github.com/the-halfbloodprince/Galaxy-M2999)** - Professional Three.js architecture inspiration
- **[Bruno Simon](https://threejs-journey.com/)** - Three.js Journey techniques
- **Three.js Community** - Excellent documentation and examples
- **WebGL and GLSL** - Enabling real-time 3D graphics in browsers

## 🌌 Experience the OVERVIBING

Transform your browser into a cyberpunk galaxy portal. Witness the birth of stars, navigate through digital dimensions, and emerge into the OVERVIBING realm.

**Ready to dive into the matrix?** 🚀

---

*Built with ❤️ and lots of caffeine by the OVERVIBING Team* 