attribute vec4 inputPosition; 
attribute vec3 inputNormal;

uniform mat4 projection;
uniform mat4 modelview;

varying mediump vec4 position;
varying mediump vec3 normal;

void main() { 
    position = modelview * inputPosition;
    normal = normalize((modelview * vec4(inputNormal, 0.0)).xyz);
    gl_Position = projection * position;
}