import { createDpad } from './mobile-player.js';
import { createCameraPad } from './mobile-camera.js';
import { TIME_PRESETS, DEFAULT_TIME_OF_DAY, FOG } from './const.js';

/**
 * Crea il pannello di controllo con dat.GUI e gestisce gli input da tastiera e touch
 */
export function createControlPanel(state, canvas, camera) {
	// Inizializza dat.GUI
	const gui = new dat.GUI({ width: 300 });

	// --- CARTELLA ILLUMINAZIONE ---
	const lightFolder = gui.addFolder('Illuminazione');

	lightFolder.add(state, 'rotateLight').name('Luce Orbitante');
	lightFolder.add(state, 'dayNightCycle').name('Ciclo Giorno/Notte Automatico');

	state.timeOfDay = DEFAULT_TIME_OF_DAY;
	lightFolder
		.add(state, 'timeOfDay', Object.keys(TIME_PRESETS))
		.name('Fase Giornata')
		.onChange((presetName) => {
			const p = TIME_PRESETS[presetName];
			// aggiorna valori luce
			state.lightColor[0] = p.color[0];
			state.lightColor[1] = p.color[1];
			state.lightColor[2] = p.color[2];
			state.lightIntensity = p.intensity;

			// aggiorna colori skybox
			state.skyColorHorizon[0] = p.skyColorHorizon[0];
			state.skyColorHorizon[1] = p.skyColorHorizon[1];
			state.skyColorHorizon[2] = p.skyColorHorizon[2];

			state.skyColorZenith[0] = p.skyColorZenith[0];
			state.skyColorZenith[1] = p.skyColorZenith[1];
			state.skyColorZenith[2] = p.skyColorZenith[2];
			gui.updateDisplay();
		});

	lightFolder.add(state, 'lightIntensity', 0.0, 2.0, 0.05).name('Intensità');
	lightFolder.addColor(state, 'lightColor').name('Colore Luce');
	lightFolder.open();

	// --- CARTELLA EFFETTI ---
	const fogFolder = gui.addFolder('Effetti Avanzati');
	fogFolder.add(state, 'enableFog').name('Abilita Nebbia');
	fogFolder.add(state, 'fogNear', FOG.nearMin, FOG.nearMax, 1).name('Nebbia Vicina');

	const fogFarController = fogFolder
		.add(state, 'fogFar', FOG.farMin, FOG.farMax, 1)
		.name('Nebbia Lontana');
	fogFolder.add(state, 'fogNear').onChange((val) => {
		if (state.fogFar <= val) {
			state.fogFar = val + 1;
			fogFarController.updateDisplay();
		}
	});

	// --- GESTIONE INPUT TASTIERA (WASD) ---
	const inputActions = {
		moveForward: false,
		moveBackward: false,
		moveLeft: false,
		moveRight: false
	};

	const keyMap = {
		w: { action: 'moveForward', element: document.getElementById('key-w') },
		s: { action: 'moveBackward', element: document.getElementById('key-s') },
		a: { action: 'moveLeft', element: document.getElementById('key-a') },
		d: { action: 'moveRight', element: document.getElementById('key-d') }
	};
	const handleKey = (e, isDown) => {
		// Se l'utente sta scrivendo in un campo di testo (es. un input di dat.gui), ignora i tasti WASD
		if (
			e.target.tagName === 'INPUT' &&
			(e.target.type === 'text' || e.target.type === 'number')
		) {
			return;
		}

		const key = e.key.toLowerCase();
		const mapping = keyMap[key];
		if (mapping) {
			inputActions[mapping.action] = isDown;
			
			// Aggiunge o rimuove la classe per illuminare il tasto a schermo
			if (mapping.element) {
				mapping.element.classList.toggle('active', isDown);
			}

			if (['w', 'a', 's', 'd'].includes(key)) {
				e.preventDefault();
			}
		}
	};

	window.addEventListener('keydown', (e) => handleKey(e, true));
	window.addEventListener('keyup', (e) => handleKey(e, false));

	// Gestione del Click/Touch sui Pulsanti a Schermo
	Object.values(keyMap).forEach(({ action, element }) => {
		if (!element) return;

		const pressAction = (e) => {
			e.preventDefault();
			inputActions[action] = true;
			element.classList.add('active');
		};

		const releaseAction = (e) => {
			e.preventDefault();
			inputActions[action] = false;
			element.classList.remove('active');
		};

		element.addEventListener('pointerdown', pressAction);
		element.addEventListener('pointerup', releaseAction);
		element.addEventListener('pointerleave', releaseAction);
		element.addEventListener('pointercancel', releaseAction);
	});

	// Toglie il focus dagli elementi di dat.gui quando si clicca sulla scena
	canvas.addEventListener('pointerdown', () => {
		if (document.activeElement && document.activeElement.blur) {
			document.activeElement.blur();
		}
	});

	mobileControlsEnabled(inputActions, camera);

	return { inputActions, gui };
}

/**
 * Abilita i controlli touch per dispositivi mobili
 */
function mobileControlsEnabled(inputActions, camera) {
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