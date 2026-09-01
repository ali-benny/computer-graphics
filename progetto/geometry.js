export function createCube(size = 1) {
	const s = size * 0.5;

	const positions = [
		// Faccia frontale (Z+)
		-s, -s, s, s, -s, s, s, s, s, -s, s, s,
		// Faccia posteriore (Z-)
		s, -s, -s, -s, -s, -s, -s, s, -s, s, s, -s,
		// Faccia destra (X+)
		s, -s, s, s, -s, -s, s, s, -s, s, s, s,
		// Faccia sinistra (X-)
		-s, -s, -s, -s, -s, s, -s, s, s, -s, s, -s,
		// Faccia superiore (Y+)
		-s, s, s, s, s, s, s, s, -s, -s, s, -s,
		// Faccia inferiore (Y-)
		-s, -s, -s, s, -s, -s, s, -s, s, -s, -s, s,
	];

	const normals = [
		// Frontale
		0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
		// Posteriore
		0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
		// Destra
		1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
		// Sinistra
		-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
		// Superiore
		0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
		// Inferiore
		0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
	];

	const indices = [
		 0, 1, 2, 0, 2, 3, // Frontale 
		 4, 5, 6, 4, 6, 7, // Posteriore
		 8, 9, 10, 8, 10, 11, // Destra
		12, 13, 14, 12, 14, 15, // Sinistra
		16, 17, 18, 16, 18, 19, // Superiore
		20, 21, 22, 20, 22, 23, // Inferiore
	];

	return {
		positions: new Float32Array(positions),
		normals: new Float32Array(normals),
		indices: new Uint32Array(indices),
	};
}

export function createCylinder(width = 60, depth = 60, subdivisionsX = 60, subdivisionsZ = 60) {
	// questa funzione in realtà genera una fitta griglia PIATTA sul piano XZ.
	// Sarà il Vertex Shader a curvarla matematicamente a forma di cilindro/tronco!

	const positions = [];
	const normals = [];
	const uvs = [];
	const indices = [];

	const cols = subdivisionsX + 1;

	// 1. Generazione dei Vertici (Griglia regolare XZ)
	for (let zIndex = 0; zIndex <= subdivisionsZ; zIndex++) {
		// Calcola la coordinata Z da -depth/2 a +depth/2 (centrata sull'origine)
		const zPercent = zIndex / subdivisionsZ;
		const z = -depth * 0.5 + zPercent * depth;

		for (let xIndex = 0; xIndex <= subdivisionsX; xIndex++) {
			// Calcola la coordinata X da -width/2 a +width/2
			const xPercent = xIndex / subdivisionsX;
			const x = -width * 0.5 + xPercent * width;

			// Il terreno nasce piatto a quota Y = 0
			positions.push(x, 0, z);

			// La normale iniziale punta verso l'alto globale (0, 1, 0)
			normals.push(0, 1, 0);

			// Coordinate UV per le texture mappate sulla griglia 100x100
			uvs.push(xPercent * 100, zPercent * 100);
		}
	}

	// 2. Generazione degli Indici (Doppio ciclo per legare i triangoli senza sovrapposizioni)
	for (let zIndex = 0; zIndex < subdivisionsZ; zIndex++) {
		for (let xIndex = 0; xIndex < subdivisionsX; xIndex++) {
			// Trova l'indice del vertice corrente in basso a sinistra del quad
			const a = zIndex * cols + xIndex;
			const b = a + 1; // Basso a destra
			const c = a + cols; // Alto a sinistra
			const d = c + 1; // Alto a destra

			// Primo triangolo del quad (ABC)
			indices.push(a, c, b);
			// Secondo triangolo del quad (CBD)
			indices.push(b, c, d);
		}
	}

	return {
		positions: new Float32Array(positions),
		normals: new Float32Array(normals),
		uvs: new Float32Array(uvs),
		indices: new Uint32Array(indices),
	};
}
