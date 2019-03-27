precision highp float;
varying vec4 position;
varying vec3 normal;

uniform vec4 diffuse;
uniform float clipAmt;
uniform float highlightDensity;
uniform bool flipNormals;
uniform vec3 lightsOn;

const vec4 lightIntensity = vec4(1.0,1.0,1.0,1.0);
const mat3 dirToLight = mat3(1,-1,1, -2.0,0,0, 0,1.5,0.1);
const vec3 eye = vec3(0,0,1);
const float ambient = 0.4;
const float resolution = 20.0;

void main() {
	if (clipAmt != -55.0 && position.z < clipAmt) discard;
	vec3 n = normalize(normal);
	if (flipNormals) {
		n *= vec3(-1,-1,-1);
	}
	float highlight = fract(dot( n, dirToLight[0]) * resolution * highlightDensity) > .5 ? 0.5 : 1.0;
	float dI = 0.0;
	float sI = 0.0;
	for (int i = 0; i < 3; ++i) {
		if (lightsOn[i] != 0.0) {
			dI += clamp(dot( n, dirToLight[i]), 0.0, 1.0);
			sI += pow(clamp(dot( n, normalize((dirToLight[i] + eye) / 2.0)), 0.0, 1.0), 15.0);
		}
	}
	gl_FragColor =
		( (vec4(dI, dI, dI, 1.0) * 0.8 + vec4(sI, sI, sI, 1.0) * 0.5) * lightIntensity
		  + vec4(ambient,ambient,ambient,1.0)
		  ) * diffuse * highlight;
}
