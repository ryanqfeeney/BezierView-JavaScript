precision highp float;
varying vec4 position;
varying vec3 normal;
varying vec3 vColor;

uniform vec4 diffuse;
uniform float clipAmt;

const vec4 lightIntensity = vec4(1.0,1.0,1.0,1.0);
const vec3 dirToLight = vec3(1,-1,1);
const vec3 eye = vec3(0,0,1);

void main() {
	if (clipAmt != -55.0 && position.z < clipAmt) discard;
	if (diffuse == vec4(0.0,0.0,0.0,1.0)) {
		gl_FragColor = vec4(0.0,0.0,0.0,1.0);
	} else {
		gl_FragColor = vec4(vColor, 1.0);
	}
}
