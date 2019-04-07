var  colour = {
    Red   : [0.7, 0.1, 0.1, 1.0],
    Green  : [0.1, 0.7, 0.1, 1.0],
    Blue : [0.1, 0.1, 0.7, 1.0],
	Yellow : [0.7, 0.7, 0.1, 1.0],
	Orange : [0.7, 0.4, 0.1, 1.0],
	Purple : [0.4, 0.1, 0.4, 1.0]
};

var colourMap = {
	Red  :0,
	Blue :1,
	Green:2,
	Yellow:3,
	Orange:4,
	Purple:5
};

var dataBV = [];


var availableColors = ["Red","Blue","Green","Yellow","Orange","Purple"];

var HIGHLIGHT = {
	NORMAL : 0,
	LINE : 1,
	REFLECTION : 2,
	CURVATURE: 3,
};

// curvature type
var curvType = {
	Guassian: 0,
	Mean: 1,
	Max: 2,
	Min: 3,

};

var defaultSettings = {
	defaultTessellation:  4,
	defaultColor: [0.8, 0.6, 0.5, 1.0],
	controlMeshColor:  [0.0, 0.0, 0.0, 1.0],
	highlightDensity: 0.55,
  defaultHightlightDensity: 0.55,
	flatShading: false,
	flipNormals: false,
	showControlMesh: false,
	showBoundingBox: false,
	lightsOn: [ 1.0, 0.0, 0.0 ],
	showPatches: true,
	highlight: HIGHLIGHT.NORMAL,
	defaultCrvMode: curvType.Gaussian
};

var settings = defaultSettings;

// Active state of the renderer, we use it instead of an object with methods
var renderState = {
	objects: [],
	projection: new mat4(),
	aspectRatio: 1.0,
	translation: new Float32Array([0,0,0]),
	rotation: new Float32Array([0.4200000762939453, 0.07000021636486053, 0]),
	rotateMode : true,
	scale: 1.0,
	zoom: 0.8264462809917354,
	modelview: new mat4(),
	clipping : -55.0
};

var savedPositions = [];

function loadTextResource(url)
{
	url += '?t=' + Date.now();
	var x = new XMLHttpRequest();
	x.open('GET', url, false);
	x.send();
	return x.responseText;
}

function loadAsyncResource(url, cb) {
	var x = new XMLHttpRequest();
	x.addEventListener('load', function(e){
		cb(x.responseText);
	});
	x.addEventListener('error', function(e){
		alert('Error loading resource ' + url);
	});
	x.open('GET', url, true);
	x.responseType = 'text';
	x.send();
}

function makeShader(gl, type, src) {
	var s;
	s = gl.createShader(type);
	gl.shaderSource(s, src);
	gl.compileShader(s);
	if (gl.getShaderParameter(s, gl.COMPILE_STATUS) === false) {
		throw "Shader error: " + (gl.getShaderInfoLog(s));
	} else {
		return s;
	}
}

function makeProgram(gl, vs, fs) {
	var p;
	p = gl.createProgram();
	gl.attachShader(p, vs);
	gl.attachShader(p, fs);
	gl.linkProgram(p);
	if (gl.getProgramParameter(p, gl.LINK_STATUS) === false) {
		throw "Program link error: " + (gl.getProgramInfoLog(p));
	} else {
		return p;
	}
}



function createDonut() {
	var twopi = Math.PI * 2;
	var girthVertexCount = 100, loopVertexCount = 100, loopRadius = 0.4, girthRadius = 0.25;
	var pos = new Float32Array(4 * girthVertexCount * loopVertexCount);
	var nor = new Float32Array(3 * girthVertexCount * loopVertexCount);
	var idx = new Uint32Array(2 * 3 * girthVertexCount * loopVertexCount);
	var t;

	for(var i = 0; i < loopVertexCount; i++) {
		t = i *  twopi / loopVertexCount;
		ct = Math.cos(t); st = Math.sin(t);
		for(var j = 0; j < girthVertexCount; j++) {
			s = j * twopi / girthVertexCount;
			cs = Math.cos(s); ss = Math.sin(s);
			b = i * girthVertexCount + j;
			pos[b * 4 + 0] = (loopRadius + girthRadius * cs) * ct;
			pos[b * 4 + 1] = (loopRadius + girthRadius * cs) * st;
			pos[b * 4 + 2] = girthRadius * ss;
			pos[b * 4 + 3] = 1.0;
			nor[b * 3 + 0] = cs * ct;
			nor[b * 3 + 1] = cs * st;
			nor[b * 3 + 2] = ss;
		}
	}

	for(var i0 = 0; i0 < loopVertexCount; i0++) {
		i1 = (i0+1) % loopVertexCount;
		for(var j0 = 0; j0 < girthVertexCount; j0++) {
			j1 = (j0+1) % girthVertexCount;
            // Create two triangles from the indices:
            //           (i0,j0)   (i0,j1)
            //           (i1,j0)   (i1,j1)
			o00 = i0 * girthVertexCount + j0;
			o01 = i0 * girthVertexCount + j1;
			o10 = i1 * girthVertexCount + j0;
			o11 = i1 * girthVertexCount + j1;

			idx[o00 * 6 + 0] = o00;
			idx[o00 * 6 + 1] = o10;
			idx[o00 * 6 + 2] = o11;
			idx[o00 * 6 + 3] = o00;
			idx[o00 * 6 + 4] = o11;
			idx[o00 * 6 + 5] = o01;
		}
	}

	return { position: pos, normal: nor, index: idx, transform: new mat4() };
}

