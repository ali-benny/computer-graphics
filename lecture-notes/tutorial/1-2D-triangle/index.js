function main() {
	var canvas = document.getElementById('canvas');
	canvas.width = window.innerWidth;
	canvas.height = window.innerHeight;

	// --- webgl context ---
	var gl;
	try {
		gl = canvas.getContext('webgl', { antialias: true });
	} catch (e) {
		alert('WebGL not supported');
		return false;
	}

	// --- shaders ---
	var vertexShaderSource = `
		attribute vec2 position;
		attribute vec3 color;
		varying vec3 v_color;

		void main() {
			gl_Position = vec4(position, 0., 1.);
			v_color = color;
		}
	`;
	var fragmentShaderSource = `
		precision mediump float;
		varying vec3 v_color;
		void main() {
			gl_FragColor = vec4(v_color, 1.);
		}
	`;
	var compileShader = function (source, type, typeString) {
		var shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			alert('Error in ' + typeString + ' shader: ' + gl.getShaderInfoLog(shader));
			return false;
		}
		return shader;
	};

	var vertex = compileShader(vertexShaderSource, gl.VERTEX_SHADER, 'VERTEX');
	var fragment = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER, 'FRAGMENT');

	var programShader = gl.createProgram();
	gl.attachShader(programShader, vertex);
	gl.attachShader(programShader, fragment);

	gl.linkProgram(programShader); // link the shader

	var _color = gl.getAttribLocation(programShader, 'color');
	var _position = gl.getAttribLocation(programShader, 'position');

	gl.enableVertexAttribArray(_color);
	gl.enableVertexAttribArray(_position);

	gl.useProgram(programShader);

	// --- triangle ---
	// ---- points
	var tri_vertex = [-1, -1, // - primo vertice
						0,0,1, //colore primo vertice
						1, -1, // - secondo vertice
						1, 1, 0, //colore secondo vertice
						1, 1, // - terzo vertice
						1, 0, 0 //colore terzo vertice
	];
	var tri_vertex_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, tri_vertex_buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(tri_vertex), gl.STATIC_DRAW);

	// ---- faces
	var tri_faces = [0, 1, 2];
	var tri_faces_buffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tri_faces_buffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(tri_faces), gl.STATIC_DRAW);

	// --- draw ---
	gl.clearColor(0.0, 0.0, 0.0, 0.0); //: transparent

	var animate = function () {
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.bindBuffer(gl.ARRAY_BUFFER, tri_vertex_buffer);
		gl.vertexAttribPointer(_position, 2, gl.FLOAT, false, 4 * 5, 0);
		gl.vertexAttribPointer(_color, 3, gl.FLOAT, false, 4 * 5, 4 * 2);
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tri_faces_buffer);
		gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_SHORT, 0);

		gl.flush();
		window.requestAnimationFrame(animate);
	};
	animate();
}
window.onload = main;
