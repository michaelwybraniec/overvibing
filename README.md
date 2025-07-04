# Overvibing - Meeting Page

> **An immersive 3D galaxy visualization with audio** - Built with Three.js and GLSL shaders, inspired by [Galaxy-M2999](https://github.com/the-halfbloodprince/Galaxy-M2999)

[![Live Demo](https://img.shields.io/badge/Demo-Live-brightgreen)](https://michaelwybraniec.github.io/overvibing/)
[![Three.js](https://img.shields.io/badge/Three.js-r132-blue)](https://threejs.org/)
[![WebGL](https://img.shields.io/badge/WebGL-Enabled-orange)](https://webgl.org/)
[![GLSL](https://img.shields.io/badge/GLSL-Shaders-purple)](https://www.khronos.org/opengl/wiki/OpenGL_Shading_Language)

## 🌟 Features

- **Real-time galaxy generation** with thousands of particles
- **Immersive audio experience** with play/pause controls
- **Custom UI elements** including a modern play/pause button
- **Responsive design** that works across devices
- **Beautiful particle effects** with custom shaders
- **Spiral emoji favicon** for brand recognition

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

- **Mouse Movement**: Interact with the galaxy visualization
- **Play/Pause Button**: Control the audio experience
- **Automatic Audio**: Starts after first user interaction

## 🔧 Configuration

The application uses a configuration system for various parameters including:
- Particle counts and properties
- Galaxy formation settings
- Audio settings
- Visual effects

## 🛠️ Development

### Key Components
- **Three.js** for 3D visualization
- **WebGL** and **GLSL Shaders** for particle effects
- **Web Audio API** for sound management
- **Webpack** for bundling and development

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

### Requirements
- Modern browser with WebGL support
- Audio capabilities
- JavaScript enabled

## 🚀 Deployment

The application is deployed to GitHub Pages and can be accessed at:
[https://michaelwybraniec.github.io/overvibing/](https://michaelwybraniec.github.io/overvibing/)

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Galaxy-M2999](https://github.com/the-halfbloodprince/Galaxy-M2999) - Base inspiration
- Three.js Community - Documentation and examples
- WebGL and GLSL - Enabling real-time 3D graphics

---

*Built with ❤️ by Michael Wybraniec* 