var PatchType = {
	Triangle: 1,
	Quadrilateral: 2,
	Polyhedral: 3
};

function Patch(kind, orderU, orderV, controlPoints, faces, name) {
	this.kind = kind;
	this.orderU = orderU; // reuse as numVertices for poly patches
	this.orderV = orderV; // reuse as numFaces for poly patches
	this.controlPoints = controlPoints; // reuse as vertices for poly patches
	this.faces = faces; // only used for polyhedral patches
	this.max = new vec4(0,0,0,0); // save max position values
	this.min = new vec4(0,0,0,0); // save min position values
	this.name = name;
}

function groupInfoHelper(color, name, patches) {
	this.color = color;
	this.name = name;
}

//parses the text for patches. returns group-info as well
function readBVFile(text, groupInfo) {
    var input, cur, patches, kind, name, order, orderU, orderV, cp, groupNames;
    input = text.split(/\s+/);
    cur = 0;

	
    function readCP(n, rational) {
		var i, j, l, b;
		l = rational ? 4 : 3;
		b = new Float32Array(n * 4);
		for(i = 0; i < n; i += 1) {
			b[i*4+0] = Number(input[cur+0]);
			b[i*4+1] = Number(input[cur+1]);
			b[i*4+2] = Number(input[cur+2]);
			b[i*4+3] = rational ? Number(input[cur+3]) : 1.0;
			cur += l;
		}
		return b;
    }
    function readCPInverse(n, rational) {
		var i, j, l, b;
		l = rational ? 4 : 3;
		b = new Float32Array(n * 4);
		for(i = n - 1; i >= 0; i -= 1) {
			b[i*4+0] = Number(input[cur+0]);
			b[i*4+1] = Number(input[cur+1]);
			b[i*4+2] = Number(input[cur+2]);
			b[i*4+3] = rational ? Number(input[cur+3]) : 1.0;
			cur += l;
		}
		return b;
    }

    patches = [];
	groupNames = [];
    /* Read as many patches as possible */
	// TODO detect if patch part of existing group
    while(cur < input.length && input[cur] != "") {
		
		if(input[cur].toUpperCase() == "GROUP")
		{
			color = Number(input[++cur]);
			name = input[++cur];
			
			if (groupNames.indexOf(name) <= -1) {
				// group doesn't already exist, make new group
				groupNames.push(name);
				groupInfo.push(new groupInfoHelper(color, name));
			}
			++cur;
		}
		
		kind = Number(input[cur]);
		cur += 1;

		switch(kind) {
        case 1:
			// retrieve # vertices and # faces
			var numVertices, numFaces, extraFaces = 0;
			numVertices = Number(input[cur]); cur += 1;
			numFaces = Number(input[cur]); cur += 1;
			
			// load vertices
			var v = [];
			for(var i = 0; i < numVertices; i++) {
				var x = Number(input[cur+0]);
				var y = Number(input[cur+1]);
				var z = Number(input[cur+2]);
				v.push(new vec4(x,y,z,1));
				
				cur+=3;
			}
			
			// load faces
			var f = [];
			for(var i = 0; i < numFaces; i++) {
				var numVertFace = Number(input[cur]); cur += 1;
				if (numVertFace == 3) {
					var a = Number(input[cur+0]);
					var b = Number(input[cur+1]);
					var c = Number(input[cur+2]);
					f.push(new vec4(a,b,c,0));
					
					cur += 3;
				} else if (numVertFace == 4) {
					// transform one quad face into two triangle faces
					// triangle a, b, c
					var a = Number(input[cur+0]);
					var b = Number(input[cur+1]);
					var c = Number(input[cur+2]);
					f.push(new vec4(a,b,c,0));
					
					// triangle a, c, d
					var d = Number(input[cur+3]);
					f.push(new vec4(a,c,d,0));
					
					extraFaces++;
					cur += 4;
				} else {
					throw new Error("What kind of face is that?");
				}
			}
			
			patches.push(new Patch(PatchType.Polyhedral, numVertices, (numFaces+extraFaces), v, f, name));
			break;

        case 3:
            /* the file has degree, we use order */
            order = Number(input[cur]) + 1; cur += 1;
            /* We use the reverse ordering of BV
               0
               1 2
               3 4 5
               . . .

               It makes it easier when calculating applying de Casteljau algorithm

               TODO: make sure the winding order is correct
            */
            cp = readCPInverse(order * (order + 1)/2, false);
            patches.push(new Patch(PatchType.Triangle,order, order, cp, null, name));
            break;

        case 4:
			order = Number(input[cur]) + 1; cur += 1;
			cp = readCP(order * order, rational = false);
			patches.push(new Patch(PatchType.Quadrilateral, order, order, cp, null, name));
			break;

        case 5: case 8:
			orderV = Number(input[cur]) + 1; cur += 1;
			orderU = Number(input[cur]) + 1; cur += 1;
			cp = readCP(orderU * orderV, kind == 8);
			patches.push(new Patch(PatchType.Quadrilateral, orderU, orderV, cp, null, name));
			break;

        case 9:
			throw new Error("PN Triangle patches are not supported.");
			break;

        case 10:
			throw new Error("PN Quad patches are not supported.");
			break;

        default:
			throw new Error("Unknown patch type " + kind);
		}
    }
    return patches;
}

