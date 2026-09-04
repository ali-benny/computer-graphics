import { mat4Identity, mat4Translate, mat4Scale, mat4RotateY, mat4Multiply } from './math.js';

export class GameObject {
	constructor(options = {}) {
		this.gl = options.gl || null;
		this.mesh = options.mesh || null;
		this.texture = options.texture || null;
		this.color = options.color || [1.0, 1.0, 1.0];
		this.opacity = options.opacity ?? 1.0;
		this.type = options.type || 'object';

		// Gestione bounds & centramento OBJ
		this.bounds = options.bounds || null;
		this.placeOnGround = options.placeOnGround ?? false;
		this.ySinkMul = options.ySinkMul ?? 0;

		// Trasformazioni locali
		this.position = options.position ? [...options.position] : [0, 0, 0];
		this.rotationY = options.rotationY || 0;
		this.scaleMul = options.scaleMul ?? 1;

		this.modelMatrix = mat4Identity();
		this.updateModelMatrix();
	}

	// Ricalcola la matrice usando sia la posizione che i bounds del modello
	updateModelMatrix() {
		if (!this.bounds) {
			// Fallback standard T * R * S se non ci sono bounds
			const t = mat4Translate(this.position[0], this.position[1], this.position[2]);
			const r = mat4RotateY(this.rotationY);
			const s = mat4Scale(this.scaleMul, this.scaleMul, this.scaleMul);
			this.modelMatrix = mat4Multiply(t, mat4Multiply(r, s));
			return;
		}

		// Algoritmo avanzato con bounds (ex buildModelMatrix)
		const scale = this.bounds.uniformScale * this.scaleMul;
		const minRelY = this.bounds.min[1] - this.bounds.center[1];
		const placeOnGroundY = this.placeOnGround ? -minRelY * scale : 0;
		const extra = this.ySinkMul ? this.ySinkMul * scale : 0;
		const finalTranslate = [
			this.position[0],
			this.position[1] + placeOnGroundY - extra,
			this.position[2]
		];

		this.modelMatrix = mat4Multiply(
			mat4Translate(finalTranslate[0], finalTranslate[1], finalTranslate[2]),
			mat4Multiply(
				mat4RotateY(this.rotationY),
				mat4Multiply(
					mat4Scale(scale, scale, scale),
					mat4Translate(
						-this.bounds.center[0],
						-this.bounds.center[1],
						-this.bounds.center[2]
					)
				)
			)
		);
	}

	// Metodi helper trasparenti che aggiornano anche la matrice
	setPosition(x, y, z) {
		this.position = [x, y, z];
		this.updateModelMatrix();
	}

	setRotationY(rad) {
		this.rotationY = rad;
		this.updateModelMatrix();
	}

	setScaleMul(s) {
		this.scaleMul = s;
		this.updateModelMatrix();
	}
}

export default GameObject;

////// classi estensive //////

export class CloudObject extends GameObject {
  constructor(options) {
    super({ ...options, type: 'cloud' });
    this.velocityX = options.velocityX || 0;
    this.areaX = options.areaX || 50;
    this.wrapMargin = options.wrapMargin || 10;
  }

  update(deltaTime) {
    this.position[0] += this.velocityX * deltaTime;

    // Wrap ai bordi dello schermo
    if (this.position[0] > this.areaX + this.wrapMargin) {
      this.position[0] = -this.areaX - this.wrapMargin;
    } else if (this.position[0] < -this.areaX - this.wrapMargin) {
      this.position[0] = this.areaX + this.wrapMargin;
    }

    this.updateModelMatrix();
  }
}

export class FlowerObject extends GameObject {
  constructor(options) {
    super({ ...options, type: 'flower', placeOnGround: true });
    this.rotationSpeed = options.rotationSpeed || 0;
  }

  update(deltaTime) {
    if (this.rotationSpeed !== 0) {
      this.rotationY += this.rotationSpeed * deltaTime;
      this.updateModelMatrix();
    }
  }
}