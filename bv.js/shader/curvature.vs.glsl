attribute vec4 inputPosition;
attribute vec3 inputNormal;
attribute vec4 crv;

uniform mat4 projection;
uniform mat4 modelview;

uniform int crvMode;
uniform vec4 maxCrv;
uniform vec4 minCrv;

varying vec3 vColor;

varying mediump vec4 position;
varying mediump vec3 normal;

vec3 crv2color(vec4 curvature) {
	float maxc, minc, c;
	vec3 colors[5];
	colors[0] = vec3(0.0, 0.0, 0.85); // blue 
	colors[1] = vec3(0.0, 0.9, 0.9);   // cyan
	colors[2] = vec3(0.0, 0.75, 0.0); // green 
	colors[3] = vec3(0.9, 0.9, 0.0);   // yellow 
	colors[4] = vec3(0.85, 0.0, 0.0); // red 
	
	if (crvMode == 0) {
		maxc = maxCrv.x;
		minc = minCrv.x;
		c = curvature.x;
	} else if (crvMode == 1) {
		maxc = maxCrv.y;
		minc = minCrv.y;
		c = curvature.y;
	} else if (crvMode == 2) {
		maxc = maxCrv.z;
		minc = minCrv.z;
		c = curvature.z;
	} else if (crvMode == 3) {
		maxc = maxCrv.w;
		minc = minCrv.w;
		c = curvature.w;
	}
	
	if (abs(maxc - minc) < 0.00001) {
		c = 0.5;
	} else if (c > maxc) {
		c = 1.0;
	} else {
		if (c < minc) {
			c = 0.0;
		 } else {
			c = (c - minc) / (maxc - minc);
		 }
	}
	
	if (c > 1.0)
		return colors[4];
	else if (c > 0.75)
		return (c - 0.75) / 0.25 * colors[4] + (1.0 - c) / 0.25 * colors[3];
	else if (c > 0.5)
		return (c - 0.5) / 0.25 * colors[3] + (0.75 - c) / 0.25 * colors[2];
	else if (c > 0.25)
		return (c - 0.25) / 0.25 * colors[2] + (0.5 - c) / 0.25 * colors[1];
	else if (c > 0.0)
		return (c) / 0.25 * colors[1] + (0.25 - c ) / 0.25 * colors[0];
	return colors[0];
}

void main() { 
    position = modelview * inputPosition;
    normal = normalize((modelview * vec4(inputNormal, 0.0)).xyz);
	
	vColor = crv2color(crv);
	
    gl_Position = projection * position;
}