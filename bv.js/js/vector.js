function vec4(x,y,z,w) {
	//this.v = new Float32Array([x,y,z,w]);
	this.x = x;
	this.y = y;
	this.z = z;
	this.w = w;
	this.length = 0;
}

vec4.prototype.set = function(a,b,c,d) {
	this.x = a;
	this.y = b;
	this.z = c;
	this.w = d;
	return this;
};

vec4.prototype.copy = function(a) {
	this.x = a.x;
	this.y = a.y;
	this.z = a.z;
	this.w = a.w;
	return this;
};

vec4.prototype.clone = function() {
	return new vec4(this.x, this.y, this.z, this.w);
};

vec4.prototype.calcLength = function() {
	this.length = Math.sqrt( this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w);
	return this;
};

vec4.prototype.add = function(a) {
	this.x += a.x;
	this.y += a.y;
	this.z += a.z;
	this.w += a.w;
	return this;
};

vec4.prototype.addVec = function(a, b) {
	this.x = a.x + b.x;
	this.y = a.y + b.y;
	this.z = a.z + b.z;
	this.w = a.w + b.w;
	return this;
};

vec4.prototype.sub = function(a) {
	this.x -= a.x;
	this.y -= a.y;
	this.z -= a.z;
	this.w -= a.w;
	return this;
};

vec4.prototype.subVec = function(a,b) {
	this.x = a.x - b.x;
	this.y = a.y - b.y;
	this.z = a.z - b.z;
	this.w = a.w - b.w;
	return this;
};

vec4.prototype.cross = function(a) {
	var ax = a.x, ay = a.y, az = a.z;
	var bx = this.x, by = this.y, bz = this.z;
	
	this.x = ay * bz - az * by;
	this.y = az * bx - ax * bz;
	this.z = ax * by - ay * bx;
	return this;
};

vec4.prototype.normalize = function() {
	this.calcLength();
	var scalar = this.length || 1;
	
	this.x *= (1/scalar);
	this.y *= (1/scalar);
	this.z *= (1/scalar);
	this.w *= (1/scalar);
	return this;
};

vec4.prototype.multiplyScalar = function(scalar) {
	this.x *= scalar;
	this.y *= scalar;
	this.z *= scalar;
	this.w *= scalar;
	return this;
};