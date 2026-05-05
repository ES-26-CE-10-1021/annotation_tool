precision highp float;

attribute vec3 position;
attribute vec3 normal;
attribute vec3 color;
attribute vec3 custom;

uniform mat4 world;
uniform mat4 worldViewProjection;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vColor;

varying float vSegment;
varying float vInstance;

uniform float pointSize;

void main() {

    vec4 worldPos = world * vec4(position,1.0);
    vPosition = worldPos.xyz;

    vNormal = normalize(mat3(world) * normal);
    
    vColor=color;
    
    vSegment = custom[0];
    vInstance = custom[1];

    // vPosition = position;

    gl_Position = worldViewProjection * vec4(position,1.0);

    gl_PointSize = pointSize;

}