/* Create an empty object with appropriate buffers */
function createEmptyObject() {
	var gl = renderState.context;
	return {
		positionBuffer: gl.createBuffer(),
		normalBuffer: gl.createBuffer(),
		indexBuffer: gl.createBuffer(),
		controlMesh: {
			positionBuffer: gl.createBuffer(),
			indexBuffer: gl.createBuffer()
		},
		transform: new mat4()
	};
}

function uploadObject(o) {
	var gl = renderState.context;
	o.positionBuffer = o.positionBuffer || gl.createBuffer();
	o.normalBuffer = o.normalBuffer || gl.createBuffer();
	o.indexBuffer = o.indexBuffer || gl.createBuffer();
	o.curvatureBuffer = o.curvatureBuffer || gl.createBuffer();
	o.controlMesh.positionBuffer = o.controlMesh.positionBuffer || gl.createBuffer();
	o.controlMesh.indexBuffer = o.controlMesh.indexBuffer || gl.createBuffer();

	gl.bindBuffer(gl.ARRAY_BUFFER, o.positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, o.position, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, o.normalBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, o.normal, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, o.index, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, o.curvatureBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, o.curvature, gl.STATIC_DRAW);

	gl.bindBuffer(gl.ARRAY_BUFFER, o.controlMesh.positionBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, o.controlMesh.position, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.controlMesh.indexBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, o.controlMesh.index, gl.STATIC_DRAW);
}

function updateProjection() {
	var gl, proj;
	gl = renderState.context;
	gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
	proj = renderState.projection;
	proj.identity();
	/* apply renderState.rotation to projection */
	proj.scale(renderState.zoom, renderState.zoom * gl.drawingBufferWidth / gl.drawingBufferHeight, 1);
}

