precision highp float;

varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vColor;

varying float vSegment;
varying float vInstance;

#define MAX_BOXES 100

uniform mat4 bboxInv[MAX_BOXES];
uniform vec3 bboxColor[MAX_BOXES];
uniform int bboxCount;
uniform int showNormals;
uniform int coloringMode;
uniform vec3 cloudMin;
uniform vec3 cloudMax;

vec3 hsv2rgb(vec3 c)
{
    vec3 rgb = clamp(
        abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0),6.0) - 3.0) - 1.0,
        0.0,
        1.0
    );

    return c.z * mix(vec3(1.0), rgb, c.y);
}


vec3 colorByAxis(int axisMode)
{
    float axisValue;

    if(axisMode == 0)
        axisValue = (vPosition.x - cloudMin.x) / (cloudMax.x - cloudMin.x);

    else if(axisMode == 1)
        axisValue = (vPosition.y - cloudMin.y) / (cloudMax.y - cloudMin.y);

    else
        axisValue = (vPosition.z - cloudMin.z) / (cloudMax.z - cloudMin.z);

    axisValue = clamp(axisValue,0.0,1.0);

    vec3 color = hsv2rgb(vec3(axisValue,1.0,1.0));
    return color;
}


void main() {
    vec3 color;
    if (coloringMode == 1){
        color = colorByAxis(0);
    }
    else if(coloringMode == 2){
        color = colorByAxis(1);
    }
    else if(coloringMode == 3){
        color = colorByAxis(2);
    }
    else if(coloringMode == 4){
        color= vColor;
    }
    else if(coloringMode == 5){
        color= vNormal;
    }

    else if (coloringMode == 6) {
        // semantic segmentation
        float s = vSegment;

        // simple stable palette
        color = hsv2rgb(vec3(fract(s * 0.15), 0.8, 1.0));
    }
    else if (coloringMode == 7) {
        // instance coloring
        float i = vInstance;

        // different hash → different distribution
        color = hsv2rgb(vec3(fract(i * 0.618), 0.9, 1.0));
    }


    else{

        color = vec3(0.5,0.5,0.5);

        for(int i=0;i<MAX_BOXES;i++){

            if(i >= bboxCount) break;

            vec4 p = bboxInv[i] * vec4(vPosition,1.0);

            if(
                abs(p.x) <= 0.5 &&
                abs(p.y) <= 0.5 &&
                abs(p.z) <= 0.5
            ){
                color = bboxColor[i];
            }
        }
    }

    // simple lighting

    if (showNormals == 1){
        vec3 lightDir = normalize(vec3(0.8, 1.0,0.6));

        float diffuse = max(dot(normalize(vNormal), lightDir), 0.1);

        color *= diffuse * 0.8 + 0.2;
    }

    gl_FragColor = vec4(color,1.0);
}