/* take the difference of control point 0 and 1 and put
   it in location 2,
   i is base index and st is the stride
*/
function controlPointDiff(cp, i, st) {
	var j, b, w;
	s = st * 4;
	for(j = 0; j < 3; j++) {
		b = i * 4 + j; w = i * 4 + 3;
		cp[b + 2*s] = cp[b + s]/cp[w + s] - cp[b]/cp[w];
	}
}

/* Apply deCasteljau algorithm along the line,
   cp is the controlpoints array, b is the base
   index and st is the stride.*/
function deCasteljauLine(cp, u, b, st, o) {
	var i, j, k, w;
	w = 1.0 - u;
	for(i = 0; i < o - 1; i++) {
		for(j = 0; j < 4; j++) {
			k = (b + i * st) * 4 + j;
			cp[k] = w * cp[k] + u * cp[k + st * 4];
		}
	}
}

var deCalsteljauQuadBuffer = new Float32Array();
/* Calculate position, normal and curvature and put it
   in the corresponding Float32Arrays at index idx
   position has stride 4, normal has stride 3 and curvature has stride 4 due to 4 types of curvature

   * We assume the control points are laid out as
   *    x ----- U -----
   *    | 0 1 2 3 4
   *    | 5 6 7 8 9
   *    V ..
   *    |
   *    |
   *
   * this means that stride in V direction is orderU
   */
