/**
 * Crea e gestisce il D-Pad a croce per il movimento del personaggio.
 */
export function createDpad(inputActions) {
	const dpad = document.createElement('div');
	dpad.id = 'mobileDpad';
	dpad.style.cssText = `
		position: fixed;
		bottom: 25px;
		left: 25px;
		width: 130px;
		height: 130px;
		display: none;
		z-index: 1000;
		touch-action: none;
		user-select: none;
	`;

	dpad.innerHTML = `
		<svg width="100%" height="100%" viewBox="0 0 100 100" style="filter: drop-shadow(0px 4px 6px rgba(0,0,0,0.3));">
			<path id="dpadCross" d="
				M 35,0 L 65,0 L 65,35 L 100,35 L 100,65 L 65,65 L 65,100 L 35,100 L 35,65 L 0,65 L 0,35 L 35,35 Z
			" fill="rgba(0, 0, 0, 0.4)" stroke="rgba(255, 255, 255, 0.6)" stroke-width="2" stroke-linejoin="round"/>
			<polygon points="50,8 42,22 58,22" fill="rgba(255,255,255,0.7)"/>
			<polygon points="50,92 42,78 58,78" fill="rgba(255,255,255,0.7)"/>
			<polygon points="8,50 22,42 22,58" fill="rgba(255,255,255,0.7)"/>
			<polygon points="92,50 78,42 78,58" fill="rgba(255,255,255,0.7)"/>
		</svg>
	`;
	document.body.appendChild(dpad);

	let touchId = null;

	const handleTouch = (e) => {
		if (touchId === null) return;
		const touch = Array.from(e.touches).find((t) => t.identifier === touchId);
		if (!touch) return;
		e.preventDefault();

		const rect = dpad.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		const dx = touch.clientX - centerX;
		const dy = touch.clientY - centerY;
		const deadzone = 12;

		if (Math.hypot(dx, dy) > deadzone) {
			const angle = Math.atan2(dy, dx);
			inputActions.moveRight = angle > -Math.PI * 0.375 && angle < Math.PI * 0.375;
			inputActions.moveBackward = angle > Math.PI * 0.125 && angle < Math.PI * 0.875;
			inputActions.moveLeft = angle > Math.PI * 0.625 || angle < -Math.PI * 0.625;
			inputActions.moveForward = angle > -Math.PI * 0.875 && angle < -Math.PI * 0.125;
		} else {
			resetActions();
		}
	};

	const resetActions = () => {
		inputActions.moveForward = false;
		inputActions.moveBackward = false;
		inputActions.moveLeft = false;
		inputActions.moveRight = false;
	};

	const resetTouch = (e) => {
		if (touchId === null) return;
		const touch = Array.from(e.changedTouches).find((t) => t.identifier === touchId);
		if (touch) {
			touchId = null;
			resetActions();
		}
	};

	dpad.addEventListener('touchstart', (e) => {
		e.preventDefault();
		if (touchId !== null) return;
		touchId = e.changedTouches[0].identifier;
		handleTouch(e);
	}, { passive: false });

	window.addEventListener('touchmove', handleTouch, { passive: false });
	window.addEventListener('touchend', resetTouch, { passive: false });
	window.addEventListener('touchcancel', resetTouch, { passive: false });

	return dpad;
}