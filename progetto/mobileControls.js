import { createDpad } from './mobile-player.js';
import { createCameraPad } from './mobile-camera.js';

export function mobileControlsEnabled(inputActions, camera) {
	const dpadElement = createDpad(inputActions);
	const cameraPadElement = createCameraPad(camera);

	const checkMobile = () => {
		const isMobile = window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches;
		const displayValue = isMobile ? 'block' : 'none';

		dpadElement.style.display = displayValue;
		cameraPadElement.style.display = displayValue;

		if (isMobile && camera) {
			camera.parallaxEnabled = true;
		}
	};

	checkMobile();
	window.addEventListener('resize', checkMobile);
}