function draw(timestamp) {
	var o, i, shader, gl, objs, g, j;
	switch (settings.highlight) {
	case HIGHLIGHT.LINE:
		shader = renderState.highlightShader;
		break;
	case HIGHLIGHT.REFLECTION:
		shader = renderState.reflectionShader;
		break;
	case HIGHLIGHT.CURVATURE:
		shader = renderState.curvatureShader;
		break;
	default:
		shader = renderState.shader;
	}
	gl = renderState.context;
	objs = renderState.objects;
	gl.clear(gl.COLOR_BUFFER_BIT + gl.DEPTH_BUFFER_BIT);
	gl.useProgram(shader.program);
	gl.uniformMatrix4fv(shader.uniProjection, false, renderState.projection.m);
	gl.uniform1f(shader.uniClipAmt, renderState.clipping);

	for(i = 0; i < objs.length; i++) {
		o = objs[i];

		renderState.modelview.m.set(o.transform.m);
		renderState.modelview.scale(renderState.scale, renderState.scale, renderState.scale);
		var tempModelView = new mat4(renderState.modelview); //save matrix

		// Draw bounding box
		if(settings.showBoundingBox) {
			gl.disableVertexAttribArray(shader.attrNormal);
			gl.uniform4fv(shader.uniDiffuse, settings.controlMeshColor);

			var max = new vec4(0,0,0,0);
			var min = new vec4(0,0,0,0);

			for (j = 0; j < o.groups.length; j++) {
				g = o.groups[j];
				max.x = Math.max(g.max.x, max.x);
				max.y = Math.max(g.max.y, max.y);
				max.z = Math.max(g.max.z, max.z);
				min.x = Math.min(g.min.x, min.x);
				min.y = Math.min(g.min.y, min.y);
				min.z = Math.min(g.min.z, min.z);
			}

			// use max values of model
			// TODO fix bounding box not translating correctly with model
			var tempTranslate = new Float32Array([(max.x+min.x)/2 * o.sc * renderState.scale + renderState.translation[0],
			(max.y+min.y)/2 * o.sc * renderState.scale + renderState.translation[1],
			(max.z+min.z)/2 * o.sc * renderState.scale + renderState.translation[2]]);

			renderState.modelview.translate(tempTranslate[0], tempTranslate[1], tempTranslate[2]);
			renderState.modelview.rotateXYZ(renderState.rotation);
			renderState.modelview.scale(max.x - min.x, max.y - min.y, max.z - min.z);
			gl.uniformMatrix4fv(shader.uniModelView, false, renderState.modelview.m);

			var wireCube = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, wireCube);
			gl.bufferData(gl.ARRAY_BUFFER,
				new Float32Array ([-0.5, -0.5, -0.5, 1.0,
					-0.5, -0.5, 0.5, 1.0,
					-0.5, 0.5, -0.5, 1.0,
					-0.5, 0.5, 0.5, 1.0,
					0.5, 0.5, -0.5, 1.0,
					0.5, 0.5, 0.5, 1.0,
					-0.5, 0.5, -0.5, 1.0,
					-0.5, 0.5, 0.5, 1.0,
					-0.5, 0.5, 0.5, 1.0,
					0.5, 0.5, 0.5, 1.0,
					-0.5, 0.5, -0.5, 1.0,
					0.5, 0.5, -0.5, 1.0,
					-0.5, -0.5, 0.5, 1.0,
					0.5, -0.5, 0.5, 1.0,
					-0.5, -0.5, -0.5, 1.0,
					0.5, -0.5, -0.5, 1.0,
					0.5, -0.5, 0.5, 1.0,
					0.5, 0.5, 0.5, 1.0,
					-0.5, -0.5, 0.5, 1.0,
					-0.5, 0.5, 0.5, 1.0,
					0.5, -0.5, -0.5, 1.0,
					0.5, 0.5, -0.5, 1.0,
					-0.5, -0.5, -0.5, 1.0,
					-0.5, 0.5, -0.5, 1.0
				]),
				gl.STATIC_DRAW
			);

			gl.vertexAttribPointer(shader.attrPosition, 4, gl.FLOAT, false, 16, 0);
			gl.drawArrays(gl.LINES, 0, 24);
		}

		renderState.modelview.m.set(tempModelView.m); // restore previous matrix
		renderState.modelview.rotateXYZ(renderState.rotation);
		renderState.modelview.translate(renderState.translation[0], renderState.translation[1], renderState.translation[2]);
		gl.uniformMatrix4fv(shader.uniModelView, false, renderState.modelview.m);

		gl.enableVertexAttribArray(shader.attrPosition);
		gl.enableVertexAttribArray(shader.attrNormal);

		if(settings.showPatches){

			for(j = 0; j < o.groups.length; j++) {

				g = o.groups[j];

				switch(g.color)
				{
					case colourMap.Red:
					color=colour.Red;
					break;

					case colourMap.Blue:
					color=colour.Blue;
					break;

					case colourMap.Green:
					color=colour.Green;
					break;

					case colourMap.Yellow:
					color=colour.Yellow;
					break;

					case colourMap.Orange:
					color = colour.Orange;
					break;

					case colourMap.Purple:
					color = colour.Purple;
					break;

					default:
					color=colour.Red;
				}

				if (settings.highlight === HIGHLIGHT.CURVATURE) {
					gl.uniform4fv(shader.uniMaxCrv, [g.maxCrv.x, g.maxCrv.y, g.maxCrv.z, g.maxCrv.w]);
					gl.uniform4fv(shader.uniMinCrv, [g.minCrv.y, g.minCrv.y, g.minCrv.z, g.minCrv.w]);
					gl.uniform1i(shader.uniCrvMode, g.crvMode);
					gl.enableVertexAttribArray(shader.attrCurvature);

					// send in crv array
					gl.bindBuffer(gl.ARRAY_BUFFER, g.curvatureBuffer);
					gl.vertexAttribPointer(shader.attrCurvature, 4, gl.FLOAT, false, 16, 0);
				}

				gl.uniform1f(shader.uniHighLightDensity, settings.highlightDensity);
				gl.uniform1i(shader.uniFlatShading, settings.flatShading);
				gl.uniform1i(shader.uniFlipNormals, settings.flipNormals);
				gl.uniform4fv(shader.uniDiffuse, color);
				if (shader.uniLightsOn) {
					gl.uniform3fv(shader.uniLightsOn, settings.lightsOn);
				}

				gl.bindBuffer(gl.ARRAY_BUFFER, g.positionBuffer);
				gl.vertexAttribPointer(shader.attrPosition, 4, gl.FLOAT, false, 16, 0);

				gl.bindBuffer(gl.ARRAY_BUFFER, g.normalBuffer);
				gl.vertexAttribPointer(shader.attrNormal, 3, gl.FLOAT, false, 12, 0);

				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, g.indexBuffer);
				gl.drawElements(gl.TRIANGLES, g.index.length, gl.UNSIGNED_INT, 0);
			}
		}

		if (settings.highlight === HIGHLIGHT.CURVATURE)
			gl.disableVertexAttribArray(shader.attrCurvature);

		// Draw control mesh
		if(settings.showControlMesh) {
			gl.disableVertexAttribArray(shader.attrNormal);
			gl.uniform4fv(shader.uniDiffuse, settings.controlMeshColor);

			for(j = 0; j < o.groups.length; j++) {
				g = o.groups[j];
				cm = g.controlMesh
				gl.bindBuffer(gl.ARRAY_BUFFER, cm.positionBuffer);
				gl.vertexAttribPointer(shader.attrPosition, 4, gl.FLOAT, false, 16, 0);

				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cm.indexBuffer);
				gl.drawElements(gl.LINES,cm.index.length, gl.UNSIGNED_INT, 0);
			}
		}
	}

	window.requestAnimationFrame(draw);
}

