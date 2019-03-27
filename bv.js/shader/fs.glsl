#extension GL_OES_standard_derivatives : enable

precision highp float;
varying vec4 position;
varying vec3 normal;

uniform vec4 diffuse;
uniform float clipAmt;
uniform bool flatShading;
uniform bool flipNormals;
uniform vec3 lightsOn;

const vec4 lightIntensity = vec4(1.0,1.0,1.0,1.0);
const mat3 dirToLight = mat3(1,-1,1, -2.0,0,0, 0,1.5,0.1);
const vec3 eye = vec3(0,0,1);

void main() {
	if (clipAmt != -55.0 && position.z < clipAmt) discard;
	vec3 n;
	if (flatShading) {
		vec3 U = dFdx(position.xyz);
		vec3 V = dFdy(position.xyz);
		n = normalize(cross(U,V));
	} else {
		n = normalize(normal);
	}
	
	if (flipNormals) {
		n *= vec3(-1,-1,-1);
	}
	float dI = 0.0;
	float sI = 0.0;
	for (int i = 0; i < 3; ++i) {
		if (lightsOn[i] != 0.0) {
			dI += clamp(dot( n, dirToLight[i]), 0.0, 1.0);
			sI += pow(clamp(dot( n, normalize((dirToLight[i] + eye) / 2.0)), 0.0, 1.0), 15.0);
		}
	}
	gl_FragColor = lightIntensity * diffuse * vec4(dI, dI, dI, 1.0) * 0.8
				+ lightIntensity * vec4(sI, sI, sI, 1.0) * diffuse * 0.5 + diffuse * 0.4;;

}


