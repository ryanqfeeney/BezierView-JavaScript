function mat4(from) {
	if (from) {
		this.m = new Float32Array(from.m);
	} else {
		this.m = new Float32Array(16);
		this.identity();
	}
}

mat4.prototype.identity = function() {
	for(var i = 0; i < 4; i++) {
		for(var j = 0; j < 4; j++) {
			this.m[i*4+j] = i == j ? 1.0 : 0.0;
		}
	}
};

mat4.prototype.rotateAxis = function(angle, axis0, axis1) {
	var mi0, mi1, i, c, s, a0, a1;
	a0 = axis0 | 0, a1 = axis1 | 0;
	/* go row by row and apply the matrix multiply */
	c = Math.cos(angle), s = Math.sin(angle);
	for(i = 0; i < 4; i++) {
		mi0 = this.m[i * 4 + a0];
		mi1 = this.m[i * 4 + a1];
		this.m[i * 4 + a0] = c * mi0 - s * mi1;
		this.m[i * 4 + a1] = s * mi0 + c * mi1;
	}
};

mat4.prototype.rotateXYZ = function(rot) {
	this.rotateAxis(rot[1], 2, 0);
	this.rotateAxis(rot[0], 1, 2);
	this.rotateAxis(rot[2], 0, 1);
};

mat4.prototype.scale = function(x, y, z) {
	for (var i = 0; i < 4; ++i) {
		this.m[i] *= x;
		this.m[4 + i] *= y;
		this.m[8 + i] *= z;
	}
};

mat4.prototype.translate = function(x, y, z) {
	this.m[12] = x;
	this.m[13] = y;
	this.m[14] = z;
};

mat4.prototype.duplicate = function() {
	var other = new mat4();
	for (var i = 0; i < 16; ++i) {
		other.m[i] = this.m[i];
	}
	return other;
};
