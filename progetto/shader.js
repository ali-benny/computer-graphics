export const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

// Per instancing: 4 attributi vec4 per la matrice + 1 float per l'opacità
attribute vec4 aInstanceModelMatrix0;
attribute vec4 aInstanceModelMatrix1;
attribute vec4 aInstanceModelMatrix2;
attribute vec4 aInstanceModelMatrix3;
attribute float aInstanceOpacity; 

uniform mat4 uModelMatrix;
uniform bool uUseInstancing;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uCurvatureStrength;
uniform vec2 uCurvatureOrigin;
uniform float uOpacity; // Fallback per rendering non-istanziato

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUV;
varying float vOpacity;

void main() {
  mat4 instanceMat = mat4(aInstanceModelMatrix0, aInstanceModelMatrix1, aInstanceModelMatrix2, aInstanceModelMatrix3);
  vec4 localPos = vec4(aPosition, 1.0);

  mat4 model = uModelMatrix;
  if (uUseInstancing) {
    model = uModelMatrix * instanceMat;
    vOpacity = aInstanceOpacity;
  } else {
    vOpacity = uOpacity;
  }

  vec4 worldPos = model * localPos;

  // Curvatura cilindrica
  vec2 deltaXZ = worldPos.xz - uCurvatureOrigin;
  float distZ = worldPos.z - uCurvatureOrigin.y;
  worldPos.y -= distZ * distZ * uCurvatureStrength;

  mat3 normalMat = mat3(model);
  vWorldPos = worldPos.xyz;
  vNormal = normalMat * aNormal;
  vUV = aUV;

  gl_Position = uProjection * uView * worldPos;
}
`;

export const FRAGMENT_SHADER = `
precision mediump float;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUV;
varying float vOpacity;

uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uBaseColor;
uniform vec3 uCameraPos;
uniform sampler2D uTexture;
uniform bool uUseTexture;
uniform bool uInvertUVY;
uniform bool uEnableFog;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;

void main() {
  if (vOpacity < 0.05) {
    discard;
  }
  vec3 N = normalize(vNormal);
  vec3 L = normalize(-uLightDir);
  float diff = max(dot(N, L), 0.0);

  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 14.0);

  vec3 baseCol = uBaseColor;
  float texAlpha = 1.0;

  if (uUseTexture) {
    vec4 texColor = texture2D(uTexture, vUV);
    baseCol = texColor.rgb;
    texAlpha = texColor.a;
  }

  // Alpha Cutout opzionale per foglie trasparenti (se la texture ha parti vuote)
  if (texAlpha < 0.1) {
    discard;
  }

  vec3 skyTint = vec3(0.92, 0.97, 1.0);
  vec3 ambient = 0.42 * baseCol * skyTint;
  vec3 diffuse = 0.60 * max(diff, 0.15) * baseCol * uLightColor;
  vec3 specular = 0.04 * spec * vec3(1.0);

  vec3 litColor = ambient + diffuse + specular;

  if (uEnableFog) {
    float distanceToCam = length(uCameraPos - vWorldPos);
    float fogFactor = clamp((distanceToCam - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    litColor = mix(litColor, uFogColor, fogFactor);
  }

  // Combina l'Alpha della texture con l'opacità passata (uniform o istanziata)
  gl_FragColor = vec4(litColor, texAlpha * vOpacity);
}
`;

export const SKY_VERTEX_SHADER = `
attribute vec3 aPosition;

uniform mat4 uProjection;
uniform mat4 uView;

varying vec3 vWorldDir;

void main() {
	vWorldDir = aPosition;

	// Rimuoviamo la traslazione dalla View Matrix mantenendo le rotazioni della camera
    mat4 viewNoTranslation = uView;
    viewNoTranslation[3] = vec4(0.0, 0.0, 0.0, 1.0);

    // Rendering sullo sfondo
    vec4 pos = uProjection * viewNoTranslation * vec4(aPosition, 1.0);
    gl_Position = pos.xyww;
}
`;

export const SKY_FRAGMENT_SHADER = `
precision mediump float;

varying vec3 vWorldDir;

uniform vec3 uColorHorizon;
uniform vec3 uColorZenith;

void main() {
    vec3 dir = normalize(vWorldDir);
    
    // Convertiamo l'intervallo Y da [-1.0, 1.0] a [0.0, 1.0] per coprire tutta la sfera
    float height = dir.y * 0.5 + 0.5;
    
    // Normalizziamo con clamp per sicurezza
    height = clamp(height, 0.0, 1.0);
    
    // Curve smooth: rende la transizione più morbida
    float factor = smoothstep(0.39, 0.5, height);

    vec3 finalColor = mix(uColorHorizon, uColorZenith, factor);
    
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

export function createShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const msg = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error('Compilation fallita: ' + msg);
	}
	return shader;
}

export function createProgram(gl, vsSource, fsSource) {
	const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
	const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);

	const program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const msg = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error('Link fallito: ' + msg);
	}

	gl.deleteShader(vs);
	gl.deleteShader(fs);
	return program;
}

