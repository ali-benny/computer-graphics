import { createCube, createCylinder } from './geometry.js';
import { loadOBJ, computeBounds } from './objLoader.js';
import { createMesh, loadTexture } from './shader.js';
import { createCanvas, Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { PlayerController } from './player.js';
import { createControlPanel } from './panel.js';
import { dayNightCycleUpdate } from './cycleDayNight.js';
import { mat4Identity, mat4Translate, mat4Scale, mat4Multiply, mat4RotateY } from './math.js';
import { GameObject, CloudObject, FlowerObject } from './gameObject.js';
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
	DEFAULT_DAY_NIGHT_CYCLE,
	FLOWERS,
	FOG,
	GROUND,
	MODEL_PATHS,
	RENDERING,
	STATIC_COLLIDERS,
	TEXTURE_PATHS,
	TREES
} from './const.js';

/**
 * Crea la geometria di un piano per la bacheca della foto
 */
function createPhotoBoardGeometry(width, height) {
	const hw = width * 0.5,
		hh = height * 0.5;
	return {
		positions: new Float32Array([-hw, -hh, 0, hw, -hh, 0, hw, hh, 0, -hw, hh, 0]),
		normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
		uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
		indices: new Uint32Array([0, 1, 2, 0, 2, 3])
	};
}
function composeSignPart(baseMatrix, localX, localY, localZ, scaleX, scaleY, scaleZ) {
	return mat4Multiply(
		baseMatrix,
		mat4Multiply(mat4Translate(localX, localY, localZ), mat4Scale(scaleX, scaleY, scaleZ))
	);
}

/**
 * Gestione delle collisioni
 *
 * Restituisce i bounds trasformati di un oggetto 3D proiettati sul piano XZ,
 * dato un bounding box locale e una matrice di trasformazione.
 */
function getTransformedBoundsXZ(bounds, matrix) {
	const min = [Infinity, Infinity];
	const max = [-Infinity, -Infinity];

	// Itera su tutti gli 8 vertici del bounding box locale
	for (const x of [bounds.min[0], bounds.max[0]]) {
		for (const y of [bounds.min[1], bounds.max[1]]) {
			for (const z of [bounds.min[2], bounds.max[2]]) {
				// Applica la matrice di trasformazione ad ogni vertice
				const worldX = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
				const worldZ = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
				// Confronto le coordinate
				min[0] = Math.min(min[0], worldX);
				min[1] = Math.min(min[1], worldZ);
				max[0] = Math.max(max[0], worldX);
				max[1] = Math.max(max[1], worldZ);
			}
		}
	}

	return { min: [min[0], 0, min[1]], max: [max[0], 3, max[1]] };
}

/**
 * Gestisce il caricamento di un modello:
 * carica il modello, ne calcola le dimensioni e bounds, alloca i buffer sulla GPU e carica la texture
 *
 * return un unico oggetto con mesh, bounds e texture
 */
