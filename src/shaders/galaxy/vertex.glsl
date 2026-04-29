uniform float uTime;
uniform float uSize;
uniform float uHoverIntensity;
uniform float uHoverSizeMultiplier;
uniform float uHoverSpinMultiplier;
uniform float uHoverBrightnessMultiplier;
uniform float uSpinDirection;
uniform float uNormalRotationSpeed;
uniform float uRotationOffset;
uniform float uGalaxyHoverMix;
uniform float uHoverSize;
uniform float uHoverNormalRotationSpeed;

attribute float aScale;
attribute float aHoverScale;
attribute vec3 aHoverPosition;
attribute vec3 aHoverColor;
attribute vec3 aRandomness;
attribute vec3 aHoverRandomness;

varying vec3 vColor;
varying float vHoverIntensity;

void main()
{
    /**
     * Position
     */
    vec3 configuredPosition = mix(position, aHoverPosition, uGalaxyHoverMix);
    vec4 modelPosition = modelMatrix * vec4(configuredPosition, 1.0);
    
    // Galaxy spiral effect - original logic with vinyl spin integration
    float angle = atan(modelPosition.x, modelPosition.z);
    float distanceToCenter = length(modelPosition.xz);
    
    // Determine rotation speed based on vinyl spin or normal rotation
    float rotationSpeed;
    if (uHoverSpinMultiplier > 1.0) {
        // Vinyl spin effect - fast rotation
        rotationSpeed = 0.2 * uHoverSpinMultiplier * uSpinDirection;
    } else {
        // Normal galaxy rotation with offset to maintain continuity
        rotationSpeed = mix(uNormalRotationSpeed, uHoverNormalRotationSpeed, uGalaxyHoverMix) * uSpinDirection;
    }
    
    // Create spiral effect where inner particles rotate faster
    // Include a persistent rotation phase offset to preserve continuity
    float rotationPhase = uTime * rotationSpeed + uRotationOffset;
    float angleOffset = (1.0 / distanceToCenter) * rotationPhase;
    angle += angleOffset;
    
    // Reconstruct position with new angle
    modelPosition.x = cos(angle) * distanceToCenter;
    modelPosition.z = sin(angle) * distanceToCenter;
    
    // Blend config-driven galaxy shape without rebuilding geometry on hover.
    modelPosition.xyz += mix(aRandomness, aHoverRandomness, uGalaxyHoverMix);

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    /**
     * Size with hover effect
     */
    float configuredSize = mix(uSize, uHoverSize, uGalaxyHoverMix);
    float configuredScale = mix(aScale, aHoverScale, uGalaxyHoverMix);
    gl_PointSize = configuredSize * configuredScale * uHoverSizeMultiplier;
    gl_PointSize *= (1.0 / - viewPosition.z);

    /**
     * Color and hover intensity
     */
    vColor = mix(color, aHoverColor, uGalaxyHoverMix);
    vHoverIntensity = uHoverIntensity;
} 