export function createMesh(gl, geometry) {
	const posBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);

	const normBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);

	let uvBuffer = null;
	if (geometry.uvs) {
		uvBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, geometry.uvs, gl.STATIC_DRAW);
	}

	const idxBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);

	return {
		posBuffer,
		normBuffer,
		uvBuffer,
		idxBuffer,
		indexCount: geometry.indices.length
	};
}

export function setMeshAttributes(gl, program, mesh) {
	const aPosition = gl.getAttribLocation(program, 'aPosition');
	const aNormal = gl.getAttribLocation(program, 'aNormal');
	const aUV = gl.getAttribLocation(program, 'aUV');

	if (aPosition >= 0 && mesh.posBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.posBuffer);
		gl.enableVertexAttribArray(aPosition);
		gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, 0, 0);
	} else if (aPosition >= 0) {
		gl.disableVertexAttribArray(aPosition);
	}

	if (aNormal >= 0 && mesh.normBuffer) {
		gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normBuffer);
		gl.enableVertexAttribArray(aNormal);
		gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);
	} else if (aNormal >= 0) {
		gl.disableVertexAttribArray(aNormal);
	}

	if (aUV >= 0) {
		if (mesh.uvBuffer) {
			gl.bindBuffer(gl.ARRAY_BUFFER, mesh.uvBuffer);
			gl.enableVertexAttribArray(aUV);
			gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
		} else {
			gl.disableVertexAttribArray(aUV);
		}
	}

	// Disabilita gli attributi di istanza se non sono necessari
	const locs = [
        gl.getAttribLocation(program, 'aInstanceModelMatrix0'),
        gl.getAttribLocation(program, 'aInstanceModelMatrix1'),
        gl.getAttribLocation(program, 'aInstanceModelMatrix2'),
        gl.getAttribLocation(program, 'aInstanceModelMatrix3'),
        gl.getAttribLocation(program, 'aInstanceOpacity')
    ];
    for (const loc of locs) {
        if (loc >= 0) {
            gl.disableVertexAttribArray(loc);
        }
    }

	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuffer);
}

export function drawMesh(gl, mesh) {
	gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);
}

let instanceBuffer = null;
let opacityBuffer = null;

export function drawMeshInstanced(gl, program, mesh, matrices, opacities, instanceCount) {
	const ext = gl.getExtension('ANGLE_instanced_arrays');
	if (!ext) throw new Error('Instanced arrays not supported');

	setMeshAttributes(gl, program, mesh);

	// Buffer delle Matrici di Istanza
	if (!instanceBuffer) instanceBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.DYNAMIC_DRAW);

	const locs = [
        gl.getAttribLocation(program, 'aInstanceModelMatrix0'),
        gl.getAttribLocation(program, 'aInstanceModelMatrix1'),
        gl.getAttribLocation(program, 'aInstanceModelMatrix2'),
        gl.getAttribLocation(program, 'aInstanceModelMatrix3'),
    ];

	const bytesPerMatrix = 16 * 4;
	locs.forEach((loc, i) => {
		if (loc >= 0) {
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, bytesPerMatrix, i * 16);
			ext.vertexAttribDivisorANGLE(loc, 1);
		}
	});

	// Buffer delle Opacità di Istanza
	const locOpacity = gl.getAttribLocation(program, 'aInstanceOpacity');
	if (locOpacity >= 0 && opacities) {
		if (!opacityBuffer) opacityBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, opacityBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, opacities, gl.DYNAMIC_DRAW);

		gl.enableVertexAttribArray(locOpacity);
		gl.vertexAttribPointer(locOpacity, 1, gl.FLOAT, false, 0, 0);
		ext.vertexAttribDivisorANGLE(locOpacity, 1);
	}

	// Disegno Istanziato
	ext.drawElementsInstancedANGLE(
		gl.TRIANGLES,
		mesh.indexCount,
		gl.UNSIGNED_INT,
		0,
		instanceCount
	);

	// Cleanup Divisors e Attributi per non inquinare le chiamate successive
	locs.forEach((loc) => {
		if (loc >= 0) {
			ext.vertexAttribDivisorANGLE(loc, 0);
			gl.disableVertexAttribArray(loc);
		}
	});
	if (locOpacity >= 0) {
		ext.vertexAttribDivisorANGLE(locOpacity, 0);
		gl.disableVertexAttribArray(locOpacity);
	}

	gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

export async function loadTexture(gl, url) {
	return new Promise((resolve, reject) => {
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		const applyTextureParams = (isPowerOfTwo) => {
			if (isPowerOfTwo) {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			} else {
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			}
		};

		const image = new Image();
		image.crossOrigin = 'anonymous';
		image.onload = () => {
			// Chiede a WebGL di capovolgere l'immagine sull'asse Y al momento del caricamento
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			const isPowerOfTwo = (value) => (value & (value - 1)) === 0;
			const textureIsPowerOfTwo = isPowerOfTwo(image.width) && isPowerOfTwo(image.height);
			applyTextureParams(textureIsPowerOfTwo);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
			if (textureIsPowerOfTwo) {
				gl.generateMipmap(gl.TEXTURE_2D);
			}
			resolve(texture);
		};
		image.onerror = () => {
			reject(new Error('Impossibile caricare texture: ' + url));
		};
		image.src = url;
	});
}