function buildControlMesh(obj){
	var patches,p, vertexCount, indexCount, i, j, baseVertex, baseIndex, oU, oV, k;
	var index, position, cm, st;
	patches = obj.patches;
	obj.controlMesh = cm = {}
	// Set-up control mesh
	// Count the number of control points and index points
	vertexCount = 0; indexCount = 0;
	for(i = 0; i < patches.length; i++) {
		p = patches[i];
		vertexCount += p.controlPoints.length / 4;
		if(p.kind === PatchType.Triangle){
			indexCount += 3 * 2 * (p.orderU-1)*p.orderU/2;
		}
		else if(p.kind === PatchType.Quadrilateral) {
			indexCount += 2 * (p.orderU * (p.orderV-1) + (p.orderU-1) * p.orderV);
		} else if (p.kind === PatchType.Polyhedral) {
			vertexCount = p.orderU;
			indexCount = p.orderV*3*2; // times 2 due to gl.LINES
		}
		else
			throw new Error("Not implemented " + p.kind);
	}
	position = cm.position = new Float32Array(vertexCount * 4);
	index = cm.index = new Uint32Array(indexCount);


	baseVertex = 0; baseIndex = 0;
	for(i = 0; i < patches.length; i++){
		// Copy the control points
		p = patches[i];
		st = p.orderU;
		cp = p.controlPoints;

		// Set-up indices
		if(p.kind === PatchType.Triangle) {
			// TODO: implement
			throw new Error("not implemented");
		} else if(p.kind === PatchType.Quadrilateral) {
			for(j = 0; j < cp.length; j++)
				position[baseVertex * 4 + j] = cp[j];

			for(j = 0; j < p.orderV; j++)
				for(k = 0; k < p.orderU; k++){
					if(j < p.orderV-1) {
						index[baseIndex+0] = baseVertex + j*st + k;
						index[baseIndex+1] = baseVertex + (j+1)*st + k;
						baseIndex += 2;
					}
					if(k < p.orderU-1) {
						index[baseIndex+0] = baseVertex + j*st + k;
						index[baseIndex+1] = baseVertex + j*st + k+1;
						baseIndex += 2;
					}
				}

				baseVertex += cp.length / 4;
		} else if (p.kind === PatchType.Polyhedral) {
			// copy poly vertices into position
			for(j = 0; j < cp.length; j++) {
				position[j*4+0] = cp[j].x;
				position[j*4+1] = cp[j].y;
				position[j*4+2] = cp[j].z;
				position[j*4+3] = cp[j].w;
			}

			// copy indices
			for(j = 0; j < p.faces.length; j++) {
				var face = p.faces[j];
				index[j*6+0] = face.x;
				index[j*6+1] = face.y;
				index[j*6+2] = face.y;
				index[j*6+3] = face.z;
				index[j*6+4] = face.z;
				index[j*6+5] = face.x;
			}
		}
	}
}

function reevaluateBezierObject(inObj){
  var inMax = new vec4(-1001,-1001,-1001,-1001);
  var inMin = new vec4(1001,1001,1001,1001);;
  for(j = 0; j < inObj.groups.length; j++) {
    var obj = inObj.groups[j];
  	var patches, i, j, vertexCount, indexCount, obj, tessellation;
  	var baseVertex, baseIndex;
  	patches = obj.patches;
  	tessellation = obj.tessellationLevel;
  	/* count the number of vertices and indices of
         all the patches when evaluated */
  	vertexCount = 0, indexCount = 0;
  	for(i = 0; i < patches.length; i++) {
  		o = evaluateCount(patches[i], tessellation);
  		vertexCount += o.vertexCount;
  		indexCount += o.indexCount;
  	}


  	obj.position = new Float32Array(4 * vertexCount);
  	obj.normal = new Float32Array(3 * vertexCount);
  	obj.curvature = new Float32Array(4 * vertexCount);
  	obj.index = new Uint32Array(indexCount);

  	// to calculate curvature
  	crv = new CRV();
  	crv.init();

  	baseVertex = 0; baseIndex = 0;
  	for(i = 0; i < patches.length; i++) {
  		o = evaluateCount(patches[i], tessellation);
  		evaluate(patches[i], tessellation, baseVertex, baseIndex, obj, 0);

  		// save max and min position values of object
  		obj.max.x = Math.max(obj.max.x, patches[i].max.x);
  		obj.max.y = Math.max(obj.max.y, patches[i].max.y);
  		obj.max.z = Math.max(obj.max.z, patches[i].max.z);
  		obj.max.w = Math.max(obj.max.w, patches[i].max.w);
  		obj.min.x = Math.min(obj.min.x, patches[i].min.x);
  		obj.min.y = Math.min(obj.min.y, patches[i].min.y);
  		obj.min.z = Math.min(obj.min.z, patches[i].min.z);
  		obj.min.w = Math.min(obj.min.w, patches[i].min.w);

  		baseVertex += o.vertexCount;
  		baseIndex += o.indexCount;
  	}

  	// set curvature range
  	// TODO put the following in a separate function?
  	var max = isNaN(crv.max_crv.x) ? 1000 : crv.max_crv.x;
  	var min = isNaN(crv.min_crv.x) ? -1000 : crv.min_crv.x;
    if (inMax.x < max) {inMax.x = max; console.log(max);}
    if (inMin.x > min) {inMin.x = min}
  	obj.maxCrv.x = inMax.x;
  	obj.minCrv.x = inMin.x;


  	max = isNaN(crv.max_crv.y) ? 1000 : crv.max_crv.y;
  	min = isNaN(crv.min_crv.y) ? -1000 : crv.min_crv.y;
    if (inMax.y < max) {inMax.y = max}
    if (inMin.y > min) {inMin.y = min}
  	obj.maxCrv.y = inMax.y;
  	obj.minCrv.y = inMin.y;

  	max = isNaN(crv.max_crv.z) ? 1000 : crv.max_crv.z;
  	min = isNaN(crv.min_crv.z) ? -1000 : crv.min_crv.z;
    if (inMax.z < max) {inMax.z = max}
    if (inMin.z > min) {inMin.z = min}
  	obj.maxCrv.z = inMax.z;
  	obj.minCrv.z = inMin.z;

  	max = isNaN(crv.max_crv.w) ? 1000 : crv.max_crv.w;
  	min = isNaN(crv.min_crv.w) ? -1000 : crv.min_crv.w;
    if (inMax.w < max) {inMax.w = max}
    if (inMin.w > min) {inMin.w = min}
  	obj.maxCrv.w = inMax.w;
  	obj.minCrv.w = inMin.w;



  }
  for(j = inObj.groups.length-1; j >= 0; j--) {
    inObj.groups[j].maxCrv = inMax;
    inObj.groups[j].minCrv = inMin;
    uploadObject(inObj.groups[j]);
    console.log("TESTss2");
  }



	console.log(obj.maxCrv);
	console.log(obj.minCrv);
}



