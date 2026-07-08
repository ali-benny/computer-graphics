// player.js: Player controller con movimento, rotazione e collisioni base

export class PlayerController {
  constructor(startPos = [0, 0, 0], speed = 12) {
    this.position = [...startPos];
    this.yaw = 0; // rotazione Y (radianti)
    this.velocity = [0, 0, 0]; // velocità attuale per smooth movement
    this.radius = 0.35; // raggio collisore cilindrico
    this.maxSpeed = speed; // velocità massima (m/s)
    this.acceleration = 45; // accelerazione (m/s^2)
    this.friction = 0.85; // attrito per decelerazione
    this.grounded = true; // sempre true in 2D top-down
  }

  /**
   * Aggiorna il player:
   * - Applica accelerazione dalle azioni di input
   * - Applica attrito per decelerazione naturale
   * - Risolve collisioni con collider statici
   * - Aggiorna posizione XZ
   */
  update(deltaTime, inputActions, colliders = [], cameraForward = [0, 0, -1], cameraRight = [1, 0, 0]) {
    // 1. Accelerazione da input
    if (inputActions.moveForward || inputActions.moveBackward || inputActions.moveLeft || inputActions.moveRight) {
      // Direzione di movimento desiderata (calcolata da input)
      const moveDir = this.computeMoveDirection(inputActions, cameraForward, cameraRight);
      if (moveDir) {
        const [dx, dz] = moveDir;
        // Accelera verso questa direzione
        this.velocity[0] += dx * this.acceleration * deltaTime;
        this.velocity[2] += dz * this.acceleration * deltaTime;
      }
    } else {
      // Applica attrito se non ci sono input
      this.velocity[0] *= this.friction;
      this.velocity[2] *= this.friction;
    }

    // 2. Limita velocità massima
    const speed = Math.hypot(this.velocity[0], this.velocity[2]);
    if (speed > this.maxSpeed) {
      const scale = this.maxSpeed / speed;
      this.velocity[0] *= scale;
      this.velocity[2] *= scale;
    }

    // 3. Aggiorna yaw basato sulla direzione movimento o camera look (fallback)
    if (speed > 0.1) {
      this.yaw = Math.atan2(this.velocity[0], this.velocity[2]);
    }

    // 4. Movimento tentativo
    let newPos = [
      this.position[0] + this.velocity[0] * deltaTime,
      this.position[1],
      this.position[2] + this.velocity[2] * deltaTime,
    ];

    // 5. Risolvi collisioni
    newPos = this.resolveCollisions(newPos, colliders);

    // 6. Aggiorna posizione finale
    this.position = newPos;
  }

  /**
   * Calcola direzione di movimento normalizzata da input relativo alla camera.
   * Richiede che il chiamante passe la direzione forward della camera.
   */
  computeMoveDirection(inputActions, cameraForward = [0, 0, -1], cameraRight = [1, 0, 0]) {
    let moveX = 0;
    let moveZ = 0;

    if (inputActions.moveForward) {
      moveX += cameraForward[0];
      moveZ += cameraForward[2];
    }
    if (inputActions.moveBackward) {
      moveX -= cameraForward[0];
      moveZ -= cameraForward[2];
    }
    if (inputActions.moveRight) {
      moveX += cameraRight[0];
      moveZ += cameraRight[2];
    }
    if (inputActions.moveLeft) {
      moveX -= cameraRight[0];
      moveZ -= cameraRight[2];
    }

    const len = Math.hypot(moveX, moveZ);
    if (len < 0.01) return null;

    return [moveX / len, moveZ / len];
  }

  /**
   * Risolvi collisioni con lista di collider statici.
   * Supporta cilindri e AABB (rilevato dal campo `type`).
   */
  resolveCollisions(newPos, colliders) {
    let resolvedPos = [...newPos];

    for (const collider of colliders) {
      if (collider.type === "cylinder") {
        resolvedPos = this.resolveCylinderCollision(resolvedPos, collider);
      } else if (collider.type === "aabb") {
        resolvedPos = this.resolveAABBCollision(resolvedPos, collider);
      } else if (collider.type === "bounds") {
        resolvedPos = this.resolveBoundsCollision(resolvedPos, collider);
      } else if (collider.type === "boundsCircle") {
        resolvedPos = this.resolveBoundsCircleCollision(resolvedPos, collider);
      }
    }

    return resolvedPos;
  }

  /**
   * Collisione cilindro-cilindro (player vs albero/ostacolo circolare).
   */
  resolveCylinderCollision(pos, collider) {
    const dx = pos[0] - collider.center[0];
    const dz = pos[2] - collider.center[2];
    const dist = Math.hypot(dx, dz);
    const minDist = this.radius + collider.radius;

    if (dist < minDist && dist > 0.001) {
      // Push player away
      const ratio = minDist / dist;
      return [
        collider.center[0] + dx * ratio,
        pos[1],
        collider.center[2] + dz * ratio,
      ];
    }
    return pos;
  }

  /**
   * Collisione AABB (player vs casa/recinto).
   * Usa semplice separating axis su asse X e Z.
   */
  resolveAABBCollision(pos, collider) {
    const { min, max } = collider;
    const px = pos[0];
    const pz = pos[2];
    const r = this.radius;

    // Verifica se il bounding circle del player interseca l'AABB
    const closestX = Math.max(min[0], Math.min(px, max[0]));
    const closestZ = Math.max(min[2], Math.min(pz, max[2]));
    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < r * r && distSq > 0.0001) {
      // Collisione: spingi fuori
      const dist = Math.sqrt(distSq);
      const pushDist = r - dist;
      const nx = dx / dist;
      const nz = dz / dist;
      return [px + nx * pushDist, pos[1], pz + nz * pushDist];
    }
    return pos;
  }

  // Collider speciale per tenere il player dentro il mini-mondo.
  resolveBoundsCollision(pos, collider) {
    const { min, max } = collider;
    const r = this.radius;
    const x = Math.max(min[0] + r, Math.min(pos[0], max[0] - r));
    const z = Math.max(min[2] + r, Math.min(pos[2], max[2] - r));
    return [x, pos[1], z];
  }

  resolveBoundsCircleCollision(pos, collider) {
    const center = collider.center || [0, 0, 0];
    const allowedRadius = Math.max(0, (collider.radius || 0) - this.radius);

    const dx = pos[0] - center[0];
    const dz = pos[2] - center[2];
    const dist = Math.hypot(dx, dz);

    if (dist <= allowedRadius || dist < 0.0001) {
      return pos;
    }

    const s = allowedRadius / dist;
    return [center[0] + dx * s, pos[1], center[2] + dz * s];
  }
}