function deCasteljauQuad(patch, u, v, position, normal, curvature, idx, L) {
	var cp, ou, ov, i, o, st;
	/* st is the stride */
	ou = patch.orderU, ov = patch.orderV, st = ou;
	/* make a copy of patch control points */
	if(deCalsteljauQuadBuffer.length != patch.controlPoints.length)
		deCalsteljauQuadBuffer = new Float32Array(patch.controlPoints.length);
	cp = deCalsteljauQuadBuffer;
	cp.set(patch.controlPoints);

	/* do deCasteljau in V direction to bring down the
       order to 3 (quadratic), when we do it for 4, the result is
       order 3
	*/
	
	for(o = ov; o >= 4; o--) {
		for(i = 0; i < ou ; i ++) {
			deCasteljauLine(cp, v, i, st, o);
		}
	}
	/* do deCasteljau in U direction to bring down the order
       to 3, we already brought down V to 3 so there is only 3 rows
       to process
	*/
	for(o = ou; o >= 4; o--) {
		for(i = 0; i < 3 ; i ++) {
			deCasteljauLine(cp, u, i*st, 1, o);
		}
	}
	/* now we have a 3x3 patch with stride stV */
	
	for(i = 0; i < 3; i++) deCasteljauLine(cp, v, i, st, 3);
	for(i = 0; i < 2; i++) deCasteljauLine(cp, u, i*st, 1, 3);

	controlPointDiff(cp, 0, st);
	controlPointDiff(cp, 1, st);
	controlPointDiff(cp, 0,  1);
	controlPointDiff(cp, st, 1);
	deCasteljauLine(cp, v, 2, st, 2);
	deCasteljauLine(cp, u, 2*st, 1, 2); 
	
	/* tanU and tanV are calculated at
       c02 and c20, normal should be calculated directly */

	/* here we calculate tanU x tanV directly */
	var tux, tuy, tuz, tvx, tvy, tvz;
	tux = cp[2*4+0], tuy = cp[2*4+1], tuz = cp[2*4+2];
	tvx = cp[2*4*st+0], tvy = cp[2*4*st+1], tvz = cp[2*4*st+2];
	normal[idx*3+0] = tuy * tvz - tuz * tvy;
	normal[idx*3+1] = tuz * tvx - tux * tvz;
	normal[idx*3+2] = tux * tvy - tuy * tvx;
	
	/* do the last step of deCasteljau to calculate the point */
	deCasteljauLine(cp, v, 0, st, 2);
	deCasteljauLine(cp, v, 1, st, 2);
	deCasteljauLine(cp, u, 0,  1, 2);

	for(i = 0; i < 4; i++) {
		position[idx*4+i] = cp[i];	
	}
	
	patch.max.x = Math.max(patch.max.x, position[idx*4+0]);
	patch.max.y = Math.max(patch.max.y, position[idx*4+1]);
	patch.max.z = Math.max(patch.max.z, position[idx*4+2]);
	patch.max.w = Math.max(patch.max.w, position[idx*4+3]);
	patch.min.x = Math.min(patch.min.x, position[idx*4+0]);
	patch.min.y = Math.min(patch.min.y, position[idx*4+1]);
	patch.min.z = Math.min(patch.min.z, position[idx*4+2]);
	patch.min.w = Math.min(patch.min.w, position[idx*4+3]);
}

function evaluateCount(patch, tessellation) {
	var L;
	L = tessellation;
	if(patch.kind === PatchType.Triangle) {
		return { vertexCount: (L+1)*(L+2)/2, indexCount: L*L*3 };
	} else if(patch.kind === PatchType.Quadrilateral) {
		return { vertexCount: (L+1)*(L+1), indexCount: L*L*2*3 };
	} else if(patch.kind === PatchType.Polyhedral) {
		// reusing orderU as numVertices and orderV as numFaces + extraFaces from splitting
		return { vertexCount: patch.orderU, indexCount: patch.orderV*3};
	} else {
		throw new Error("Not implemented");
	}
}