function setTessellationLevel(level) {
	var menuitems, i, j , o;
	menuitems = document.querySelectorAll('#patch-detail-menu a[data-value]');
	for(i = 0; i < menuitems.length; i++)
		menuitems[i].className = menuitems[i].getAttribute('data-value') == String(level) ? 'checked' : '';
// edited by Ryan Feeney. passed whole object to reevaluateBezierObject() so the global min and max curve can be preserved

  for(i = 0; i < renderState.objects.length; i++) {
    o = renderState.objects[i];
    for(j = 0; j < o.groups.length; j++) {
      o.groups[j].tessellationLevel = level;
    }
    reevaluateBezierObject(o);
  }
  ///////////////////////////////////
}

function resetProjection() {
	renderState.projection.identity();
	renderState.modelview.identity();
	renderState.aspectRation = 1.0;
	renderState.translation = new Float32Array([0,0,0]),
	renderState.rotation = new Float32Array([0.4200000762939453, 0.07000021636486053, 0]),
	renderState.scale = 1.0;
	renderState.zoom = 0.8264462809917354;

	updateProjection();
}

function loadBezierObject(text, obj) {
	var patches, i, j, k, cp, magnitude, sc, tessellation;
	var c = new Float32Array(3);
	tessellation = settings.defaultTessellation;

	var detail;
	detail = document.getElementById("select-patch-detail");
	detail.value = 4; // reset patch detail control

	var curvType;
	curvType = document.getElementById("select-curv-type");
	curvType.value = 0;

	groupInfo = [];
	patches = readBVFile(text, groupInfo);

	/* center the object using center of mass */
	vertexCount = 0;
	for(i = 0; i < patches.length; i++) {
		cp = patches[i].controlPoints;
		if (patches[i].kind === PatchType.Polyhedral) {
			for (j = 0; j < cp.length; j++) {
				c[0] += cp[j].x/cp[j].w;
				c[1] += cp[j].y/cp[j].w;
				c[2] += cp[j].z/cp[j].w;
			}
			vertexCount = patches[i].orderU;
		} else {
			for(j = 0; j < cp.length; j+= 4) {
				for(k = 0; k < 3; k++) {
					c[k] += cp[j + k]/cp[j + 3];
				}
			}
			vertexCount += cp.length / 4;
		}
	}
	for(k = 0; k < 3; k++) c[k] /= vertexCount;

	/* Auto-scaling */
	/* find maximum value in any direction */
	var max = new Float32Array(3);
	var min = new Float32Array(3);
	magnitude = 0.000001;
	for(i = 0; i < patches.length; i++) {
		cp = patches[i].controlPoints;
		if (patches[i].kind === PatchType.Polyhedral) {
			for (j = 0; j < cp.length; j++) {
				cp[j].x -= cp[j].w * c[0];
				magnitude = Math.max(magnitude, Math.abs(cp[j].x/cp[j].w));
				cp[j].y -= cp[j].w * c[1];
				magnitude = Math.max(magnitude, Math.abs(cp[j].y/cp[j].w));
				cp[j].z -= cp[j].w * c[2];
				magnitude = Math.max(magnitude, Math.abs(cp[j].z/cp[j].w));
			}
		} else {
			for(j = 0; j < cp.length; j+= 4) {
				for(k = 0; k < 3; k++) {
					cp[j + k] -= cp[j + 3] * c[k];
					magnitude = Math.max(magnitude, Math.abs(cp[j + k]/cp[j + 3]));
				}
			}
		}
	}

	sc = 0.50 / magnitude;
	obj.sc = sc;
	obj.transform.identity();
	obj.transform.scale(sc, sc, sc);

	obj.groups = [];

	//if groups are present then slice patches into groups
	// TODO optimize groups by reducing redundant patches and names
	if(groupInfo.length){
		for(i = 0; i < groupInfo.length;i++) {

			var tempPatches = [];
			for(j = 0; j < patches.length;j++) {
				if (patches[j].name == groupInfo[i].name) {
					tempPatches.push(patches[j]);
				}
			}

			obj.groups.push({
				name: groupInfo[i].name,
				color: groupInfo[i].color,
				patches: tempPatches,
				tessellationLevel: settings.defaultTessellation,
				crvMode: settings.defaultCrvMode,
				maxCrv: new vec4(),
				minCrv: new vec4(),
				max: new vec4(0,0,0,0),
				min: new vec4(0,0,0,0)
			});
		}
	}
	//else just push the entire patches array into one group
	else{
        obj.groups.push({
			name: '',
			color: 0,
			patches: patches,
			tessellationLevel: settings.defaultTessellation,
			crvMode: settings.defaultCrvMode,
			maxCrv: new vec4(),
			minCrv: new vec4(),
			max: new vec4(0,0,0,0),
			min: new vec4(0,0,0,0)
		})
	}

	tmp = document.getElementById("select-group");

	while (tmp.firstChild) {
		tmp.removeChild(tmp.firstChild);
	}
	for(i = 0; i < obj.groups.length; i++) {
		buildControlMesh(obj.groups[i]);
	//	reevaluateBezierObject(obj.groups[i]);
	//	uploadObject(obj.groups[i]);

		//update "Group" drop-box on the page
		var opt = i+1;
		var el = document.createElement("option");
		el.textContent = obj.groups[i].name;
		el.value = opt;
		tmp.appendChild(el);
	}
  reevaluateBezierObject(obj);

}

