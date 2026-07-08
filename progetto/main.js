// main.js: Orchestrazione scena con Player controller, Camera follow, Collisioni
// Refactor: Mini-world terza persona con movimento controllato e collisioni forti

import { createPlane, createCube, createDisc, createCylinder } from './geometry.js';
import { loadOBJ, computeBounds } from './objLoader.js';
import {
	createMesh,
	loadTexture,
	setMeshAttributes,
	drawMesh,
	drawMeshInstanced
} from './shaderUtils.js';
import { createCanvas, Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { PlayerController } from './player.js';
import {
	mat4Identity,
	mat4Translate,
	mat4Scale,
	mat4Multiply,
	mat4RotateY,
	mat4Perspective
} from './math.js';
import GameObject from './gameObject.js';
import { createHUDCanvas } from './hudCanvas.js';

const MODEL_PATHS = {
	char: 'obj/animal-crossing-character/source/char.obj',
	house: 'obj/animal-crossing-house/source/house.obj',
	tree: 'obj/animal-crossing-pine-tree/source/base.obj'
};

const TEXTURE_PATHS = {
	houseWallsRoof: './obj/animal-crossing-house/textures/Base_Color_1.jpg',
	houseDoorWindows: './obj/animal-crossing-house/textures/Base_Color.jpg',
	char: './obj/animal-crossing-character/textures/character_ac_low_DefaultMaterial_BaseColor.png',
	photo: './textures/mia-foto.jpg',
	tree: './obj/animal-crossing-pine-tree/texture/texture_diffuse.png'
};

// ====== WORLD PROPS & COLLIDERS ======

const WORLD_PROPS = [
	{ id: 'tree1', type: 'tree', position: [-4.2, 0, -2.5], rotation: 0.4, scale: 1.5 },
	{ id: 'tree2', type: 'tree', position: [3.5, 0, -3.8], rotation: 0.7, scale: 1.5 },
	{ id: 'board', type: 'board', position: [4.1, 0, -2.0], rotation: -0.3, scale: 1.0 }
];

const STATIC_COLLIDERS = [
	{ type: 'aabb', name: 'house', min: [-3.5, 0, -3.0], max: [3.5, 3.0, 2.5] },
	{ type: 'cylinder', name: 'tree1', center: [-4.2, 0, -2.5], radius: 0.6 },
	{ type: 'cylinder', name: 'tree2', center: [3.5, 0, -3.8], radius: 0.6 },
	{ type: 'boundsCircle', name: 'worldBoundCircle', center: [0, 0, 0], radius: 100 }
];

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
	const finalTranslate = [translate[0], translate[1] + placeOnGroundY + 0.02, translate[2]];
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

function addHoldButtonEvents(button, key, inputActions) {
	const down = (event) => {
		event.preventDefault();
		const k = key.toLowerCase();
		if (k === 'w') inputActions.moveForward = true;
		if (k === 's') inputActions.moveBackward = true;
		if (k === 'a') inputActions.moveLeft = true;
		if (k === 'd') inputActions.moveRight = true;
	};
	const up = (event) => {
		event.preventDefault();
		const k = key.toLowerCase();
		if (k === 'w') inputActions.moveForward = false;
		if (k === 's') inputActions.moveBackward = false;
		if (k === 'a') inputActions.moveLeft = false;
		if (k === 'd') inputActions.moveRight = false;
	};
	button.addEventListener('mousedown', down);
	button.addEventListener('mouseup', up);
	button.addEventListener('mouseleave', up);
	button.addEventListener('touchstart', down, { passive: false });
	button.addEventListener('touchend', up, { passive: false });
	button.addEventListener('touchcancel', up, { passive: false });
}

function createControlPanel(state, camera, canvas) {
	const style = document.createElement('style');
	style.textContent = `
    .hud-root { position: fixed; inset: 0; pointer-events: none; z-index: 20; color: #f7f7f7; font-family: "Trebuchet MS", sans-serif; }
    .hud-panel { pointer-events: auto; position: absolute; top: 12px; left: 12px; width: min(330px, calc(100vw - 24px));
      background: linear-gradient(135deg, rgba(20, 28, 36, 0.92), rgba(20, 36, 24, 0.86)); border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px; padding: 12px; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35); backdrop-filter: blur(4px); }
    .hud-title { font-size: 15px; font-weight: 700; letter-spacing: 0.4px; margin-bottom: 8px; color: #ffe9a8; }
    .hud-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 6px 0; font-size: 13px; }
    .hud-row input[type="range"] { width: 130px; }
    .hud-help { margin-top: 10px; font-size: 12px; line-height: 1.35; color: rgba(255, 255, 255, 0.84); }
    .hud-mobile { pointer-events: auto; position: absolute; left: 12px; right: 12px; bottom: 12px;
      display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; }
    .move-pad { display: grid; grid-template-columns: repeat(3, 56px); grid-template-rows: repeat(3, 56px); gap: 6px; user-select: none; touch-action: none; }
    .move-pad button { border: 0; border-radius: 10px; background: rgba(20, 28, 36, 0.74); color: #fff; font-size: 16px; font-weight: 700; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28); }
    .look-pad { width: min(40vw, 190px); height: min(40vw, 190px); border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.2);
      background: radial-gradient(circle at center, rgba(155, 212, 255, 0.2), rgba(20, 28, 36, 0.55)); touch-action: none; position: relative; overflow: hidden; }
    .look-pad span { position: absolute; left: 8px; bottom: 8px; font-size: 12px; color: rgba(255, 255, 255, 0.8); }
    @media (min-width: 920px) { .hud-mobile { max-width: 540px; } }
  `;
	document.head.appendChild(style);

	const root = document.createElement('div');
	root.className = 'hud-root';
	root.innerHTML = `
    <section class="hud-panel">
      <div class="hud-title">Animal Crossing Village</div>
      <div class="hud-row"><label><input id="lightToggle" type="checkbox" checked /> Luce orbitante</label></div>
      <div class="hud-row"><label><input id="fogToggle" type="checkbox" /> Advanced: fog</label></div>
      <div class="hud-row"><span>Fog near</span><input id="fogNearRange" type="range" min="4" max="20" step="1" value="10" /></div>
      <div class="hud-row"><span>Fog far</span><input id="fogFarRange" type="range" min="16" max="50" step="1" value="30" /></div>
      <div class="hud-help" id="playerInfo">Player: 0.00, 0.00 | Camera: 0.00, 0.00, 0.00</div>
      <div class="hud-help">Desktop: WASD per muovere, mouse look (click su canvas).<br>Mobile: pad sinistro movimento, pad destro look.</div>
    </section>
    <div class="hud-mobile">
      <div class="move-pad" id="movePad">
        <div></div><button data-key="w">W</button><div></div>
        <button data-key="a">A</button><button data-key="s">S</button><button data-key="d">D</button>
        <div></div><div></div><div></div>
      </div>
      <div class="look-pad" id="lookPad"><span>LOOK</span></div>
    </div>
  `;
	document.body.appendChild(root);

	root.querySelector('#lightToggle').addEventListener('change', (e) => {
		state.rotateLight = e.target.checked;
	});
	root.querySelector('#fogToggle').addEventListener('change', (e) => {
		state.enableFog = e.target.checked;
	});
	root.querySelector('#fogNearRange').addEventListener('input', (e) => {
		state.fogNear = Number(e.target.value);
	});
	root.querySelector('#fogFarRange').addEventListener('input', (e) => {
		state.fogFar = Math.max(state.fogNear + 1, Number(e.target.value));
	});

	const playerInfo = root.querySelector('#playerInfo');
	const inputActions = {
		moveForward: false,
		moveBackward: false,
		moveLeft: false,
		moveRight: false
	};

	// Desktop keyboard
	window.addEventListener('keydown', (e) => {
		const k = e.key.toLowerCase();
		if (k === 'w') inputActions.moveForward = true;
		if (k === 's') inputActions.moveBackward = true;
		if (k === 'a') inputActions.moveLeft = true;
		if (k === 'd') inputActions.moveRight = true;
	});
	window.addEventListener('keyup', (e) => {
		const k = e.key.toLowerCase();
		if (k === 'w') inputActions.moveForward = false;
		if (k === 's') inputActions.moveBackward = false;
		if (k === 'a') inputActions.moveLeft = false;
		if (k === 'd') inputActions.moveRight = false;
	});

	// Mobile move pad
	root.querySelectorAll('.move-pad button').forEach((btn) => {
		addHoldButtonEvents(btn, btn.dataset.key, inputActions);
	});

	// Mobile look pad
	const lookPad = root.querySelector('#lookPad');
	let lookDragging = false,
		lookX = 0,
		lookY = 0;
	lookPad.addEventListener('pointerdown', (e) => {
		lookDragging = true;
		lookX = e.clientX;
		lookY = e.clientY;
		lookPad.setPointerCapture(e.pointerId);
	});
	lookPad.addEventListener('pointermove', (e) => {
		if (!lookDragging) return;
		const dx = e.clientX - lookX,
			dy = e.clientY - lookY;
		lookX = e.clientX;
		lookY = e.clientY;
		camera.look(dx, dy, 0.6);
		e.preventDefault();
	});
	lookPad.addEventListener('pointerup', () => {
		lookDragging = false;
	});
	lookPad.addEventListener('pointercancel', () => {
		lookDragging = false;
	});

	// Canvas touch look
	let touchId = null,
		touchX = 0,
		touchY = 0;
	canvas.addEventListener(
		'touchstart',
		(e) => {
			if (touchId !== null || e.touches.length === 0) return;
			const touch = e.touches[0];
			touchId = touch.identifier;
			touchX = touch.clientX;
			touchY = touch.clientY;
		},
		{ passive: true }
	);
	canvas.addEventListener(
		'touchmove',
		(e) => {
			if (touchId === null) return;
			const touch = Array.from(e.touches).find((t) => t.identifier === touchId);
			if (!touch) return;
			const dx = touch.clientX - touchX,
				dy = touch.clientY - touchY;
			touchX = touch.clientX;
			touchY = touch.clientY;
			camera.look(dx, dy, 0.45);
			e.preventDefault();
		},
		{ passive: false }
	);
	canvas.addEventListener('touchend', () => {
		touchId = null;
	});
	canvas.addEventListener('touchcancel', () => {
		touchId = null;
	});

	return {
		inputActions,
		updateInfo(player, camera) {
			const p = player.position,
				c = camera.position;
			playerInfo.textContent = `Player: ${p[0].toFixed(2)}, ${p[2].toFixed(2)} | Camera: ${c[0].toFixed(2)}, ${c[1].toFixed(2)}, ${c[2].toFixed(2)}`;
		}
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

	const [houseGeometry, char, tree] = await Promise.all([
		loadOBJ(MODEL_PATHS.house),
		loadModelWithResources(gl, MODEL_PATHS.char, TEXTURE_PATHS.char),
		loadModelWithResources(gl, MODEL_PATHS.tree, TEXTURE_PATHS.tree)
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

	const [houseWallsTexture, houseDoorTexture] = await Promise.all([
		loadTexture(gl, TEXTURE_PATHS.houseWallsRoof).catch(() => null),
		loadTexture(gl, TEXTURE_PATHS.houseDoorWindows).catch(() => null)
	]);

	let photoTexture = null;
	try {
		photoTexture = await loadTexture(gl, TEXTURE_PATHS.photo);
	} catch (e) {
		console.warn('Foto personale non caricata, fallback.', e);
		photoTexture = char.texture;
	}

	// const groundGeo = createDisc(86, 96, 28);
	const groundGeo = createCylinder(120, 120, 80, 80);
	const groundMesh = createMesh(gl, groundGeo);
	const photoBoardGeo = createPhotoBoardGeometry(1.2, 1.6);
	const photoBoardMesh = createMesh(gl, photoBoardGeo);
	const signPostMesh = createMesh(gl, createCube(1));

	const skyboxGeo = createCube(300);
	const skyboxMesh = createMesh(gl, skyboxGeo);

	const houseMatrix = buildModelMatrix(houseBounds, {
		scaleMul: 2,
		placeOnGround: true,
		translate: [0, 0, 0]
	});
	const signBaseMatrix = mat4Multiply(mat4Translate(4.1, 0.0, -2.0), mat4RotateY(-0.3));
	const photoBoardMatrix = composeSignPart(signBaseMatrix, 0, 2.1, 0.07, 1.0, 1.0, 1.0);

	const frameThickness = 0.12,
		frameDepth = 0.1,
		halfPhotoW = 1.2 * 0.5,
		halfPhotoH = 1.6 * 0.5;
	const photoFrameTopMatrix = composeSignPart(
		signBaseMatrix,
		0,
		2.1 + halfPhotoH + frameThickness * 0.5,
		0,
		1.2 + frameThickness * 2,
		frameThickness,
		frameDepth
	);
	const photoFrameBottomMatrix = composeSignPart(
		signBaseMatrix,
		0,
		2.1 - halfPhotoH - frameThickness * 0.5,
		0,
		1.2 + frameThickness * 2,
		frameThickness,
		frameDepth
	);
	const photoFrameLeftMatrix = composeSignPart(
		signBaseMatrix,
		-(halfPhotoW + frameThickness * 0.5),
		2.1,
		0,
		frameThickness,
		1.6,
		frameDepth
	);
	const photoFrameRightMatrix = composeSignPart(
		signBaseMatrix,
		halfPhotoW + frameThickness * 0.5,
		2.1,
		0,
		frameThickness,
		1.6,
		frameDepth
	);
	const photoPostMatrix = composeSignPart(signBaseMatrix, 0, 1.05, -0.04, 0.16, 2.1, 0.16);

	const objects = [
		{ mesh: groundMesh, modelMatrix: mat4Identity(), color: [0.1, 0.62, 0.16] },
		{
			mesh: photoBoardMesh,
			modelMatrix: photoBoardMatrix,
			color: [1.0, 1.0, 1.0],
			texture: photoTexture,
			invertUVY: false
		},
		{ mesh: signPostMesh, modelMatrix: photoPostMatrix, color: [0.57, 0.37, 0.15] },
		{ mesh: signPostMesh, modelMatrix: photoFrameTopMatrix, color: [0.71, 0.5, 0.22] },
		{ mesh: signPostMesh, modelMatrix: photoFrameBottomMatrix, color: [0.71, 0.5, 0.22] },
		{ mesh: signPostMesh, modelMatrix: photoFrameLeftMatrix, color: [0.71, 0.5, 0.22] },
		{ mesh: signPostMesh, modelMatrix: photoFrameRightMatrix, color: [0.71, 0.5, 0.22] }
	];

	const addHousePart = (mesh, texture) => {
		if (!mesh) return;
		const go = new GameObject({ gl, mesh, texture, color: [1.0, 1.0, 1.0], invertUVY: true });
		go.modelMatrix = houseMatrix;
		objects.splice(1, 0, go);
	};
	addHousePart(houseMaterialMeshes.Walls_Roof, houseWallsTexture);
	addHousePart(houseMaterialMeshes.Door_windows, houseDoorTexture || houseWallsTexture);
	if (!houseMaterialMeshes.Walls_Roof && !houseMaterialMeshes.Door_windows) {
		addHousePart(houseMaterialMeshes.default, houseWallsTexture);
	}

	// Prepare instanced matrices for many trees (20) instead of creating many GameObject instances
	const TREE_COUNT = 30;
	const treeMatrices = new Float32Array(TREE_COUNT * 16);
	const treeColliders = [];
	for (let i = 0; i < TREE_COUNT; i++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = 4 + Math.random() * 18; // avoid too close to center
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		const scaleMul = 1.1 + Math.random() * 1.1;
		const rot = Math.random() * Math.PI * 2;
		const m = buildModelMatrix(tree.bounds, {
			scaleMul,
			placeOnGround: true,
			translate: [x, 0, z],
			rotateY: rot
		});
		for (let k = 0; k < 16; k++) treeMatrices[i * 16 + k] = m[k];

		// compute approximate cylindrical collider center from matrix (indices 12,13,14)
		const cx = m[12];
		const cy = m[13];
		const cz = m[14];
		const radiusCollider = 0.6 * scaleMul; // heuristic
		treeColliders.push({
			type: 'cylinder',
			name: `tree_inst_${i}`,
			center: [cx, cy, cz],
			radius: radiusCollider
		});
	}

	const state = { rotateLight: false, enableFog: true, fogNear: 9, fogFar: 23 };

	const player = new PlayerController([0, 0, 9.0], 12);
	const camera = new Camera([0, 6.4, 6.6], [0, 0, 0], canvas);
	camera.mode = 'rolling-follow';
	camera.followTarget = player;
	camera.yaw = 0;
	camera.rollingBackDistance = 6.0;
	camera.rollingHeight = 3.5;
	camera.rollingLookAhead = 0.0;
	camera.smoothing = 0.0;

	const hud = createControlPanel(state, camera, canvas);
	const hudCanvas = createHUDCanvas({ worldRadius: 26 });

	// Create GameObject for player character (we'll update its modelMatrix each frame using buildModelMatrix)
	const playerGO = new GameObject({
		gl,
		mesh: char.mesh,
		texture: char.texture,
		color: [1.0, 1.0, 1.0],
		invertUVY: true
	});
	// initial placement via helper
	playerGO.setModelMatrix(
		buildModelMatrix(char.bounds, {
			scaleMul: 0.72,
			placeOnGround: true,
			translate: player.position,
			rotateY: player.yaw
		})
	);
	// insert playerGO into objects so it's rendered with others
	objects.splice(1, 0, playerGO);

	let lastTime = performance.now(),
		lightAngle = 0;

	function animate(nowMs) {
		const deltaTime = Math.min(0.05, (nowMs - lastTime) * 0.001);
		lastTime = nowMs;

		const cameraForward = [
			Math.sin(camera.yaw) * Math.cos(camera.pitch),
			Math.sin(camera.pitch),
			-Math.cos(camera.yaw) * Math.cos(camera.pitch)
		];
		const cameraRight = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)];

		// Build collider list (static + instanced trees) and update player with camera directions for relative movement
		const colliders = STATIC_COLLIDERS.concat(treeColliders);
		player.update(deltaTime, hud.inputActions, colliders, cameraForward, cameraRight);

		camera.updatePosition(deltaTime);

		// Update player GameObject modelMatrix from PlayerController state
		playerGO.setModelMatrix(
			buildModelMatrix(char.bounds, {
				scaleMul: 0.72,
				placeOnGround: true,
				translate: player.position,
				rotateY: player.yaw
			})
		);

		if (state.rotateLight) {
			lightAngle += deltaTime * 0.65;
		}
		const lightDir = [Math.cos(lightAngle) * 0.7, 1.0, Math.sin(lightAngle) * 0.7];

		// Bind global uniforms (projection, view, fog, curvature, lights) and render each object by calling
		// its .render() when available (GameObject) or falling back to the old path for plain objects.
		const gl = renderer.gl;
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(renderer.skyProgram);

		const projection = mat4Perspective(
			Math.PI / 4,
			renderer.canvas.width / renderer.canvas.height,
			0.2,
			140
		);
		const view = camera.getViewMatrix();


		// A. Disattivi la scrittura della profondità: la skybox sarà lo "sfondo"
		gl.depthMask(false);

		// B. Disattivi momentaneamente il culling per vedere il cubo dall'interno
		gl.disable(gl.CULL_FACE);

		// C. (Opzionale per ora) Spegni la curvatura per il cielo!
		// Altrimenti il cielo si piegherà come il terreno. Passa 0.0 temporaneamente:
		gl.uniform1f(renderer.uCurvatureStrength, 0.0);

		// D. Imposti la modelMatrix specifica del cielo (es. centrata sul player o fissa)
		gl.uniformMatrix4fv(renderer.uModelMatrix, false, new Float32Array(mat4Identity()));
		gl.uniform3f(renderer.uBaseColor, 0.5, 0.7, 1.0); // Il colore base azzurro
		gl.uniform1i(renderer.uUseTexture, 0); // Niente texture per ora, solo colore dello shader

		// E. Disegni effettivamente la mesh
		setMeshAttributes(gl, renderer.program, skyboxMesh);
		drawMesh(gl, skyboxMesh);

		// F. RIPRISTINI GLI STATI PER IL RESTO DEL GIOCO
		gl.depthMask(true); // Gli alberi e la casa DEVONO scrivere nel depth buffer!
		gl.enable(gl.CULL_FACE); // Riattivi il culling se lo usi normalmente

    
		gl.useProgram(renderer.program);
		gl.uniform1f(renderer.uCurvatureStrength, 0.0048); // Ripristini la curvatura per il terreno/alberi

		gl.uniformMatrix4fv(renderer.uProjection, false, new Float32Array(projection));
		gl.uniformMatrix4fv(renderer.uView, false, new Float32Array(view));
		gl.uniform3f(renderer.uLightDir, lightDir[0], lightDir[1], lightDir[2]);
		gl.uniform3f(
			renderer.uCameraPos,
			camera.position[0],
			camera.position[1],
			camera.position[2]
		);
		gl.uniform1i(renderer.uEnableFog, state.enableFog);
		gl.uniform3f(renderer.uFogColor, 0.32, 0.54, 0.27); // TODO: change fog color
		gl.uniform1f(renderer.uFogNear, state.fogNear);
		gl.uniform1f(renderer.uFogFar, Math.max(state.fogNear + 1, state.fogFar));
		gl.uniform1f(renderer.uCurvatureStrength, 0.0048);
		gl.uniform2f(renderer.uCurvatureOrigin, player.position[0], player.position[2]);

		// Draw instanced trees first
		if (tree && tree.mesh) {
			// ensure object model is identity for instanced draws
			gl.uniformMatrix4fv(renderer.uModelMatrix, false, new Float32Array(mat4Identity()));
			gl.uniform1i(renderer.uUseInstancing, 1);
			gl.uniform1i(renderer.uUseTexture, tree.texture ? 1 : 0);
			if (tree.texture) {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, tree.texture);
				gl.uniform1i(renderer.uTexture, 0);
			}
			gl.uniform1i(renderer.uInvertUVY, true);
			gl.uniform3f(renderer.uBaseColor, 1.0, 1.0, 1.0);
			drawMeshInstanced(gl, renderer.program, tree.mesh, treeMatrices, TREE_COUNT);
			gl.uniform1i(renderer.uUseInstancing, 0);
		}

		for (const obj of objects) {
			if (typeof obj.render === 'function') {
				obj.render(gl, renderer.program);
			} else {
				// legacy plain-object path
				gl.uniformMatrix4fv(
					renderer.uModelMatrix,
					false,
					new Float32Array(obj.modelMatrix)
				);
				gl.uniform3f(renderer.uBaseColor, obj.color[0], obj.color[1], obj.color[2]);

				const useTexture = obj.texture ? true : false;
				gl.uniform1i(renderer.uUseTexture, useTexture);
				gl.uniform1i(renderer.uInvertUVY, obj.invertUVY ? true : false);

				if (obj.texture) {
					gl.activeTexture(gl.TEXTURE0);
					gl.bindTexture(gl.TEXTURE_2D, obj.texture);
					gl.uniform1i(renderer.uTexture, 0);
				}

				setMeshAttributes(gl, renderer.program, obj.mesh);
				drawMesh(gl, obj.mesh);
			}
		}

		hud.updateInfo(player, camera);
		// update HUD canvas (minimap)
		if (hudCanvas) hudCanvas.draw(player.position, camera, treeColliders);
		requestAnimationFrame(animate);
	}

	requestAnimationFrame(animate);
	console.log('Avviato: terza persona + collisioni + mini-mondo');
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