function evaluate(patch, tessellation, baseVertex, baseIndex, output, vertexOffset) {
	var L,i,j, ui, vi, row, col, b, pos, nor, curv, ind;
	L = tessellation;
	pos = output.position;
	nor = output.normal;
	curv = output.curvature;
	ind = output.index;
		
	if(patch.kind === PatchType.Triangle) {
		throw new Error("Not implemented");
	} else if(patch.kind === PatchType.Quadrilateral) {

		/* Evaluate vertices */
		
		// array that will contain all vertices of the patch
		var bb = new Array( (L+1) * (L+1));
		for (var i=0; i < bb.length; i++) {
			bb[i] = new vec4();
		}
		
		j = baseVertex;
		for(vi = 0; vi <= L; vi++) {
			for(ui = 0; ui <= L; ui++) {
				deCasteljauQuad(patch, ui/L, vi/L, pos, nor, curv, j, L);
				bb[(vi*(L+1)) + ui].set(pos[j*4+0],pos[j*4+1],pos[j*4+2],pos[j*4+3]);
				j += 1;
			}
		}
		//console.log(bb);
		
		/* Evaluate curvature */
		evaluateCurvature(bb, curv, patch.orderU, patch.orderV, baseVertex, L);

		/* Set-up connectivity */
		j = baseIndex;
		for(row = 0; row < L; row ++) {
			for(col = 0; col < L; col ++) {
				b = baseVertex - vertexOffset + row * (L+1) + col;
				ind[j + 0] = b;
				ind[j + 1] = b + (L+1);
				ind[j + 2] = b + 1;
				ind[j + 3] = b + 1;
				ind[j + 4] = b + (L+1);
				ind[j + 5] = b + (L+1) +  1;
				
				j += 6;
			}
		}
	} else if(patch.kind === PatchType.Polyhedral) {
		//TODO maybe put this in separate function for clarity?
		//TODO recheck use of baseVertex and baseIndex
		// compute face normals
		// face normal numbers in bv file point to index of vertex
		var v = patch.controlPoints;
		var f = patch.faces;
		
		for (i = 0; i < v.length; i++) {
			pos[i*4+0 + baseVertex*4] = v[i].x;
			pos[i*4+1 + baseVertex*4] = v[i].y;
			pos[i*4+2 + baseVertex*4] = v[i].z;
			pos[i*4+3 + baseVertex*4] = v[i].w;
			
			patch.max.x = Math.max(patch.max.x, pos[i*4+0 + baseVertex*4]);
			patch.max.y = Math.max(patch.max.y, pos[i*4+1 + baseVertex*4]);
			patch.max.z = Math.max(patch.max.z, pos[i*4+2 + baseVertex*4]);
			patch.max.w = Math.max(patch.max.w, pos[i*4+3 + baseVertex*4]);
			patch.min.x = Math.min(patch.min.x, pos[i*4+0 + baseVertex*4]);
			patch.min.y = Math.min(patch.min.y, pos[i*4+1 + baseVertex*4]);
			patch.min.z = Math.min(patch.min.z, pos[i*4+2 + baseVertex*4]);
			patch.min.w = Math.min(patch.min.w, pos[i*4+3 + baseVertex*4]);
		}
		
		var cb = new vec4(0,0,0,0);
		var ab = new vec4(0,0,0,0);
		for (i = 0; i < f.length; i++) {
			var face = f[i];
			
			ind[i*3+0 + baseIndex] = face.x;
			ind[i*3+1 + baseIndex] = face.y;
			ind[i*3+2 + baseIndex] = face.z;
			
			var vA = v[face.x];
			var vB = v[face.y];
			var vC = v[face.z];
			
			cb.subVec(vC, vB);
			ab.subVec(vA, vB);
			cb.cross(ab);
			
			cb.normalize();
			
			// vertex normals from face normals
			//TODO find a better way to get vertex normals from face normals, perhaps weighted
			nor[face.x*3+0 + baseVertex*3] += cb.x;
			nor[face.y*3+0 + baseVertex*3] += cb.x;
			nor[face.z*3+0 + baseVertex*3] += cb.x;
			nor[face.x*3+1 + baseVertex*3] += cb.y;
			nor[face.y*3+1 + baseVertex*3] += cb.y;
			nor[face.z*3+1 + baseVertex*3] += cb.y;
			nor[face.x*3+2 + baseVertex*3] += cb.z;
			nor[face.y*3+2 + baseVertex*3] += cb.z;
			nor[face.z*3+2 + baseVertex*3] += cb.z;
			
		}
		
		// normalize vertex normals
		for (i = 0; i < nor.length; i+= 3) {
			var tempVec = new vec4(nor[i+0 + baseVertex*3],nor[i+1 + baseVertex*3],nor[i+2 + baseVertex*3],0);
			tempVec.normalize();
			nor[i+0 + baseVertex*3] = tempVec.x;
			nor[i+1 + baseVertex*3] = tempVec.y;
			nor[i+2 + baseVertex*3] = tempVec.z;
		}
	} else {
		throw new Error("Not implemented");
	}
}