function setup() {
	var canvas, container, gl, prog, mouseState;

	// Load the shaders synchronously. Doing this asynchronous would
	// be really ugly
	var vssrc = loadTextResource('shader/vs.glsl');
	var fssrc = loadTextResource('shader/fs.glsl');
	var hlfssrc = loadTextResource('shader/highlight.fs.glsl');
	var refl_fssrc = loadTextResource('shader/highlight_reflection.fs.glsl');
	var curv_fssrc = loadTextResource('shader/curvature.fs.glsl');
	var curv_vssrc = loadTextResource('shader/curvature.vs.glsl');

	canvas = document.getElementById('drawing');
	gl = canvas.getContext('experimental-webgl');
	if(gl === null){
		window.alert('Your browser does not support WebGL');
		return;
	}

	// extension needed for Uint32 index array
	var extA = gl.getExtension('OES_element_index_uint');
	// extension needed for flat shading
	var extB = gl.getExtension('OES_standard_derivatives');

	gl.enable(gl.DEPTH_TEST);
	renderState.context = gl;
	prog = makeProgram(gl,
					   makeShader(gl, gl.VERTEX_SHADER, vssrc),
					   makeShader(gl, gl.FRAGMENT_SHADER, fssrc)
					  );
	renderState.shader = {
		program       : prog,
		attrPosition  : gl.getAttribLocation(prog, "inputPosition"),
		attrNormal    : gl.getAttribLocation(prog, "inputNormal"),
		uniProjection : gl.getUniformLocation(prog, "projection"),
		uniClipAmt    : gl.getUniformLocation(prog, "clipAmt"),
		uniModelView  : gl.getUniformLocation(prog, "modelview"),
		uniDiffuse    : gl.getUniformLocation(prog, "diffuse"),
		uniFlatShading: gl.getUniformLocation(prog, "flatShading"),
		uniFlipNormals: gl.getUniformLocation(prog, "flipNormals"),
		uniLightsOn   : gl.getUniformLocation(prog, "lightsOn"),
	};
	prog = makeProgram(gl,
					   makeShader(gl, gl.VERTEX_SHADER, vssrc),
					   makeShader(gl, gl.FRAGMENT_SHADER, hlfssrc)
					  );
	renderState.highlightShader = {
		program       : prog,
		attrPosition  : gl.getAttribLocation(prog, "inputPosition"),
		attrNormal    : gl.getAttribLocation(prog, "inputNormal"),
		uniProjection : gl.getUniformLocation(prog, "projection"),
		uniClipAmt    : gl.getUniformLocation(prog, "clipAmt"),
		uniModelView  : gl.getUniformLocation(prog, "modelview"),
		uniDiffuse    : gl.getUniformLocation(prog, "diffuse"),
		uniFlipNormals: gl.getUniformLocation(prog, "flipNormals"),
		uniLightsOn   : gl.getUniformLocation(prog, "lightsOn"),
		uniHighLightDensity: gl.getUniformLocation(prog, "highlightDensity"),

	};
	prog = makeProgram(gl,
					   makeShader(gl, gl.VERTEX_SHADER, vssrc),
					   makeShader(gl, gl.FRAGMENT_SHADER, refl_fssrc)
					  );
	renderState.reflectionShader = {
		program       : prog,
		attrPosition  : gl.getAttribLocation(prog, "inputPosition"),
		attrNormal    : gl.getAttribLocation(prog, "inputNormal"),
		uniProjection : gl.getUniformLocation(prog, "projection"),
		uniClipAmt    : gl.getUniformLocation(prog, "clipAmt"),
		uniModelView  : gl.getUniformLocation(prog, "modelview"),
		uniDiffuse    : gl.getUniformLocation(prog, "diffuse"),
		uniFlipNormals: gl.getUniformLocation(prog, "flipNormals"),
		uniLightsOn   : gl.getUniformLocation(prog, "lightsOn"),
		uniHighLightDensity: gl.getUniformLocation(prog, "highlightDensity"),
	};
	prog = makeProgram(gl,
					   makeShader(gl, gl.VERTEX_SHADER, curv_vssrc),
					   makeShader(gl, gl.FRAGMENT_SHADER, curv_fssrc)
					  );
	renderState.curvatureShader = {
		program       : prog,
		attrCurvature : gl.getAttribLocation(prog, "crv"),
		attrPosition  : gl.getAttribLocation(prog, "inputPosition"),
		attrNormal    : gl.getAttribLocation(prog, "inputNormal"),
		uniProjection : gl.getUniformLocation(prog, "projection"),
		uniClipAmt    : gl.getUniformLocation(prog, "clipAmt"),
		uniModelView  : gl.getUniformLocation(prog, "modelview"),
		uniDiffuse    : gl.getUniformLocation(prog, "diffuse"),
		uniCrvMode	: gl.getUniformLocation(prog, "crvMode"),
		uniMaxCrv		: gl.getUniformLocation(prog, "maxCrv"),
		uniMinCrv		: gl.getUniformLocation(prog, "minCrv")
	};
	resizeCanvas();

	InitColorDialogBox();

	var fn;
	fn = 'data/fertility_quad.bv';
	loadAsyncResource(fn, function(text){
		// TODO: remove create empty object
		renderState.objects[0] = createEmptyObject();
		loadBezierObject(text, renderState.objects[0]);
	});

	window.addEventListener('resize', resizeCanvas);
	window.requestAnimationFrame(draw);

	mouseState = { x: 0, y: 0 };

	// prevent context menu from appearing on right click
	canvas.addEventListener('contextmenu', function(e){
		e.preventDefault();
	}, false);

	canvas.addEventListener('mousedown', function(e){
		if(e.button === 0 || e.button === 2) mouseState.x = e.clientX, mouseState.y = e.clientY;
	});

	canvas.addEventListener('mousemove', function(e){
		if(e.buttons === 1) {
			if (renderState.rotateMode) {
				renderState.rotation[1] -= 0.01 * (e.clientX - mouseState.x) * Math.min(1.0,(1/renderState.zoom));
				renderState.rotation[0] -= 0.01 * (e.clientY - mouseState.y) * Math.min(1.0,(1/renderState.zoom));
				//renderState.rotation[0] = Math.max(Math.min(renderState.rotation[0], Math.PI), -Math.PI);
				updateProjection();
				renderState.clipping = -55;
			} else {
				renderState.clipping = (e.clientY / window.innerHeight) * 2.0 - 1.0;
			}
			mouseState.x = e.clientX, mouseState.y = e.clientY;
		}

		// panning when right clicking
		else if(e.buttons === 2) {
			renderState.translation[1] -= (e.clientY - mouseState.y) / window.innerHeight * (1/renderState.zoom);
			renderState.translation[0] += (e.clientX - mouseState.x) / window.innerWidth * (1/renderState.zoom);
			updateProjection();
			mouseState.x = e.clientX, mouseState.y = e.clientY;
		}
	});

	var handleScroll = function(e){
		if (!e) e = event;
		var direction = (e.detail<0 || e.wheelDelta>0) ? 1 : -1;
		if (e.altKey) {
			renderState.scale *= Math.pow(1.1, direction);
		} else {
			renderState.zoom *= Math.pow(1.1, direction);
		}
		updateProjection();
	};

	canvas.addEventListener('DOMMouseScroll', handleScroll, false); // for Firefox
	canvas.addEventListener('mousewheel', handleScroll, false); // for everyone else

	document.getElementById('upload-file').addEventListener('change', function() {
		var reader;
		if(this.files.length == 1)
		{
			reader = new FileReader();
			reader.onload = function(e){
				loadBezierObject(e.target.result, renderState.objects[0]);
			};
			reader.readAsText(this.files[0]);
		}
	});

	function dragFileOver(e){
		e.stopPropagation();
  		e.preventDefault();
  		e.target.className = (e.type == "dragover" ? "hover" : "");
	}

	function dropFile(e){
		var reader;
		dragFileOver(e);
		var files = e.target.files || e.dataTransfer.files;
		if(files.length == 1)
		{
			reader = new FileReader();
			reader.onload = function(e){
				loadBezierObject(e.target.result, renderState.objects[0]);
			};
			reader.readAsText(files[0]);
		}

	}

	canvas.addEventListener('dragover', dragFileOver, false);
	canvas.addEventListener('dragleave', dragFileOver, false);
	canvas.addEventListener('drop', dropFile, false);

	var menuitems;
	menuitems = document.querySelectorAll('#patch-detail-menu a[data-value]');
	for(i = 0; i < menuitems.length; i++) {
		menuitems[i].addEventListener('click', function(e){
			var n = Number(e.target.getAttribute('data-value'));
			if(!isNaN(n)) setTessellationLevel(n);
		});
	}
	setTessellationLevel(settings.defaultTessellation);

	menuitems = document.querySelectorAll('#curv-detail-menu a[data-value]');
	for(i = 0; i < menuitems.length; i++) {
		menuitems[i].addEventListener('click', function(e) {
			var type = Number(e.target.value);
			if (!isNaN(type)) setCurvatureType(type);
		});
	}
	setCurvatureType(settings.defaultCrvMode);

	document.getElementById('check-control-mesh').addEventListener('change', function(e){
		settings.showControlMesh = e.target.checked;
	});

	document.getElementById('check-flat-shading').addEventListener('change', function(e) {
		settings.flatShading = e.target.checked;
	});

	document.getElementById('check-flip-normals').addEventListener('change', function(e) {
		settings.flipNormals = e.target.checked;
	});

	document.getElementById('check-light-1').addEventListener('change', function(e) {
		settings.lightsOn[0] = e.target.checked;
	});
	document.getElementById('check-light-2').addEventListener('change', function(e) {
		settings.lightsOn[1] = e.target.checked;
	});
	document.getElementById('check-light-3').addEventListener('change', function(e) {
		settings.lightsOn[2] = e.target.checked;
	});

	var checkHighlightBox = document.getElementById('check-highlight');
	var checkReflectionBox = document.getElementById('check-reflection');
	var checkCurvatureBox = document.getElementById('check-curvature');

	var updateHighlightMode = function(e) {
		var lines = checkHighlightBox.checked;
		var refl = checkReflectionBox.checked;
		var curv = checkCurvatureBox.checked;
		if ((lines && refl) || (lines && curv) || (refl && curv)) {
			checkHighlightBox.checked = false;
			checkReflectionBox.checked = false;
			checkCurvatureBox.checked = false;
			e.target.checked = true;
			lines = checkHighlightBox.checked;
			refl = checkReflectionBox.checked;
			curv = checkCurvatureBox.checked;
		}
		if (lines) {
			settings.highlight = HIGHLIGHT.LINE;
		} else if (refl) {
			settings.highlight = HIGHLIGHT.REFLECTION;
		} else if (curv) {
			settings.highlight = HIGHLIGHT.CURVATURE;
		} else {
			settings.highlight = HIGHLIGHT.NORMAL;
		}
	};

	document.getElementById('check-bounding-box').addEventListener('change', function(e) {
		settings.showBoundingBox = e.target.checked;
	});

	document.getElementById('check-patches').addEventListener('change', function(e){
		settings.showPatches = e.target.checked;
	});

	checkHighlightBox.addEventListener('change', updateHighlightMode);

	checkReflectionBox.addEventListener('change', updateHighlightMode);

	checkCurvatureBox.addEventListener('change', updateHighlightMode);

	document.getElementById('rotateModeTrue').addEventListener('change', function(e) {
		renderState.rotateMode = e.target.checked;
	});

	document.getElementById('rotateModeFalse').addEventListener('change', function(e) {
		renderState.rotateMode = ! e.target.checked;
	});

	document.getElementById('select-curv-type').addEventListener('change', function(e) {
		var n = Number(e.target.value);
		if(!isNaN(n)) setCurvatureType(n);
	});

	document.getElementById('select-patch-detail').addEventListener('change', function(e){
		var n = Number(e.target.value);
		if(!isNaN(n)) setTessellationLevel(n);
	});

	document.getElementById('select-group').addEventListener('click', function(e){

		//just update the color dialog box after recieving this event
		for(i = 0; i < renderState.objects.length; i++) {
			o = renderState.objects[i];
			col = availableColors[o.groups[Number((e.target.value)-1)%availableColors.length].color];
			document.getElementById("select-group-color").value = col
		}

	});

	document.getElementById('select-group-color').addEventListener('change', function(e){
		var n = colorGroup(e.target.value);
	});



}

