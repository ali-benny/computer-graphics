// gameObject.js: Classe per oggetti di scena con matrice di trasformazione
import { createMesh, setMeshAttributes, drawMesh } from "./shaderUtils.js";
import { mat4Identity, mat4Translate, mat4Scale, mat4RotateY, mat4Multiply } from "./math.js";

export class GameObject {
  constructor(options = {}) {
    // options: { gl, mesh, geometry, color, texture, invertUVY, position, rotationY, scale }
    this.gl = options.gl || null;
    this.mesh = options.mesh || null;
    if (!this.mesh && options.geometry && this.gl) {
      this.mesh = createMesh(this.gl, options.geometry);
    }

    this.color = options.color || [1.0, 1.0, 1.0];
    this.texture = options.texture || null;
    this.invertUVY = options.invertUVY || false;

    this.position = options.position ? [...options.position] : [0, 0, 0];
    this.rotationY = options.rotationY || 0; // radians
    this.scale = options.scale ? [...options.scale] : [1, 1, 1];

    this.modelMatrix = mat4Identity();
    this.updateModelMatrix();
  }

  setPosition(x, y, z) {
    this.position = [x, y, z];
    this.updateModelMatrix();
  }

  setRotationY(rad) {
    this.rotationY = rad;
    this.updateModelMatrix();
  }

  setScale(sx, sy, sz) {
    this.scale = [sx, sy, sz];
    this.updateModelMatrix();
  }

  updateModelMatrix() {
    const t = mat4Translate(this.position[0], this.position[1], this.position[2]);
    const r = mat4RotateY(this.rotationY);
    const s = mat4Scale(this.scale[0], this.scale[1], this.scale[2]);
    // model = translate * rotateY * scale
    this.modelMatrix = mat4Multiply(t, mat4Multiply(r, s));
  }

  setModelMatrix(matrix) {
    this.modelMatrix = matrix;
  }

  render(gl, program) {
    if (!this.mesh) {
      console.warn("GameObject.render: no mesh available");
      return;
    }

    // Upload model matrix
    const uModelLoc = gl.getUniformLocation(program, "uModelMatrix");
    if (uModelLoc) gl.uniformMatrix4fv(uModelLoc, false, new Float32Array(this.modelMatrix));

    // Upload material / texture flags
    const uBaseColor = gl.getUniformLocation(program, "uBaseColor");
    if (uBaseColor) gl.uniform3f(uBaseColor, this.color[0], this.color[1], this.color[2]);

    const uUseTexture = gl.getUniformLocation(program, "uUseTexture");
    if (uUseTexture) gl.uniform1i(uUseTexture, this.texture ? 1 : 0);

    const uInvertUVY = gl.getUniformLocation(program, "uInvertUVY");
    if (uInvertUVY) gl.uniform1i(uInvertUVY, this.invertUVY ? 1 : 0);

    if (this.texture) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      const uTexture = gl.getUniformLocation(program, "uTexture");
      if (uTexture) gl.uniform1i(uTexture, 0);
    }

    setMeshAttributes(gl, program, this.mesh);
    drawMesh(gl, this.mesh);
  }
}

export default GameObject;
