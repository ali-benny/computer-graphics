import { createCube, createCylinder } from './geometry.js';
import { loadOBJ, computeBounds } from './objLoader.js';
import { createMesh, loadTexture } from './shaderUtils.js';
import { createCanvas, Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { PlayerController } from './player.js';
import { mat4Identity, mat4Translate, mat4Scale, mat4Multiply, mat4RotateY } from './math.js';
import GameObject from './gameObject.js';
import {
	CAMERA,
	CLOUDS,
	DEFAULT_FOG_ENABLED,
	DEFAULT_LIGHT_COLOR,
	DEFAULT_LIGHT_INTENSITY,
	DEFAULT_ROTATE_LIGHT,
	DEFAULT_SKY_COLOR_HORIZON,
	DEFAULT_SKY_COLOR_ZENITH,
	DEFAULT_TIME_OF_DAY,
	FLOWERS,
	FOG,
	GROUND,
	MODEL_PATHS,
	RENDERING,
	STATIC_COLLIDERS,
	TEXTURE_PATHS,
	TIME_PRESETS,
	TREES
} from './const.js';

// ====== UTILITY FUNCTIONS ======

function createPhotoBoardGeometry(width, height) {
	const hw = width * 0.5,
		hh = height * 0.5;
	return {
		positions: new Float32Array([-hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
		uvs: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
		indices: new Uint32Array([0, 1, 2, 0, 2, 3])
	};
}

function composeSignPart(baseMatrix, localX, localY, localZ, scaleX, scaleY, scaleZ) {
	return mat4Multiply(
		baseMatrix,
		mat4Multiply(mat4Translate(localX, localY, localZ), mat4Scale(scaleX, scaleY, scaleZ))
	);
}

function buildModelMatrix(bounds, options = {}) {
	const scale = bounds.uniformScale * (options.scaleMul ?? 1);
	const translate = options.translate ?? [0, 0, 0];
	const rotateY = options.rotateY ?? 0;
	const minRelY = bounds.min[1] - bounds.center[1];
	const placeOnGroundY = options.placeOnGround ? -minRelY * scale : 0;
	const extra = options.ySinkMul ? options.ySinkMul * scale : 0;
	const finalTranslate = [translate[0], translate[1] + placeOnGroundY - extra, translate[2]];

	return mat4Multiply(
		mat4Translate(finalTranslate[0], finalTranslate[1], finalTranslate[2]),
		mat4Multiply(
			mat4RotateY(rotateY),
			mat4Multiply(
				mat4Scale(scale, scale, scale),
				mat4Translate(-bounds.center[0], -bounds.center[1], -bounds.center[2])
			)
		)
	);
}

function getTransformedBoundsXZ(bounds, matrix) {
	const min = [Infinity, Infinity];
	const max = [-Infinity, -Infinity];

	for (const x of [bounds.min[0], bounds.max[0]]) {
		for (const y of [bounds.min[1], bounds.max[1]]) {
			for (const z of [bounds.min[2], bounds.max[2]]) {
				const worldX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
				const worldZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
				min[0] = Math.min(min[0], worldX);
				min[1] = Math.min(min[1], worldZ);
				max[0] = Math.max(max[0], worldX);
				max[1] = Math.max(max[1], worldZ);
			}
		}
	}

	return { min: [min[0], 0, min[1]], max: [max[0], 3, max[1]] };
}
function mobileControlsEnabled(inputActions) {
	const touchPad = document.createElement('div');
	touchPad.id = 'mobileTouchPad';
	touchPad.style.cssText = `
	  position: fixed;
	  bottom: 20px;
	  left: 20px;
	  width: 120px;
	  height: 120px;
	  background: rgba(0, 0, 0, 0.3);
	  border: 2px solid rgba(255, 255, 255, 0.5);
	  border-radius: 50%;
	  touch-action: none;
	  display: none; /* Visibile solo su mobile */
	  z-index: 100;
	`;
	document.body.appendChild(touchPad);

	let touchActive = false;
	let touchStartX = 0,
		touchStartY = 0;

	touchPad.addEventListener('touchstart', (e) => {
		touchActive = true;
		const touch = e.touches[0];
		const rect = touchPad.getBoundingClientRect();
		touchStartX = touch.clientX - rect.left;
		touchStartY = touch.clientY - rect.top;
	});

	touchPad.addEventListener('touchmove', (e) => {
		if (!touchActive) return;
		const touch = e.touches[0];
		const rect = touchPad.getBoundingClientRect();
		const x = touch.clientX - rect.left - 60;
		const y = touch.clientY - rect.top - 60;
		const dist = Math.hypot(x, y);
		const maxDist = 50;

		if (dist > maxDist) {
			const scale = maxDist / dist;
			inputActions.moveForward = y * scale < -20;
			inputActions.moveBackward = y * scale > 20;
			inputActions.moveLeft = x * scale < -20;
			inputActions.moveRight = x * scale > 20;
		}
	});

	touchPad.addEventListener('touchend', () => {
		touchActive = false;
		inputActions.moveForward = false;
		inputActions.moveBackward = false;
		inputActions.moveLeft = false;
		inputActions.moveRight = false;
	});

	// Mostra il touchpad solo su mobile
	const isMobile = window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches;
	if (isMobile) {
		touchPad.style.display = 'block';
	}

	window.addEventListener('resize', () => {
		const isMobile = window.innerWidth <= 768;
		touchPad.style.display = isMobile ? 'block' : 'none';
	});
}

function createControlPanel(state, camera, canvas) {
	// Inizializza dat.GUI
	const gui = new dat.GUI({ width: 300 });

	// --- CARTELLA ILLUMINAZIONE ---
	const lightFolder = gui.addFolder('Illuminazione');

	lightFolder.add(state, 'rotateLight').name('Luce Orbitante');

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

	const keyMap = { w: 'moveForward', s: 'moveBackward', a: 'moveLeft', d: 'moveRight' };

	const handleKey = (e, isDown) => {
		// Se l'utente sta scrivendo in un campo di testo (es. un input di dat.gui), ignora i tasti WASD
		if (
			e.target.tagName === 'INPUT' &&
			(e.target.type === 'text' || e.target.type === 'number')
		) {
			return;
		}

		const key = e.key.toLowerCase();
		const action = keyMap[key];
		if (action) {
			inputActions[action] = isDown;
			// Previene lo scorrimento della pagina con frecce/tasti se necessario
			if (['w', 'a', 's', 'd'].includes(key)) {
				e.preventDefault();
			}
		}
	};

	window.addEventListener('keydown', (e) => handleKey(e, true));
	window.addEventListener('keyup', (e) => handleKey(e, false));

	// Toglie il focus dagli elementi di dat.gui quando si clicca sulla scena
	canvas.addEventListener('pointerdown', () => {
		if (document.activeElement && document.activeElement.blur) {
			document.activeElement.blur();
		}
	});

	mobileControlsEnabled(inputActions);

	return {
		inputActions,
		updateInfo(player, camera) {}
	};
}

async function loadModelWithResources(gl, modelPath, texturePath) {
	const geometry = await loadOBJ(modelPath);
	const bounds = computeBounds(geometry.positions);
	const mesh = createMesh(gl, geometry);
	let texture = null;
	try {
		texture = await loadTexture(gl, texturePath);
	} catch (e) {
		console.warn('Texture non caricata:', texturePath, e);
	}
	return { mesh, bounds, texture };
}

async function main() {
	const canvas = createCanvas();
	const renderer = new Renderer(canvas);
	const gl = renderer.gl;

	const [houseGeometry, char, tree, cloud, flower] = await Promise.all([
		loadOBJ(MODEL_PATHS.house),
		loadModelWithResources(gl, MODEL_PATHS.char, TEXTURE_PATHS.char),
		loadModelWithResources(gl, MODEL_PATHS.tree, TEXTURE_PATHS.tree),
		loadOBJ(MODEL_PATHS.cloud),
		loadModelWithResources(gl, MODEL_PATHS.flower1, TEXTURE_PATHS.flower1)
	]);

	const houseBounds = computeBounds(houseGeometry.positions);
	const houseMaterialMeshes = {};
	const materialGroups = houseGeometry.materialGroups || {};
	for (const [materialName, materialIndices] of Object.entries(materialGroups)) {
		houseMaterialMeshes[materialName] = createMesh(gl, {
			positions: houseGeometry.positions,
			normals: houseGeometry.normals,
			uvs: houseGeometry.uvs,
			indices: materialIndices
		});
	}
	if (Object.keys(houseMaterialMeshes).length === 0) {
		houseMaterialMeshes.default = createMesh(gl, houseGeometry);
	}

	const [houseWallsTexture, houseDoorTexture, photoTexture, grassTexture] = await Promise.all([
		loadTexture(gl, TEXTURE_PATHS.houseWallsRoof).catch(() => null),
		loadTexture(gl, TEXTURE_PATHS.houseDoorWindows).catch(() => null),
		loadTexture(gl, TEXTURE_PATHS.photo).catch(() => char.texture),
		loadTexture(gl, TEXTURE_PATHS.grass).catch(() => null)
	]);

	const groundMesh = createMesh(
		gl,
		createCylinder(GROUND.width, GROUND.depth, GROUND.subdivisionsX, GROUND.subdivisionsZ)
	);
	const photoBoardMesh = createMesh(gl, createPhotoBoardGeometry(1.2, 1.6));
	const signPostMesh = createMesh(gl, createCube(1));
	const skyboxMesh = createMesh(gl, createCube(RENDERING.skyboxSize));

	const houseMatrix = buildModelMatrix(houseBounds, {
		scaleMul: 2,
		placeOnGround: true,
		rotateY: -Math.PI / 2,
		translate: [0, 0, 0]
	});
	const houseBoundsXZ = getTransformedBoundsXZ(houseBounds, houseMatrix);
	const houseCollider = { type: 'aabb', name: 'house', ...houseBoundsXZ };

	// Nuvolette
	const cloudBounds = computeBounds(cloud.positions);
	const cloudMesh = createMesh(gl, cloud);
	const cloudObjects = [];

	for (let i = 0; i < CLOUDS.count; i++) {
		const cloudScale = CLOUDS.minScale + Math.random() * CLOUDS.scaleRange;

		const cloudPosition = [
			-CLOUDS.areaX + Math.random() * CLOUDS.areaX * 2,
			CLOUDS.minHeight + Math.random() * CLOUDS.heightRange,
			-CLOUDS.areaZ + Math.random() * CLOUDS.areaZ * 2
		];
		const cloudVelocityX = CLOUDS.minVelocityX + Math.random() * CLOUDS.velocityRangeX;

		cloudObjects.push({
			mesh: cloudMesh,
			position: cloudPosition,
			scale: cloudScale,
			velocityX: cloudVelocityX,
			rotationY: CLOUDS.rotationY,
			modelMatrix: buildModelMatrix(cloudBounds, {
				scaleMul: cloudScale,
				translate: cloudPosition,
				rotateY: CLOUDS.rotationY
			}),
			color: [1.0, 1.0, 1.0],
			opacity: CLOUDS.opacity,
			type: 'cloud'
		});
	}

	// Costruzione Bacheca Foto con loop per evitare ridondanze
	const signBaseMatrix = mat4Multiply(mat4Translate(4.1, 0.0, -2.0), mat4RotateY(-0.3));
	const photoBoardMatrix = composeSignPart(signBaseMatrix, 0, 2.1, 0.07, 1.0, 1.0, 1.0);
	const photoPostMatrix = composeSignPart(signBaseMatrix, 0, 1.05, -0.04, 0.16, 2.1, 0.16);

	const frameThickness = 0.12,
		frameDepth = 0.1,
		hw = 0.6,
		hh = 0.8;
	const frameParts = [
		{
			x: 0,
			y: 2.1 + hh + frameThickness * 0.5,
			z: 0,
			sx: 1.2 + frameThickness * 2,
			sy: frameThickness,
			sz: frameDepth
		},
		{
			x: 0,
			y: 2.1 - hh - frameThickness * 0.5,
			z: 0,
			sx: 1.2 + frameThickness * 2,
			sy: frameThickness,
			sz: frameDepth
		},
		{
			x: -(hw + frameThickness * 0.5),
			y: 2.1,
			z: 0,
			sx: frameThickness,
			sy: 1.6,
			sz: frameDepth
		},
		{
			x: hw + frameThickness * 0.5,
			y: 2.1,
			z: 0,
			sx: frameThickness,
			sy: 1.6,
			sz: frameDepth
		}
	].map((p) => composeSignPart(signBaseMatrix, p.x, p.y, p.z, p.sx, p.sy, p.sz));

	const objects = [
		{
			mesh: groundMesh,
			modelMatrix: mat4Identity(),
			color: [1, 1, 1],
			texture: grassTexture,
			invertUVY: true,
			type: 'ground'
		},
		...cloudObjects,
		{
			mesh: photoBoardMesh,
			modelMatrix: photoBoardMatrix,
			color: [1, 1, 1],
			texture: photoTexture,
			invertUVY: false,
			type: 'photo'
		},
		{
			mesh: signPostMesh,
			modelMatrix: photoPostMatrix,
			color: [0.57, 0.37, 0.15],
			type: 'photo'
		},
		...frameParts.map((m) => ({ mesh: signPostMesh, modelMatrix: m, color: [0.71, 0.5, 0.22] }))
	];
	const houseObjects = [];

	const addHousePart = (mesh, texture) => {
		if (!mesh) return;
		const go = new GameObject({
			gl,
			mesh,
			texture,
			color: [1.0, 1.0, 1.0],
			invertUVY: true,
			type: 'house'
		});
		go.modelMatrix = houseMatrix;
		go.opacity = 1.0;
		houseObjects.push(go);
		objects.splice(1, 0, go);
	};
	addHousePart(houseMaterialMeshes.Walls_Roof, houseWallsTexture);
	addHousePart(houseMaterialMeshes.Door_windows, houseDoorTexture);

	// Generazione Alberi
	const treeMatrices = new Float32Array(TREES.count * 16);
	const treeOpacities = new Float32Array(TREES.count);
	const treeColliders = [];

	for (let i = 0; i < TREES.count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = TREES.minRadius + Math.random() * TREES.radiusRange;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		const scaleMul = TREES.minScale + Math.random() * TREES.scaleRange;
		const rot = Math.random() * Math.PI * 2;

		const m = buildModelMatrix(tree.bounds, {
			scaleMul,
			placeOnGround: true,
			ySinkMul: 0.04,
			translate: [x, 0, z],
			rotateY: rot
		});

		treeOpacities[i] = 1.0;
		for (let k = 0; k < 16; k++) treeMatrices[i * 16 + k] = m[k];

		treeColliders.push({
			type: 'cylinder',
			name: `tree_inst_${i}`,
			center: [m[12], m[13], m[14]],
			radius: 0.6 * scaleMul
		});
	}

	// Generazione Fiori
	const flowerColliders = [];

	for (let i = 0; i < FLOWERS.count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = FLOWERS.minRadius + Math.random() * FLOWERS.radiusRange;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		const scale = FLOWERS.minScale + Math.random() * FLOWERS.scaleRange;
		const rot = Math.random() * FLOWERS.rotationY;

		const flowerGO = new GameObject({
			gl,
			mesh: flower.mesh,
			texture: flower.texture,
			color: [1.0, 1.0, 1.0],
			invertUVY: true,
			type: 'flower'
		});

		flowerGO.setModelMatrix(
			buildModelMatrix(flower.bounds, {
				scaleMul: scale,
				placeOnGround: true,
				translate: [x, 0, z],
				rotateY: rot
			})
		);

		objects.push(flowerGO);

		flowerColliders.push({
			type: 'cylinder',
			name: `flower_inst_${i}`,
			center: [x, 0, z],
			radius: 0.2 * scale
		});
	}

	const state = {
		rotateLight: DEFAULT_ROTATE_LIGHT,
		lightColor: [...DEFAULT_LIGHT_COLOR],
		lightIntensity: DEFAULT_LIGHT_INTENSITY,
		skyColorHorizon: [...DEFAULT_SKY_COLOR_HORIZON],
		skyColorZenith: [...DEFAULT_SKY_COLOR_ZENITH],
		enableFog: DEFAULT_FOG_ENABLED,
		fogNear: FOG.near,
		fogFar: FOG.far
	};
	const player = new PlayerController([0, 0, 9.0], 12);
	const camera = new Camera(CAMERA.position, [0, 0, 0], canvas);
	camera.mode = 'rolling-follow';
	camera.followTarget = player;
	camera.yaw = 0;
	camera.rollingBackDistance = CAMERA.rollingBackDistance;
	camera.rollingHeight = CAMERA.rollingHeight;
	camera.rollingLookAhead = CAMERA.rollingLookAhead;
	camera.smoothing = CAMERA.smoothing;

	const hud = createControlPanel(state, camera, canvas);

	const playerGO = new GameObject({
		gl,
		mesh: char.mesh,
		texture: char.texture,
		color: [1.0, 1.0, 1.0],
		invertUVY: true
	});
	objects.splice(1, 0, playerGO);

	let lastTime = performance.now(),
		lightAngle = 0;

	function animate(nowMs) {
		const deltaTime = Math.min(0.05, (nowMs - lastTime) * 0.001);
		lastTime = nowMs;

		// Movimento Nuvolette
		for (const cloudObject of cloudObjects) {
			cloudObject.position[0] += cloudObject.velocityX * deltaTime;

			// Effetto Pac-Man
			if (cloudObject.position[0] > CLOUDS.areaX + CLOUDS.wrapMargin) {
				cloudObject.position[0] = -CLOUDS.areaX - CLOUDS.wrapMargin;
			} else if (cloudObject.position[0] < -CLOUDS.areaX - CLOUDS.wrapMargin) {
				cloudObject.position[0] = CLOUDS.areaX + CLOUDS.wrapMargin;
			}

			cloudObject.modelMatrix = buildModelMatrix(cloudBounds, {
				scaleMul: cloudObject.scale,
				translate: cloudObject.position,
				rotateY: cloudObject.rotationY
			});
		}

		// Movimento e Fisica
		const cameraForward = [
			Math.sin(camera.yaw) * Math.cos(camera.pitch),
			Math.sin(camera.pitch),
			-Math.cos(camera.yaw) * Math.cos(camera.pitch)
		];
		const cameraRight = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)];

		const colliders = STATIC_COLLIDERS.concat(houseCollider, treeColliders, flowerColliders);
		player.update(deltaTime, hud.inputActions, colliders, cameraForward, cameraRight);
		camera.updatePosition(deltaTime);

		// Calcolo opacità dinamica degli oggetti vicini alla camera
		const closestHouseX = Math.max(
			houseCollider.min[0],
			Math.min(camera.position[0], houseCollider.max[0])
		);
		const closestHouseZ = Math.max(
			houseCollider.min[2],
			Math.min(camera.position[2], houseCollider.max[2])
		);
		const houseDistance = Math.hypot(
			camera.position[0] - closestHouseX,
			camera.position[2] - closestHouseZ
		);
		const houseOpacity = houseDistance < TREES.fadeRadius ? 0.0 : 1.0;
		for (const houseObject of houseObjects) {
			houseObject.opacity += (houseOpacity - houseObject.opacity) * 0.1;
		}

		for (let i = 0; i < treeColliders.length; i++) {
			const tc = treeColliders[i].center;
			const dx = tc[0] - camera.position[0];
			const dz = tc[2] - camera.position[2];
			const distToCam = Math.sqrt(dx * dx + dz * dz);

			let targetOpacity = 1.0;
			if (distToCam < TREES.fadeRadius) {
				targetOpacity = 0.0;
			}
			// LERP per transizione morbida
			treeOpacities[i] += (targetOpacity - treeOpacities[i]) * 0.1;
		}

		// Aggiorna matrici Player
		playerGO.setModelMatrix(
			buildModelMatrix(char.bounds, {
				scaleMul: 0.72,
				placeOnGround: true,
				translate: player.position,
				rotateY: player.yaw
			})
		);

		// Luci
		let lightDir;
		if (state.rotateLight) {
			lightAngle += deltaTime * 0.65;
			lightDir = [Math.cos(lightAngle) * 0.7, 1.0, Math.sin(lightAngle) * 0.7];
		} else {
			// La tua luce frontale preferita
			lightDir = [0.0, -0.5, -1.0];
		}
		// Calcolo del colore finale scalato per l'intensità
		const finalLightColor = state.lightColor.map((c) => c * state.lightIntensity);

		// Rendering
		renderer.render(camera, objects, skyboxMesh, {
			lightDir: lightDir,
			lightColor: finalLightColor,
			enableFog: state.enableFog,
			fogColor: state.skyColorHorizon, // [0.7, 0.85, 0.95]
			fogNear: state.fogNear,
			fogFar: state.fogFar,
			skyColorHorizon: state.skyColorHorizon, // colore nebbia
			skyColorZenith: state.skyColorZenith,
			curvatureStrength: RENDERING.curvatureStrength,
			curvatureOrigin: [player.position[0], player.position[2]],
			treeData: {
				mesh: tree.mesh,
				texture: tree.texture,
				matrices: treeMatrices,
				opacities: treeOpacities,
				count: TREES.count
			}
		});

		hud.updateInfo(player, camera);

		requestAnimationFrame(animate);
	}

	requestAnimationFrame(animate);
}

main().catch((error) => {
	console.error('Errore:', error);
	const pre = document.createElement('pre');
	pre.textContent = 'Errore: ' + error.message + '\n' + error.stack;
	pre.style.color = '#ff6b6b';
	pre.style.padding = '20px';
	pre.style.fontFamily = 'monospace';
	document.body.appendChild(pre);
});
