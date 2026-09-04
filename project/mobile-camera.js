/**
 * Crea e gestisce il touchpad analogico circolare per la fotocamera.
 */
export function createCameraPad(camera) {
	const pad = document.createElement('div');
	pad.id = 'mobileCameraPad';
	pad.style.cssText = `
		position: fixed;
		bottom: 25px;
		right: 25px;
		width: 120px;
		height: 120px;
		background: rgba(0, 0, 0, 0.3);
		border: 2px solid rgba(255, 255, 255, 0.5);
		border-radius: 50%;
		touch-action: none;
		display: none;
		z-index: 1000;
		user-select: none;
	`;

	const stick = document.createElement('div');
	stick.style.cssText = `
		position: absolute;
		top: 35px;
		left: 35px;
		width: 50px;
		height: 50px;
		background: rgba(255, 255, 255, 0.4);
		border-radius: 50%;
		pointer-events: none;
		transition: transform 0.05s ease-out;
	`;
	pad.appendChild(stick);
	document.body.appendChild(pad);

	let touchId = null;
	const maxRadius = 45;

	pad.addEventListener('touchstart', (e) => {
		e.preventDefault();
		if (touchId !== null) return;
		touchId = e.changedTouches[0].identifier;
	}, { passive: false });

	const handleTouch = (e) => {
		if (touchId === null) return;
		const touch = Array.from(e.touches).find((t) => t.identifier === touchId);
		if (!touch) return;
		e.preventDefault();

		const rect = pad.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		let dx = touch.clientX - centerX;
		let dy = touch.clientY - centerY;

		const dist = Math.hypot(dx, dy);
		if (dist > maxRadius) {
			dx = (dx / dist) * maxRadius;
			dy = (dy / dist) * maxRadius;
		}

		stick.style.transform = `translate(${dx}px, ${dy}px)`;

		if (camera && camera.targetMouseOffset) {
			camera.targetMouseOffset[0] = dx / maxRadius;
			camera.targetMouseOffset[1] = dy / maxRadius;
		}
	};

	const resetTouch = (e) => {
		if (touchId === null) return;
		const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchId);
		if (touch) {
			touchId = null;
			stick.style.transform = 'translate(0px, 0px)';
			if (camera && camera.targetMouseOffset) {
				camera.targetMouseOffset = [0, 0];
			}
		}
	};

	window.addEventListener('touchmove', handleTouch, { passive: false });
	window.addEventListener('touchend', resetTouch, { passive: false });
	window.addEventListener('touchcancel', resetTouch, { passive: false });

	return pad;
}