function evaluateCurvature(bb, curv, degu, degv, idx, L) {
	//TODO fix
	//TODO lazy evaluation, i.e. only calculate curvature when control is active
	var h, vi, ui;
	var tempCurv = new vec4();
	j = idx;
	for (vi = 0; vi < (L-1); vi++) {
		for(ui = 0; ui < (L-1); ui++) {
			//console.log("vi, ui, |- stencil: " + vi + " " + ui);
			//stencil is |-
			h = crv.crv4(bb[(vi*(L+1))+ui],bb[(vi*(L+1))+ui+1],bb[(vi*(L+1))+ui+2],
				bb[((vi+1)*(L+1))+ui],bb[((vi+2)*(L+1))+ui],bb[((vi+1)*(L+1))+ui+1], degu, degv, tempCurv);
				
				//console.log("tempCurv: " + tempCurv.x + " " + tempCurv.y + " " + tempCurv.z + " " + tempCurv.w);
				
			curv[j*4+0] = tempCurv.x;
			curv[j*4+1] = tempCurv.y;
			curv[j*4+2] = tempCurv.z;
			curv[j*4+3] = tempCurv.w;
			j += 1;
		}
		
		for (ui; ui < (L+1); ui++) {
			//console.log("vi, ui, -| stencil: " + vi + " " + ui);
			//last cols, -| note: stencil is rotated by 90 degrees
			h = crv.crv4(bb[(vi*(L+1))+ui],bb[((vi+1)*(L+1))+ui],bb[((vi+2)*(L+1))+ui],bb[(vi*(L+1))+ui-1],
				bb[(vi*(L+1))+ui-2],bb[((vi+1)*(L+1))+ui-1], degv, degu, tempCurv);
				
				//console.log("tempCurv: " + tempCurv.x + " " + tempCurv.y + " " + tempCurv.z + " " + tempCurv.w);
				
			curv[j*4+0] = tempCurv.x;
			curv[j*4+1] = tempCurv.y;
			curv[j*4+2] = tempCurv.z;
			curv[j*4+3] = tempCurv.w;
			j += 1;
		}
	}

	for (vi; vi < (L+1); vi++) {
		//stencil is |_
		for (ui = 0; ui < (L-1); ui++) {
			//console.log("vi, ui, |_ stencil: " + vi + " " + ui);
			h = crv.crv4(bb[(vi*(L+1))+ui],bb[((vi-1)*(L+1))+ui],bb[((vi-2)*(L+1))+ui],
				bb[(vi*(L+1))+ui+1],bb[(vi*(L+1))+ui+2],bb[((vi-1)*(L+1))+ui+1], degv, degu, tempCurv);
				
				//console.log("tempCurv: " + tempCurv.x + " " + tempCurv.y + " " + tempCurv.z + " " + tempCurv.w);
				
			curv[j*4+0] = tempCurv.x;
			curv[j*4+1] = tempCurv.y;
			curv[j*4+2] = tempCurv.z;
			curv[j*4+3] = tempCurv.w;
			j += 1;
		}
		
		for (ui; ui < (L+1); ui++) {
			//last cols, stencil is _|
			//console.log("vi, ui, _| stencil: " + vi + " " + ui);
			h = crv.crv4(bb[((vi)*(L+1))+ui],bb[((vi)*(L+1))+ui-1],bb[((vi)*(L+1))+ui-2],bb[((vi-1)*(L+1))+ui],
				bb[((vi-2)*(L+1))+ui],bb[((vi-1)*(L+1))+ui-1], degu, degv, tempCurv);
				
				//console.log("tempCurv: " + tempCurv.x + " " + tempCurv.y + " " + tempCurv.z + " " + tempCurv.w);
				
			curv[j*4+0] = tempCurv.x;
			curv[j*4+1] = tempCurv.y;
			curv[j*4+2] = tempCurv.z;
			curv[j*4+3] = tempCurv.w;
			j += 1;
		}
	}
}