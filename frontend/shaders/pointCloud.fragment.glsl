precision highp float;

varying vec3 vPosition;
varying vec3 vNormal;


#define MAX_BOXES 32

uniform mat4 bboxInv[MAX_BOXES];
uniform vec3 bboxColor[MAX_BOXES];
uniform int bboxCount;


void main() {

    vec3 color = vec3(0.5,0.5,0.5);

    for(int i=0;i<MAX_BOXES;i++){

        if(i >= bboxCount) break;

        vec4 p = bboxInv[i] * vec4(vPosition,1.0);

        if(
            abs(p.x) <= 2.5 &&
            abs(p.y) <= 2.5 &&
            abs(p.z) <= 2.5
        ){
            color = bboxColor[i];
        }
    }

    // simple lighting
    vec3 lightDir = normalize(vec3(0.8, 1.0,0.6));

    float diffuse = max(dot(normalize(vNormal), lightDir), 0.1);

    color *= diffuse * 0.8 + 0.2;

    gl_FragColor = vec4(color,1.0);
}
