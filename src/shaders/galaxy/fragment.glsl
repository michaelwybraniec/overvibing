varying vec3 vColor;
varying float vHoverIntensity;

uniform float uHoverBrightnessMultiplier;

void main()
{
    // Light point pattern
    float strength = distance(gl_PointCoord, vec2(0.5));
    strength = 1.0 - strength;
    strength = pow(strength, 10.0);

    // Apply brightness multiplier for button hover effects
    vec3 baseColor = vColor * uHoverBrightnessMultiplier;

    // Final color
    vec3 color = mix(vec3(0.0), baseColor, strength);
    gl_FragColor = vec4(color, 1.0);
} 