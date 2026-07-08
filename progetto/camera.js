// camera.js: Gestione camera FPS con WASD + mouse look

import { vec3Add, vec3Scale, vec3Normalize, mat4LookAt } from "./math.js";

export class Camera {
  constructor(pos = [0, 1.5, 3], target = [0, 0, 0], canvas = document.body) {
    this.position = [...pos];
    this.target = [...target];
    this.up = [0, 1, 0];

    this.yaw = 0;
    this.pitch = 0;
    this.speed = 3; // m/s (usato solo in modalità free)
    this.mouseSensitivity = 0.004;

    this.keys = {};
    this.deltaTime = 0;
    this.lastTime = Date.now();

    // Memorizza il canvas per pointer lock e input specifico
    this.canvas = canvas;

    // Modalità camera: "free" (FPS), "follow" (terza persona)
    this.mode = "free";
    this.followTarget = null; // Se in modalità follow, ref al player

    // Parametri follow camera
    this.followDistance = 5.0; // distanza dietro il target
    this.followHeight = 2.0; // altezza offset
    this.pitchFollow = 0.5; // pitch in follow mode (angolo fisso o legato a mouse)
    this.smoothing = 0.1; // interpolazione posizione camera (0 = istantanea, 1 = infinito)

    // Parametri modalità rolling-log (camera alta + 45° verso il basso)
    this.rollingHeight = 8.0;
    this.rollingBackDistance = 8.0;
    this.rollingLookAhead = 0.0;

    this.setupInput();
  }

  setKey(key, pressed) {
    this.keys[key.toLowerCase()] = pressed;
  }

  look(deltaX, deltaY, sensitivityFactor = 1) {
    if (this.mode === "rolling-follow") {
      return;
    }

    this.yaw -= deltaX * this.mouseSensitivity * sensitivityFactor;
    this.pitch -= deltaY * this.mouseSensitivity * sensitivityFactor;
    this.pitch = Math.max(-Math.PI * 0.5, Math.min(Math.PI * 0.5, this.pitch));
  }

  setupInput() {
    window.addEventListener("keydown", (e) => {
      this.setKey(e.key, true);
    });
    window.addEventListener("keyup", (e) => {
      this.setKey(e.key, false);
    });

    window.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.look(e.movementX, e.movementY);
      }
    });

    // Richiesta pointer lock SOLO quando si clicca il canvas
    this.canvas.addEventListener("click", (ev) => {
      if (window.matchMedia("(pointer: fine)").matches) {
        this.canvas.requestPointerLock?.();
      }
    });
  }

  updatePosition(deltaTime) {
    this.deltaTime = deltaTime;

    if (this.mode === "free") {
      this.updatePositionFree(deltaTime);
    } else if (this.mode === "rolling-follow" && this.followTarget) {
      this.updatePositionRollingFollow(deltaTime);
    } else if (this.mode === "follow" && this.followTarget) {
      this.updatePositionFollow(deltaTime);
    }
  }

  updatePositionRollingFollow(deltaTime) {
    // Camera stile Rolling Log: alta, inclinata di 45°, player centrato.
    const target = this.followTarget;

    const headingYaw = this.yaw;
    const forwardX = Math.sin(headingYaw);
    const forwardZ = -Math.cos(headingYaw);

    const desiredPos = [
      target.position[0] - forwardX * this.rollingBackDistance,
      target.position[1] + this.rollingHeight,
      target.position[2] - forwardZ * this.rollingBackDistance,
    ];

    if (this.smoothing > 0.01) {
      this.position[0] += (desiredPos[0] - this.position[0]) * this.smoothing;
      this.position[1] += (desiredPos[1] - this.position[1]) * this.smoothing;
      this.position[2] += (desiredPos[2] - this.position[2]) * this.smoothing;
    } else {
      this.position = [...desiredPos];
    }

    // Pitch forzato a -45° (verso il basso).
    this.pitch = -Math.PI * 0.25;

    this.target = [
      target.position[0] + forwardX * this.rollingLookAhead,
      target.position[1],
      target.position[2] + forwardZ * this.rollingLookAhead,
    ];
  }

  updatePositionFree(deltaTime) {
    // Direzione forward (ignorando Y)
    const forwardX = Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);

    // Direzione right
    const rightX = Math.cos(this.yaw);
    const rightZ = Math.sin(this.yaw);

    const moveSpeed = this.speed * deltaTime;

    // WASD movement
    if (this.keys["w"]) {
      this.position[0] += forwardX * moveSpeed;
      this.position[2] += forwardZ * moveSpeed;
    }
    if (this.keys["s"]) {
      this.position[0] -= forwardX * moveSpeed;
      this.position[2] -= forwardZ * moveSpeed;
    }
    if (this.keys["a"]) {
      this.position[0] -= rightX * moveSpeed;
      this.position[2] -= rightZ * moveSpeed;
    }
    if (this.keys["d"]) {
      this.position[0] += rightX * moveSpeed;
      this.position[2] += rightZ * moveSpeed;
    }

    // Verticale (Q/E)
    if (this.keys["q"]) {
      this.position[1] -= moveSpeed;
    }
    if (this.keys["e"]) {
      this.position[1] += moveSpeed;
    }

    // Aggiorna target (guardo sempre nella direzione yaw/pitch)
    const distance = 0.1;
    this.target = [
      this.position[0] + Math.sin(this.yaw) * Math.cos(this.pitch) * distance,
      this.position[1] + Math.sin(this.pitch) * distance,
      this.position[2] - Math.cos(this.yaw) * Math.cos(this.pitch) * distance,
    ];
  }

  updatePositionFollow(deltaTime) {
    // Modalità follow: camera dietro il target (player)
    const target = this.followTarget;

    // Yaw della camera = yaw del player + pitch controllato dal mouse
    const targetYaw = target.yaw;

    // Calcola forward direction dal target yaw
    const forwardX = Math.sin(targetYaw);
    const forwardZ = -Math.cos(targetYaw);

    // Posizione desiderata della camera: dietro e sopra il target
    const desiredDist = this.followDistance;
    const desiredHeight = target.position[1] + this.followHeight;
    const desiredPos = [
      target.position[0] - forwardX * desiredDist,
      desiredHeight,
      target.position[2] - forwardZ * desiredDist,
    ];

    // Smooth camera movement
    if (this.smoothing > 0.01) {
      this.position[0] += (desiredPos[0] - this.position[0]) * this.smoothing;
      this.position[1] += (desiredPos[1] - this.position[1]) * this.smoothing;
      this.position[2] += (desiredPos[2] - this.position[2]) * this.smoothing;
    } else {
      this.position = [...desiredPos];
    }

    // Pitch della camera: fixato a valori positivi (guarda leggermente dall'alto)
    // mouse/touch può modulare leggermente questo
    this.pitch = Math.max(-0.2, Math.min(0.5, this.pitch));

    // Target: leggermente avanti e sopra al player
    const lookAhead = 1.0;
    this.target = [
      target.position[0] + forwardX * lookAhead,
      target.position[1] + 0.6,
      target.position[2] + forwardZ * lookAhead,
    ];
  }

  getViewMatrix() {
    return mat4LookAt(this.position, this.target, this.up);
  }
}
