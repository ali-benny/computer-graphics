import { mat4LookAt } from './math.js';
import { CAMERA } from './const.js';

export class Camera {
	constructor(pos = [0, 1.5, 3], target = [0, 0, 0], canvas = document.body) {
		this.position = [...pos];
		this.target = [...target];
		this.up = [0, 1, 0];

		this.yaw = 0;
		this.pitch = 0;

		this.deltaTime = 0;
		this.lastTime = Date.now();

		// Memorizza il canvas per pointer lock e input specifico
		this.canvas = canvas;

		this.followTarget = null; // Se in modalità follow, ref al player
		this.smoothing = CAMERA.smoothing; // interpolazione posizione camera (0 = istantanea, 1 = infinito)

		// Parametri modalità rolling-log (camera alta + 45° verso il basso)
		this.rollingHeight = CAMERA.rollingHeight;
		this.rollingBackDistance = CAMERA.rollingBackDistance;
		this.rollingLookAhead = CAMERA.rollingLookAhead;

		// Parametri Parallasse
		this.parallaxEnabled = CAMERA.parallaxEnabled;
		this.maxYawOffset = CAMERA.maxYawOffset;
		this.maxPitchOffset = CAMERA.maxPitchOffset;
		this.mouseSmoothing = CAMERA.mouseSmoothing;

		// Offset target (-1 to 1) e offset corrente interpolato
		this.targetMouseOffset = [0, 0];
		this.currentMouseOffset = [0, 0];

		this.setupInput();
	}

	setupInput() {
		window.addEventListener('mousemove', (e) => {
			if (this.parallaxEnabled) {
				// Calcolo posizione normalizzata del mouse rispetto al centro (-1 a +1)
				const centerX = window.innerWidth / 2;
				const centerY = window.innerHeight / 2;

				this.targetMouseOffset[0] = (e.clientX - centerX) / centerX;
				this.targetMouseOffset[1] = (e.clientY - centerY) / centerY;
			}
		});

		//=== sposta camera mobile | Drag dinamico relativo ===//
		this.canvas.addEventListener('touchstart', (e) => {
			if (!this.parallaxEnabled || this._touchId !== null) return;

			// Prende il primo tocco valido (non sugli elementi UI)
			const touch = e.changedTouches[0];
			if (touch.target.closest('#mobileTouchPad, .dg')) return;

			this._touchId = touch.identifier;
			this._lastTouchX = touch.clientX;
			this._lastTouchY = touch.clientY;
		}, { passive: true });

		this.canvas.addEventListener('touchmove', (e) => {
			if (this._touchId === null) return;

			// Trova il dito assegnato alla camera
			const touch = Array.from(e.changedTouches).find(t => t.identifier === this._touchId);
			if (!touch) return;

			// Calcola il delta del movimento dal frame precedente
			const deltaX = (touch.clientX - this._lastTouchX) / window.innerWidth;
			const deltaY = (touch.clientY - this._lastTouchY) / window.innerHeight;

			this._lastTouchX = touch.clientX;
			this._lastTouchY = touch.clientY;

			// Accumula l'offset clampandolo tra -1 e 1
			const sensitivity = 2.5; // Moltiplicatore sensibilità al tocco
			this.targetMouseOffset[0] = Math.max(-1, Math.min(1, this.targetMouseOffset[0] + deltaX * sensitivity));
			this.targetMouseOffset[1] = Math.max(-1, Math.min(1, this.targetMouseOffset[1] + deltaY * sensitivity));
		}, { passive: true });

		const resetTouch = (e) => {
			const touch = Array.from(e.changedTouches).find(t => t.identifier === this._touchId);
			if (touch) {
				this._touchId = null;
			}
		};

		this.canvas.addEventListener('touchend', resetTouch);
		this.canvas.addEventListener('touchcancel', resetTouch);

		this.canvas.addEventListener('click', (ev) => {
			if (window.matchMedia('(pointer: fine)').matches) {
				this.parallaxEnabled = this.parallaxEnabled ? false : true;
			}
		});
	}

	updatePosition(deltaTime) {
		this.deltaTime = deltaTime;
		// Camera stile Rolling Log: alta, inclinata di 45°, player centrato.
		const target = this.followTarget;

		// Interpolazione morbida (LERP) dell'offset del mouse
		this.currentMouseOffset[0] +=
			(this.targetMouseOffset[0] - this.currentMouseOffset[0]) * this.mouseSmoothing;
		this.currentMouseOffset[1] +=
			(this.targetMouseOffset[1] - this.currentMouseOffset[1]) * this.mouseSmoothing;

		// Calcolo dello Yaw dinamico con l'offset di parallasse
		const yawOffset = this.parallaxEnabled ? this.currentMouseOffset[0] * this.maxYawOffset : 0;
		const headingYaw = this.yaw - yawOffset;

		const forwardX = Math.sin(headingYaw);
		const forwardZ = -Math.cos(headingYaw);

		// Pitch forzato a -45° (verso il basso).
		const pitchOffset = this.parallaxEnabled
			? this.currentMouseOffset[1] * this.maxPitchOffset
			: 0;
		this.pitch = -Math.PI * 0.25 - pitchOffset;

		const desiredPos = [
			target.position[0] - forwardX * this.rollingBackDistance,
			target.position[1] +
				this.rollingHeight -
				Math.sin(pitchOffset) * this.rollingBackDistance,
			target.position[2] - forwardZ * this.rollingBackDistance
		];

		if (this.smoothing > 0.01) {
			this.position[0] += (desiredPos[0] - this.position[0]) * this.smoothing;
			this.position[1] += (desiredPos[1] - this.position[1]) * this.smoothing;
			this.position[2] += (desiredPos[2] - this.position[2]) * this.smoothing;
		} else {
			this.position = [...desiredPos];
		}

		this.target = [
			target.position[0] + forwardX * this.rollingLookAhead,
			target.position[1],
			target.position[2] + forwardZ * this.rollingLookAhead
		];
	}

	getViewMatrix() {
		return mat4LookAt(this.position, this.target, this.up);
	}
}
