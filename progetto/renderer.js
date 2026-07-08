// renderer.js: Setup WebGL e render loop

import { mat4Perspective, mat4Translate, mat4Scale, mat4Multiply } from "./math.js";
import { createProgram, VERTEX_SHADER, FRAGMENT_SHADER, setMeshAttributes, drawMesh, loadTexture } from "./shaderUtils.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl");
    if (!this.gl) {
      throw new Error("WebGL non supportato");
    }

    const ext = this.gl.getExtension("OES_element_index_uint");
    if (!ext) {
      throw new Error("OES_element_index_uint non supportato");
    }

    this.program = createProgram(this.gl, VERTEX_SHADER, FRAGMENT_SHADER);

    this.uModelMatrix = this.gl.getUniformLocation(this.program, "uModelMatrix");
    this.uView = this.gl.getUniformLocation(this.program, "uView");
    this.uProjection = this.gl.getUniformLocation(this.program, "uProjection");
    this.uLightDir = this.gl.getUniformLocation(this.program, "uLightDir");
    this.uBaseColor = this.gl.getUniformLocation(this.program, "uBaseColor");
    this.uCameraPos = this.gl.getUniformLocation(this.program, "uCameraPos");
    this.uTexture = this.gl.getUniformLocation(this.program, "uTexture");
    this.uUseTexture = this.gl.getUniformLocation(this.program, "uUseTexture");
    this.uInvertUVY = this.gl.getUniformLocation(this.program, "uInvertUVY");
    this.uEnableFog = this.gl.getUniformLocation(this.program, "uEnableFog");
    this.uFogColor = this.gl.getUniformLocation(this.program, "uFogColor");
    this.uFogNear = this.gl.getUniformLocation(this.program, "uFogNear");
    this.uFogFar = this.gl.getUniformLocation(this.program, "uFogFar");
    this.uCurvatureStrength = this.gl.getUniformLocation(this.program, "uCurvatureStrength");
    this.uCurvatureOrigin = this.gl.getUniformLocation(this.program, "uCurvatureOrigin");
    this.uUseInstancing = this.gl.getUniformLocation(this.program, "uUseInstancing");

    this.gl.enable(this.gl.DEPTH_TEST);
    // this.gl.enable(this.gl.CULL_FACE); // DISABILITATO per debug
    // this.gl.cullFace(this.gl.BACK);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }

  render(camera, objects, options = {}) {
    const gl = this.gl;
    const lightDir = options.lightDir || [-0.35, 1.0, 0.25];
    const enableFog = Boolean(options.enableFog);
    const fogColor = options.fogColor || [0.84, 0.93, 0.98];
    const fogNear = options.fogNear ?? 10.0;
    const fogFar = options.fogFar ?? 40.0;
    const curvatureStrength = options.curvatureStrength ?? 0.018;
    const curvatureOrigin = options.curvatureOrigin || [0, 0];

    gl.clearColor(0.24, 0.45, 0.22, 1); // sfondo tono terreno (niente linea cielo)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.program);

    const projection = mat4Perspective(
      Math.PI / 4,
      this.canvas.width / this.canvas.height,
      0.2,
      140
    );
    const view = camera.getViewMatrix();

    gl.uniformMatrix4fv(this.uProjection, false, new Float32Array(projection));
    gl.uniformMatrix4fv(this.uView, false, new Float32Array(view));
    gl.uniform3f(this.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
    gl.uniform3f(this.uCameraPos, camera.position[0], camera.position[1], camera.position[2]);
    gl.uniform1i(this.uEnableFog, enableFog);
    gl.uniform3f(this.uFogColor, fogColor[0], fogColor[1], fogColor[2]);
    gl.uniform1f(this.uFogNear, fogNear);
    gl.uniform1f(this.uFogFar, fogFar);
    gl.uniform1f(this.uCurvatureStrength, curvatureStrength);
    gl.uniform2f(this.uCurvatureOrigin, curvatureOrigin[0], curvatureOrigin[1]);

    // Disegna ogni oggetto
    for (const obj of objects) {
      gl.uniformMatrix4fv(this.uModelMatrix, false, new Float32Array(obj.modelMatrix));
      gl.uniform3f(this.uBaseColor, obj.color[0], obj.color[1], obj.color[2]);

      const useTexture = obj.texture ? true : false;
      gl.uniform1i(this.uUseTexture, useTexture);
      gl.uniform1i(this.uInvertUVY, obj.invertUVY ? true : false);

      if (obj.texture) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, obj.texture);
        gl.uniform1i(this.uTexture, 0);
      }

      setMeshAttributes(gl, this.program, obj.mesh);
      drawMesh(gl, obj.mesh);
    }
  }
}

export function createCanvas() {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  document.body.style.margin = "0";
  document.body.style.background = "#1a1a1a";
  document.body.appendChild(canvas);
  return canvas;
}
