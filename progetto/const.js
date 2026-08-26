export const MODEL_PATHS = {
	char: 'obj/animal-crossing-character/source/char.obj',
	house: 'obj/animal-crossing-house/source/house.obj',
	tree: 'obj/animal-crossing-pine-tree/source/base.obj',
	cloud: 'obj/nuvoletta.obj'
};

export const TEXTURE_PATHS = {
	houseWallsRoof: './obj/animal-crossing-house/textures/Base_Color_1.jpg',
	houseDoorWindows: './obj/animal-crossing-house/textures/Base_Color.jpg',
	char: './obj/animal-crossing-character/textures/character_ac_low_DefaultMaterial_BaseColor.png',
	photo: './textures/mia-foto.jpg',
	tree: './obj/animal-crossing-pine-tree/texture/texture_diffuse.png',
	grass: './textures/grass.png'
};

export const STATIC_COLLIDERS = [
	{ type: 'boundsCircle', name: 'worldBoundCircle', center: [0, 0, 0], radius: 100 }
];

export const GROUND = {
	width: 120,
	depth: 120,
	subdivisionsX: 80,
	subdivisionsZ: 80
};

export const CLOUDS = {
	count: 12,
	areaX: 55,
	areaZ: 35,
	minHeight: 8,
	heightRange: 6,
	minScale: 1.4,
	scaleRange: 1.8,
	minVelocityX: -0.8,
	velocityRangeX: 1.6,
	wrapMargin: 10,
	rotationY: Math.PI / 2,
	opacity: 0.9
};

export const TREES = {
	count: 30,
	minRadius: 4,
	radiusRange: 18,
	minScale: 1.1,
	scaleRange: 1.1,
	fadeRadius: 3.5
};

export const CAMERA = {
	position: [0, 6.4, 6.6],
	rollingBackDistance: 8.0,
	rollingHeight: 3.5,
	rollingLookAhead: 0.0,
	smoothing: 0.0
};

export const RENDERING = {
	skyboxSize: 300,
	curvatureStrength: 0.005,
	worldRadius: 60
};

export const FOG = {
	nearMin: 1,
	nearMax: 30,
	farMin: 10,
	farMax: 60,
	near: 9,
	far: 23
};

export const TIME_PRESETS = {
	Alba: {
		color: [1.0, 0.75, 0.5],
		intensity: 0.8,
		skyColorHorizon: [0.95, 0.6, 0.4],
		skyColorZenith: [0.3, 0.35, 0.6]
	},
	Mezzogiorno: {
		color: [1.0, 1.0, 0.95],
		intensity: 1.2,
		skyColorHorizon: [0.7, 0.85, 0.95],
		skyColorZenith: [0.15, 0.4, 0.85]
	},
	Tramonto: {
		color: [0.95, 0.45, 0.2],
		intensity: 0.7,
		skyColorHorizon: [0.9, 0.4, 0.2],
		skyColorZenith: [0.15, 0.15, 0.4]
	},
	Notte: {
		color: [0.2, 0.3, 0.6],
		intensity: 0.3,
		skyColorHorizon: [0.08, 0.1, 0.2],
		skyColorZenith: [0.01, 0.02, 0.08]
	}
};

export const DEFAULT_TIME_OF_DAY = 'Mezzogiorno';
export const DEFAULT_LIGHT_COLOR = [1.0, 1.0, 0.95];
export const DEFAULT_SKY_COLOR_HORIZON = [0.7, 0.85, 0.95];
export const DEFAULT_SKY_COLOR_ZENITH = [0.15, 0.4, 0.85];
export const DEFAULT_LIGHT_INTENSITY = 1.0;
export const DEFAULT_FOG_ENABLED = false;
export const DEFAULT_ROTATE_LIGHT = false;
