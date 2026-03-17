precision highp float;

attribute vec3 position;
attribute vec3 normal;

uniform mat4 world;
uniform mat4 worldViewProjection;

varying vec3 vPosition;
varying vec3 vNormal;

uniform float pointSize;

void main() {

    vec4 worldPos = world * vec4(position,1.0);
    vPosition = worldPos.xyz;

    vNormal = normalize(mat3(world) * normal);


    vPosition = position;

    gl_Position = worldViewProjection * vec4(position,1.0);

    gl_PointSize = pointSize;

}
