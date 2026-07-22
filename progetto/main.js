// main.js: Orchestrazione scena con Player controller, Camera follow, Collisioni

import { createCube, createCylinder } from './geometry.js';
import { loadOBJ, computeBounds } from './objLoader.js';
import { createMesh, loadTexture } from './shaderUtils.js';
import { createCanvas, Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { PlayerController } from './player.js';
import { mat4Identity, mat4Translate, mat4Scale, mat4Multiply, mat4RotateY } from './math.js';
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
	tree: './obj/animal-crossing-pine-tree/texture/texture_diffuse.png',
	grass: './textures/grass.png'
};

// Collider statici di base (Gli alberi generati verranno aggiunti dinamicamente)
const STATIC_COLLIDERS = [
	{ type: 'aabb', name: 'house', min: [-3.5, 0, -3.0], max: [3.5, 3.0, 2.5] },
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
    </div>`;
	document.body.appendChild(root);

	root.querySelector('#lightToggle').addEventListener(
		'change',
		(e) => (state.rotateLight = e.target.checked)
	);
	root.querySelector('#fogToggle').addEventListener(
		'change',
		(e) => (state.enableFog = e.target.checked)
	);
	root.querySelector('#fogNearRange').addEventListener(
		'input',
		(e) => (state.fogNear = Number(e.target.value))
	);
	root.querySelector('#fogFarRange').addEventListener(
		'input',
		(e) => (state.fogFar = Math.max(state.fogNear + 1, Number(e.target.value)))
	);

	const playerInfo = root.querySelector('#playerInfo');
	const inputActions = {
		moveForward: false,
		moveBackward: false,
		moveLeft: false,
		moveRight: false
	};

	// Gestione unificata Mappatura Tasti Desktop
	const keyMap = { w: 'moveForward', s: 'moveBackward', a: 'moveLeft', d: 'moveRight' };
	const handleKey = (e, isDown) => {
		const action = keyMap[e.key.toLowerCase()];
		if (action) inputActions[action] = isDown;
	};
	window.addEventListener('keydown', (e) => handleKey(e, true));
	window.addEventListener('keyup', (e) => handleKey(e, false));

	// Touch Pad Movimento Mobile
	root.querySelectorAll('.move-pad button').forEach((btn) => {
		const action = keyMap[btn.dataset.key];
		if (!action) return;
		const setAction = (v) => (e) => {
			e.preventDefault();
			inputActions[action] = v;
		};
		['mousedown', 'touchstart'].forEach((ev) =>
			btn.addEventListener(ev, setAction(true), { passive: false })
		);
		['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((ev) =>
			btn.addEventListener(ev, setAction(false), { passive: false })
		);
	});

	// Touch Pad Look
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
		camera.look(e.clientX - lookX, e.clientY - lookY, 0.6);
		lookX = e.clientX;
		lookY = e.clientY;
		e.preventDefault();
	});
	const stopLook = () => (lookDragging = false);
	['pointerup', 'pointercancel'].forEach((ev) => lookPad.addEventListener(ev, stopLook));

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

	const [houseWallsTexture, houseDoorTexture, photoTexture, grassTexture] = await Promise.all([
		loadTexture(gl, TEXTURE_PATHS.houseWallsRoof).catch(() => null),
		loadTexture(gl, TEXTURE_PATHS.houseDoorWindows).catch(() => null),
		loadTexture(gl, TEXTURE_PATHS.photo).catch(() => char.texture),
		loadTexture(gl, TEXTURE_PATHS.grass).catch(() => null)
	]);

	const groundMesh = createMesh(gl, createCylinder(120, 120, 80, 80));
	const photoBoardMesh = createMesh(gl, createPhotoBoardGeometry(1.2, 1.6));
	const signPostMesh = createMesh(gl, createCube(1));
	const skyboxMesh = createMesh(gl, createCube(300));

	const houseMatrix = buildModelMatrix(houseBounds, {
		scaleMul: 2,
		placeOnGround: true,
		rotateY: -Math.PI / 2,
		translate: [0, 0, 0]
	});

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
		{ x: hw + frameThickness * 0.5, y: 2.1, z: 0, sx: frameThickness, sy: 1.6, sz: frameDepth }
	].map((p) => composeSignPart(signBaseMatrix, p.x, p.y, p.z, p.sx, p.sy, p.sz));

	const objects = [
		{
			mesh: groundMesh,
			modelMatrix: mat4Identity(),
			color: [1, 1, 1],
			texture: grassTexture,
			invertUVY: true
		},
		{
			mesh: photoBoardMesh,
			modelMatrix: photoBoardMatrix,
			color: [1, 1, 1],
			texture: photoTexture,
			invertUVY: false
		},
		{ mesh: signPostMesh, modelMatrix: photoPostMatrix, color: [0.57, 0.37, 0.15] },
		...frameParts.map((m) => ({ mesh: signPostMesh, modelMatrix: m, color: [0.71, 0.5, 0.22] }))
	];

	const addHousePart = (mesh, texture) => {
		if (!mesh) return;
		const go = new GameObject({ gl, mesh, texture, color: [1.0, 1.0, 1.0], invertUVY: true });
		go.modelMatrix = houseMatrix;
		objects.splice(1, 0, go);
	};
	addHousePart(houseMaterialMeshes.Walls_Roof, houseWallsTexture);
	addHousePart(houseMaterialMeshes.Door_windows, houseDoorTexture);

	// Generazione Alberi Instanziati
	const TREE_COUNT = 30;
	const treeMatrices = new Float32Array(TREE_COUNT * 16);
	const treeOpacities = new Float32Array(TREE_COUNT);
	const treeColliders = [];

	for (let i = 0; i < TREE_COUNT; i++) {
		const angle = Math.random() * Math.PI * 2;
		const radius = 4 + Math.random() * 18;
		const x = Math.cos(angle) * radius;
		const z = Math.sin(angle) * radius;
		const scaleMul = 1.1 + Math.random() * 1.1;
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

	const state = { rotateLight: false, enableFog: false, fogNear: 9, fogFar: 23 };

	const player = new PlayerController([0, 0, 9.0], 12);
	const camera = new Camera([0, 6.4, 6.6], [0, 0, 0], canvas);
	camera.mode = 'rolling-follow';
	camera.followTarget = player;
	camera.yaw = 0;
	camera.rollingBackDistance = 8.0;
	camera.rollingHeight = 3.5;
	camera.rollingLookAhead = 0.0;
	camera.smoothing = 0.0;

	const hud = createControlPanel(state, camera, canvas);
	const hudCanvas = createHUDCanvas({ worldRadius: 26 });

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

		// 1. Movimento e Fisica
		const cameraForward = [
			Math.sin(camera.yaw) * Math.cos(camera.pitch),
			Math.sin(camera.pitch),
			-Math.cos(camera.yaw) * Math.cos(camera.pitch)
		];
		const cameraRight = [Math.cos(camera.yaw), 0, Math.sin(camera.yaw)];

		const colliders = STATIC_COLLIDERS.concat(treeColliders);
		player.update(deltaTime, hud.inputActions, colliders, cameraForward, cameraRight);
		camera.updatePosition(deltaTime);

		// 2. Calcolo opacità dinamica degli alberi vicini alla camera
		const FADE_RADIUS = 3.5; // Distanza di sfumatura
		for (let i = 0; i < treeColliders.length; i++) {
			const tc = treeColliders[i].center;
			const dx = tc[0] - camera.position[0];
			const dz = tc[2] - camera.position[2];
			const distToCam = Math.sqrt(dx * dx + dz * dz);

			let targetOpacity = 1.0;
			if (distToCam < FADE_RADIUS) {
				targetOpacity = 0.0;
			}
			// LERP per transizione morbida
			treeOpacities[i] += (targetOpacity - treeOpacities[i]) * 0.1;
		}

		// 3. Aggiorna matrici Player
		playerGO.setModelMatrix(
			buildModelMatrix(char.bounds, {
				scaleMul: 0.72,
				placeOnGround: true,
				translate: player.position,
				rotateY: player.yaw
			})
		);

		if (state.rotateLight) lightAngle += deltaTime * 0.65;
		const lightDir = [Math.cos(lightAngle) * 0.7, 1.0, Math.sin(lightAngle) * 0.7];

		// 4. Rendering (passando treeOpacities aggiornato)
		renderer.render(camera, objects, skyboxMesh, {
			lightDir: lightDir,
			enableFog: state.enableFog,
			fogColor: [0.7, 0.85, 0.95],
			fogNear: state.fogNear,
			fogFar: state.fogFar,
			curvatureStrength: 0.005,
			curvatureOrigin: [player.position[0], player.position[2]],
			treeData: {
				mesh: tree.mesh,
				texture: tree.texture,
				matrices: treeMatrices,
				opacities: treeOpacities,
				count: TREE_COUNT
			}
		});

		// 5. HUD 2D
		hud.updateInfo(player, camera);
		if (hudCanvas) hudCanvas.draw(player.position, camera, treeColliders);

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