async function loadModelWithResources(gl, modelPath, texturePath) {
	const geometry = await loadOBJ(modelPath);
	const bounds = computeBounds(geometry.positions);
	const mesh = createMesh(gl, geometry);
	let texture = null;
	if (texturePath) {
		try {
			texture = await loadTexture(gl, texturePath);
		} catch (e) {
			console.warn('Texture non caricata:', texturePath, e);
		}
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
		loadModelWithResources(gl, MODEL_PATHS.cloud),
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

	const objects = [];

	// --- TERRENO ---
	objects.push(
		new GameObject({
			mesh: groundMesh,
			texture: grassTexture,
			type: 'ground'
		})
	);

	// --- CASA ---
	const houseObjects = [];
	const addHousePart = (mesh, texture) => {
		if (!mesh) return;
		const houseGO = new GameObject({
			gl,
			mesh,
			texture,
			bounds: houseBounds,
		scaleMul: 2,
		placeOnGround: true,
			rotationY: -Math.PI / 2,
			position: [0, 0, 0],
			type: 'house'
		});
		houseObjects.push(houseGO);
		objects.push(houseGO);
	};
	addHousePart(houseMaterialMeshes.Walls_Roof, houseWallsTexture);
	addHousePart(houseMaterialMeshes.Door_windows, houseDoorTexture);

	const houseColliderMatrix = houseObjects[0] ? houseObjects[0].modelMatrix : mat4Identity();
	const houseCollider = { type: 'aabb', name: 'house', ...getTransformedBoundsXZ(houseBounds, houseColliderMatrix) };

	// --- PLAYER ---
	const playerGO = new GameObject({
		gl,
		mesh: char.mesh,
		texture: char.texture,
		bounds: char.bounds,
		scaleMul: 0.72,
		placeOnGround: true,
		type: 'player'
	});
	objects.push(playerGO);

	// --- NUVOLETTE ---
	const cloudObjects = [];

	for (let i = 0; i < CLOUDS.count; i++) {
		const scale = CLOUDS.minScale + Math.random() * CLOUDS.scaleRange;
		const position = [
			-CLOUDS.areaX + Math.random() * CLOUDS.areaX * 2,
			CLOUDS.minHeight + Math.random() * CLOUDS.heightRange,
			-CLOUDS.areaZ + Math.random() * CLOUDS.areaZ * 2
		];
		const velocityX = CLOUDS.minVelocityX + Math.random() * CLOUDS.velocityRangeX;

		const cloudGO = new CloudObject({
			mesh: cloud.mesh,
			bounds: cloud.bounds,
			scaleMul: scale,
			position,
			velocityX,
			rotationY: CLOUDS.rotationY,
			opacity: CLOUDS.opacity,
			areaX: CLOUDS.areaX,
			wrapMargin: CLOUDS.wrapMargin
		});

		cloudObjects.push(cloudGO);
		objects.push(cloudGO);
	}

	// --- BACHECA FOTO ---
	const signBaseMatrix = mat4Multiply(mat4Translate(4.1, 0.0, -2.0), mat4RotateY(-0.3));
	const photoBoardMatrix = composeSignPart(signBaseMatrix, 0, 2.1, 0.07, 1.0, 1.0, 1.0);
	const photoPostMatrix = composeSignPart(signBaseMatrix, 0, 1.05, -0.04, 0.16, 2.1, 0.16);

	const frameThickness = 0.12,
		frameDepth = 0.1,
		hw = 0.6,
		hh = 0.8;
	const frameParts = [
		{ x: 0, y: 2.1 + hh + frameThickness * 0.5, z: 0, sx: 1.2 + frameThickness * 2, sy: frameThickness, sz: frameDepth },
		{ x: 0, y: 2.1 - hh - frameThickness * 0.5, z: 0, sx: 1.2 + frameThickness * 2, sy: frameThickness, sz: frameDepth },
		{ x: -(hw + frameThickness * 0.5), y: 2.1, z: 0, sx: frameThickness, sy: 1.6, sz: frameDepth },
		{ x: hw + frameThickness * 0.5, y: 2.1, z: 0, sx: frameThickness, sy: 1.6, sz: frameDepth }
	].map((p) => composeSignPart(signBaseMatrix, p.x, p.y, p.z, p.sx, p.sy, p.sz));

	objects.push(
		new GameObject({ mesh: photoBoardMesh, texture: photoTexture, type: 'photo' }),
		new GameObject({ mesh: signPostMesh, color: [0.57, 0.37, 0.15], type: 'photo' }),
		...frameParts.map((m) => new GameObject({ mesh: signPostMesh, color: [0.71, 0.5, 0.22] }))
	);
	// Assegnazione matrici composte per la bacheca
	objects[objects.length - 2 - frameParts.length].modelMatrix = photoBoardMatrix;
	objects[objects.length - 1 - frameParts.length].modelMatrix = photoPostMatrix;
	frameParts.forEach((m, idx) => {
		objects[objects.length - frameParts.length + idx].modelMatrix = m;
	});

	// --- ALBERI  ---
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

		const tempTreeGO = new GameObject({
			bounds: tree.bounds,
			scaleMul,
			placeOnGround: true,
			ySinkMul: 0.04,
			position: [x, 0, z],
			rotationY: rot
		});

		treeOpacities[i] = 1.0;
		for (let k = 0; k < 16; k++) treeMatrices[i * 16 + k] = tempTreeGO.modelMatrix[k];

		treeColliders.push({
			type: 'cylinder',
			name: `tree_inst_${i}`,
			center: [x, 0, z],
			radius: 0.6 * scaleMul
		});
	}

	// --- FIORI ---
	const flowerColliders = [];
	const flowerObjects = [];

	for (let i = 0; i < FLOWERS.count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = FLOWERS.minRadius + Math.random() * FLOWERS.radiusRange;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		const scale = FLOWERS.minScale + Math.random() * FLOWERS.scaleRange;
		const rot = Math.random() * FLOWERS.rotationY;

		const isAnimated = i % 2 === 0;
		const direction = i % 4 === 0 ? 1 : -1;
		const rotationSpeed = isAnimated ? (0.5 + Math.random() * 1.0) * direction : 0;

		const flowerGO = new FlowerObject({
			gl,
			mesh: flower.mesh,
			texture: flower.texture,
			bounds: flower.bounds,
			scaleMul: scale,
			position: [x, 0, z],
			rotationY: rot,
			rotationSpeed
		});

		flowerObjects.push(flowerGO);
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
		dayNightCycle: DEFAULT_DAY_NIGHT_CYCLE,
		timeOfDay: DEFAULT_TIME_OF_DAY,
		lightColor: [...DEFAULT_LIGHT_COLOR],
		lightIntensity: DEFAULT_LIGHT_INTENSITY,
		skyColorHorizon: [...DEFAULT_SKY_COLOR_HORIZON],
		skyColorZenith: [...DEFAULT_SKY_COLOR_ZENITH],
		enableFog: DEFAULT_FOG_ENABLED,
		fogNear: FOG.near,
		fogFar: FOG.far
	};
	const player = new PlayerController([0, 0, 9.0], 5);
	const camera = new Camera(CAMERA.position, [0, 0, 0], canvas);
	camera.followTarget = player;
	camera.yaw = 0;
	camera.rollingBackDistance = CAMERA.rollingBackDistance;
	camera.rollingHeight = CAMERA.rollingHeight;
	camera.rollingLookAhead = CAMERA.rollingLookAhead;
	camera.smoothing = CAMERA.smoothing;
	camera.parallaxEnabled = CAMERA.parallaxEnabled;
	camera.maxYawOffset = CAMERA.maxYawOffset;
	camera.maxPitchOffset = CAMERA.maxPitchOffset;
	camera.mouseSmoothing = CAMERA.mouseSmoothing;

	const hud = createControlPanel(state, canvas, camera);
	const colliders = [...STATIC_COLLIDERS, houseCollider, ...treeColliders, ...flowerColliders];

	let lastTime = performance.now();
	let lightAngle = 0;
	let cameraForward = [0, 0, 0];
	let cameraRight = [0, 0, 0];
	let finalLightColor = [0, 0, 0];

	function animate(nowMs) {
		const deltaTime = Math.min(0.05, (nowMs - lastTime) * 0.001);
		lastTime = nowMs;

		// Aggiornamento Nuvole 
		for (const cloudGO of cloudObjects) {
			cloudGO.update(deltaTime);
		}

		// Aggiornamento Fiori
		for (const flowerGO of flowerObjects) {
			flowerGO.update(deltaTime);
		}

		// Movimento e Fisica
		cameraForward = [
			Math.sin(camera.yaw) * Math.cos(camera.pitch),
			Math.sin(camera.pitch),
			-Math.cos(camera.yaw) * Math.cos(camera.pitch)
		];
		cameraRight = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)];

		player.update(deltaTime, hud.inputActions, colliders, cameraForward, cameraRight);
		camera.updatePosition(deltaTime);

		// Sincronizzazione GameObject Player
		playerGO.setPosition(...player.position);
		playerGO.setRotationY(player.yaw);

		// Opacità Dinamica Casa
		const closestHouseX = Math.max(houseCollider.min[0], Math.min(camera.position[0], houseCollider.max[0]));
		const closestHouseZ = Math.max(houseCollider.min[2], Math.min(camera.position[2], houseCollider.max[2]));
		const houseDistance = Math.hypot(camera.position[0] - closestHouseX, camera.position[2] - closestHouseZ);
		const houseOpacity = houseDistance < TREES.fadeRadius ? 0.0 : 1.0;
		for (const houseObject of houseObjects) {
			houseObject.opacity += (houseOpacity - houseObject.opacity) * 0.1;
		}

		for (let i = 0; i < treeColliders.length; i++) {
			const tc = treeColliders[i].center;
			const dx = tc[0] - camera.position[0];
			const dz = tc[2] - camera.position[2];
			const distToCam = Math.sqrt(dx * dx + dz * dz);
			const targetOpacity = distToCam < TREES.fadeRadius ? 0.0 : 1.0;
			treeOpacities[i] += (targetOpacity - treeOpacities[i]) * 0.1;
		}

		// Luci
		let lightDir;
		if (state.rotateLight) {
			lightAngle += deltaTime * 0.65;
			lightDir = [Math.cos(lightAngle) * 0.7, 1.0, Math.sin(lightAngle) * 0.7];
		} else {
			lightDir = [0.0, -0.5, -1.0];
		}
		dayNightCycleUpdate(deltaTime, state, hud);
		// Calcolo del colore finale scalato per l'intensità
		finalLightColor = state.lightColor.map((c) => c * state.lightIntensity);

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