function InitColorDialogBox(){

    tmp = document.getElementById("select-group-color");
    for(i =0; i< availableColors.length; i++)
    {
        var opt = availableColors[i];
        var el = document.createElement("option");
        el.textContent = opt;
        el.value = opt;
        tmp.appendChild(el);
    }
}

function resizeCanvas(e) {
	var canvas;
	canvas = renderState.context.canvas;
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;
	updateProjection();
}

function colorGroup(col){
	for(i = 0; i < renderState.objects.length; i++) {
		o = renderState.objects[i];
		val = document.getElementById("select-group").value;
		if(!isNaN(val))
			o.groups[val-1].color = colourMap[col];
	}
}

function setCurvatureType(type) {
	var menuitems, i, j, o;
	menuitems = document.querySelectorAll('#curv-detail-menu a[data-value]');
	for (i = 0; i < menuitems.length; i++)
		menuitems[i].className = menuitems[i].getAttribute('data-value') == String(type) ? 'checked' : '';

	for (i=0; i < renderState.objects.length; i++) {
		o = renderState.objects[i];
		for(j = 0; j < o.groups.length; j++) {
			o.groups[j].crvMode = type;
			uploadObject(o.groups[j]);
		}
	}
}

document.addEventListener('DOMContentLoaded', setup);
