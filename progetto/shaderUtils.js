// shaderUtils.js: Utilità per shader WebGL

export const VERTEX_SHADER = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUV;

// Per instancing: 4 attributi vec4 che compongono la matrice di istanza
attribute vec4 aInstanceModelMatrix0;
attribute vec4 aInstanceModelMatrix1;
attribute vec4 aInstanceModelMatrix2;
attribute vec4 aInstanceModelMatrix3;

uniform mat4 uModelMatrix;
uniform bool uUseInstancing;
uniform mat4 uView;
uniform mat4 uProjection;
uniform float uCurvatureStrength;
uniform vec2 uCurvatureOrigin;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec2 vUV;

void main() {
  mat4 instanceMat = mat4(aInstanceModelMatrix0, aInstanceModelMatrix1, aInstanceModelMatrix2, aInstanceModelMatrix3);
  vec4 localPos = vec4(aPosition, 1.0);

  mat4 model = uModelMatrix;
  if (uUseInstancing) model = uModelMatrix * instanceMat;

  vec4 worldPos = model * localPos;

  // Curvatura cilindrica
  vec2 deltaXZ = worldPos.xz - uCurvatureOrigin;
  float dist = length(deltaXZ);
  worldPos.y -= dist * dist * uCurvatureStrength;

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

uniform vec3 uLightDir;
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
  vec3 N = normalize(vNormal);
  vec3 L = normalize(-uLightDir);
  float diff = max(dot(N, L), 0.0);

  vec3 V = normalize(uCameraPos - vWorldPos);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 14.0);

  vec3 baseCol = uBaseColor;
  if (uUseTexture) {
    vec2 uv = vUV;
    if (uInvertUVY) {
      uv.y = 1.0 - uv.y;
    }
    baseCol = texture2D(uTexture, uv).rgb;
  }

  vec3 skyTint = vec3(0.92, 0.97, 1.0);
  vec3 ambient = 0.42 * baseCol * skyTint;
  vec3 diffuse = 0.60 * max(diff, 0.15) * baseCol;
  vec3 specular = 0.04 * spec * vec3(1.0);

  vec3 litColor = ambient + diffuse + specular;

  if (uEnableFog) {
    float distanceToCam = length(uCameraPos - vWorldPos);
    float fogFactor = clamp((distanceToCam - uFogNear) / (uFogFar - uFogNear), 0.0, 1.0);
    litColor = mix(litColor, uFogColor, fogFactor);
  }

  gl_FragColor = vec4(litColor, 1.0);
}
`;

export const SKY_VERTEX_SHADER = `
attribute vec3 aPosition;

uniform mat4 uProjection;
uniform mat4 uView;
uniform mat4 uModelMatrix;

varying vec3 vViewDir;

void main() {
    vViewDir = aPosition; // Salva la direzione locale del vertice
    
    // Calcola la posizione finale senza alterazioni di curvatura
    gl_Position = uProjection * uView * uModelMatrix * vec4(aPosition, 1.0);
}
`;

export const SKY_FRAGMENT_SHADER = `
precision mediump float;

varying vec3 vViewDir;

uniform vec3 uColorHorizon;
uniform vec3 uColorZenith;

void main() {
    // Normalizza il vettore perché l'interpolazione dei varying ne altera la lunghezza
    vec3 viewDir = normalize(vViewDir);
    
    // Calcola un fattore basato sull'altezza (clampato tra 0 e 1 per evitare artefatti sotto l'orizzonte)
    float factor = clamp(viewDir.y, 0.0, 1.0);
    float gradientFactor = pow(factor, 2.0);
    
    // Interpolazione lineare per creare il gradiente procedurale
    vec3 finalSkyColor = mix(uColorHorizon, uColorZenith, gradientFactor);
    
    gl_FragColor = vec4(finalSkyColor, 1.0);
}
`;

export function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const msg = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Compilation fallita: " + msg);
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
    throw new Error("Link fallito: " + msg);
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
    indexCount: geometry.indices.length,
  };
}

export function setMeshAttributes(gl, program, mesh) {
  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aNormal = gl.getAttribLocation(program, "aNormal");
  const aUV = gl.getAttribLocation(program, "aUV");

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

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.idxBuffer);
}

export function drawMesh(gl, mesh) {
  gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0);
}

export function drawMeshInstanced(gl, program, mesh, matrices, instanceCount) {
  const ext = gl.getExtension('ANGLE_instanced_arrays');
  if (!ext) throw new Error('Instanced arrays not supported');

  // Bind base attributes
  setMeshAttributes(gl, program, mesh);

  // Create/Upload instance buffer (mat4 per instance as 4 vec4s)
  const instanceBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instanceBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, matrices, gl.STATIC_DRAW);

  const loc0 = gl.getAttribLocation(program, 'aInstanceModelMatrix0');
  const loc1 = gl.getAttribLocation(program, 'aInstanceModelMatrix1');
  const loc2 = gl.getAttribLocation(program, 'aInstanceModelMatrix2');
  const loc3 = gl.getAttribLocation(program, 'aInstanceModelMatrix3');

  const bytesPerMatrix = 16 * 4; // 16 floats * 4 bytes
  if (loc0 >= 0) {
    gl.enableVertexAttribArray(loc0);
    gl.vertexAttribPointer(loc0, 4, gl.FLOAT, false, bytesPerMatrix, 0);
    ext.vertexAttribDivisorANGLE(loc0, 1);
  }
  if (loc1 >= 0) {
    gl.enableVertexAttribArray(loc1);
    gl.vertexAttribPointer(loc1, 4, gl.FLOAT, false, bytesPerMatrix, 4 * 4);
    ext.vertexAttribDivisorANGLE(loc1, 1);
  }
  if (loc2 >= 0) {
    gl.enableVertexAttribArray(loc2);
    gl.vertexAttribPointer(loc2, 4, gl.FLOAT, false, bytesPerMatrix, 8 * 4);
    ext.vertexAttribDivisorANGLE(loc2, 1);
  }
  if (loc3 >= 0) {
    gl.enableVertexAttribArray(loc3);
    gl.vertexAttribPointer(loc3, 4, gl.FLOAT, false, bytesPerMatrix, 12 * 4);
    ext.vertexAttribDivisorANGLE(loc3, 1);
  }

  // Draw instanced
  ext.drawElementsInstancedANGLE(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_INT, 0, instanceCount);

  // Cleanup divisors
  if (loc0 >= 0) ext.vertexAttribDivisorANGLE(loc0, 0);
  if (loc1 >= 0) ext.vertexAttribDivisorANGLE(loc1, 0);
  if (loc2 >= 0) ext.vertexAttribDivisorANGLE(loc2, 0);
  if (loc3 >= 0) ext.vertexAttribDivisorANGLE(loc3, 0);

  // disable instance attrib arrays to avoid affecting subsequent non-instanced draws
  if (loc0 >= 0) gl.disableVertexAttribArray(loc0);
  if (loc1 >= 0) gl.disableVertexAttribArray(loc1);
  if (loc2 >= 0) gl.disableVertexAttribArray(loc2);
  if (loc3 >= 0) gl.disableVertexAttribArray(loc3);

  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.deleteBuffer(instanceBuffer);
}

export async function loadTexture(gl, url) {
  return new Promise((resolve, reject) => {
    console.log("Caricando texture:", url);
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
    image.crossOrigin = "anonymous";
    image.onload = () => {
      console.log("Texture caricata OK:", url, "Dimensioni:", image.width, "x", image.height);
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
      console.error("Errore caricamento texture:", url);
      reject(new Error("Impossibile caricare texture: " + url));
    };
    image.src = url;
  });
}
