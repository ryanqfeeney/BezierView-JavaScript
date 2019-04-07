document.getElementById("bar-menu").addEventListener('click', function(e){
	var u = document.getElementById('ui-panel');
	if(u.style.visibility !== 'hidden'){
		u.style.visibility = 'hidden';
	} else {
		u.style.visibility = '';
	}
});

document.getElementById('btn-reset').addEventListener('click', function(e) {
	resetProjection();
});

document.getElementById('btn-reduce-density').addEventListener('click', function(e) {
	if (settings.highlightDensity > .05){
		settings.highlightDensity -= .05;
	}
});

document.getElementById('btn-increase-density').addEventListener('click', function(e) {
	settings.highlightDensity += .05;
});

document.getElementById('btn-reset-density').addEventListener('click', function(e) {
	settings.highlightDensity = settings.defaultHightlightDensity;
});

function savedPositionsRefresh(after) {
	var o = document.getElementById('select-load-position');
	while (o.hasChildNodes()) {
		o.removeChild(o.lastChild);
	}
	for (var i = 0; i < savedPositions.length; ++i) {
		var option = document.createElement('option');
		option.value = i;
		option.appendChild(document.createTextNode('Position ' + savedPositions[i].id));
		o.appendChild(option);
	}
	after = after || 0;
	o.value = after;
}

function settingsUIRefresh() {
	var hlLine = false;
	var hlRefl = false;
	var hlCurv = false;
	switch(settings.highlight) {
	case HIGHLIGHT.NORMAL:
		hlLine = false;
		hlRefl = false;
		hlCurv = false;
		break;
	case HIGHLIGHT.LINE:
		hlLine = true;
		hlRefl = false;
		hlCurv = false;
		break;
	case HIGHLIGHT.REFLECTION:
		hlLine = false;
		hlRefl = true;
		hlCurv = false;
		break;
	case HIGHLIGHT.CURVATURE:
		hlLine = false;
		hlRefl = false;
		hlCurv = true;
		break;
	}
	document.getElementById('check-highlight').checked = hlLine;
	document.getElementById('check-reflection').checked = hlRefl;
	document.getElementById('check-curvature').checked = hlCurv;
	document.getElementById('check-flat-shading').checked = settings.flatShading;
	document.getElementById('check-flip-normals').checked = settings.flipNormals;
	document.getElementById('check-control-mesh').checked = settings.showControlMesh;
	document.getElementById('check-bounding-box').checked = settings.showBoundingBox;
	document.getElementById('check-patches').checked = settings.showPatches;
	document.getElementById('check-light-1').checked = settings.lightsOn[0] != 0.0;
	document.getElementById('check-light-2').checked = settings.lightsOn[1] != 0.0;
	document.getElementById('check-light-3').checked = settings.lightsOn[2] != 0.0;
}

document.getElementById('remove-position').addEventListener('click', function(e) {
	var index = document.getElementById('select-load-position').value;
	if (index >= 0) {
		savedPositions.splice(index, 1);
		savedPositionsRefresh(index - 1);
	}
});

// TODO also save curvature type

var savedPositionsCount = 0;

var parse_f32_arr = function(obj) {
	var arr = [ 0, 1, 2 ];
	arr[0] = obj[0];
	arr[1] = obj[1];
	arr[2] = obj[2];
	return new Float32Array(arr);
};

var parse_mat4 = function(obj) {
	var ret = new mat4();
	obj = obj.m;
	for (var i in obj) {
		ret.m[i] = obj[i];
	}
	return ret;
};

document.getElementById('save-position').addEventListener('click', function(e) {
	++savedPositionsCount;
	savedPositions.push({
		id: savedPositionsCount,
		translation: new Float32Array(renderState.translation),
		rotation: new Float32Array(renderState.rotation),
		zoom: renderState.zoom,
		scale: renderState.scale,
		projection: new mat4(renderState.projection),
		modelview: new mat4(renderState.modelview),
		setting_flatShading : settings.flatShading,
		setting_flipNormals : settings.flipNormals,
		setting_showControlMesh: settings.showControlMesh,
		setting_showPatches: settings.showPatches,
		setting_highlight: settings.highlight,
		setting_showBoundingBox: settings.showBoundingBox,
		setting_highlightDensity: settings.highlightDensity,
		setting_lightsOn0: settings.lightsOn[0],
		setting_lightsOn1: settings.lightsOn[1],
		setting_lightsOn2: settings.lightsOn[2],
	});
	savedPositionsRefresh(savedPositions.length - 1);
	window.localStorage.setItem('bv_settings', JSON.stringify(savedPositions));
});

var loadSavedPosition = function(index) {
	var s = savedPositions[index];
	renderState.rotation = new Float32Array(s.rotation);
	renderState.translation = new Float32Array(s.translation);
	renderState.projection = new mat4(s.projection);
	renderState.modelview = new mat4(s.modelview);
	renderState.zoom = s.zoom;
	renderState.scale = s.scale;
	settings.flatShading = s.setting_flatShading;
	settings.flipNormals = s.setting_flipNormals;
	settings.showControlMesh = s.setting_showControlMesh;
	settings.showPatches = s.setting_showPatches;
	settings.highlight = s.setting_highlight;
	settings.showBoundingBox = s.setting_showBoundingBox;
	settings.highlightDensity = s.setting_highlightDensity;
	settings.lightsOn[0] = s.setting_lightsOn0;
	settings.lightsOn[1] = s.setting_lightsOn1;
	settings.lightsOn[2] = s.setting_lightsOn2;
	settingsUIRefresh();
	updateProjection();
};

document.getElementById('select-load-position').addEventListener('change', function(e) {
	var index = e.srcElement.value;
	if (index >= 0) {
		loadSavedPosition(index);
	}
});

document.getElementById('select-load-position').addEventListener('click', function(e) {
	if (e.srcElement.length == 1) {
		loadSavedPosition(0);
	}
});

function loadSettings() {
	var stored = window.localStorage.getItem('bv_settings');
	if (stored) {
		// parse stored settings
		var obj = JSON.parse(stored);
		for (var i = 0; i < obj.length; ++i) {
			obj[i].translation = parse_f32_arr(obj[i].translation);
			obj[i].rotation = parse_f32_arr(obj[i].rotation);
			obj[i].projection = parse_mat4(obj[i].projection);
			obj[i].modelview = parse_mat4(obj[i].modelview);
		}
		savedPositions = obj;
	}
	settings = defaultSettings;
	savedPositionsRefresh();
	settingsUIRefresh();
}
window.addEventListener('load', loadSettings);
