import { vec3Sub, vec3Cross, vec3Normalize } from "./math.js";

export function parseOBJ(objText) {
  const positionsSrc = [];
  const normalsSrc = [];
  const uvsSrc = [];

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const vertexMap = new Map();
  const materialGroups = new Map();
  let currentMaterial = "default";

  const getMaterialGroup = (name) => {
    if (!materialGroups.has(name)) {
      materialGroups.set(name, []);
    }
    return materialGroups.get(name);
  };

  getMaterialGroup(currentMaterial);

  const lines = objText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const parts = line.split(/\s+/);
    const op = parts[0];

    if (op === "v") { // vertici
      positionsSrc.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (op === "vn") { // normali
      normalsSrc.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (op === "vt") { // coordinate texture
      uvsSrc.push([parseFloat(parts[1]), parseFloat(parts[2])]);
    } else if (op === "usemtl") { // materiale corrente
      currentMaterial = parts.slice(1).join(" ") || "default";
      getMaterialGroup(currentMaterial);
    } else if (op === "f") {  // truangolazione delle facce
      const faceTokens = parts.slice(1);
      for (let i = 1; i < faceTokens.length - 1; i += 1) {
        const tri = [faceTokens[0], faceTokens[i], faceTokens[i + 1]];
        const triIndices = [];
        for (const token of tri) {
          const key = token;
          let index = vertexMap.get(key);
          if (index === undefined) {
            const [pStr, tStr, nStr] = token.split("/");

            const pIndex = parseInt(pStr, 10);
            const tIndex = tStr ? parseInt(tStr, 10) : 0;
            const nIndex = nStr ? parseInt(nStr, 10) : 0;

            const p = positionsSrc[pIndex > 0 ? pIndex - 1 : positionsSrc.length + pIndex];
            positions.push(p[0], p[1], p[2]);

          // - Gestione indici negativi -
            if (nIndex !== 0) {
              const n = normalsSrc[nIndex > 0 ? nIndex - 1 : normalsSrc.length + nIndex];
              normals.push(n[0], n[1], n[2]);
            } else {
              normals.push(0, 0, 0);
            }

            if (tIndex !== 0 && uvsSrc.length > 0) {
              const uv = uvsSrc[tIndex > 0 ? tIndex - 1 : uvsSrc.length + tIndex];
              uvs.push(uv[0], uv[1]);
            } else {
              uvs.push(0, 0);
            }

            index = positions.length / 3 - 1;
            vertexMap.set(key, index);
          }
          indices.push(index);
          triIndices.push(index);
        }
        const group = getMaterialGroup(currentMaterial);
        group.push(triIndices[0], triIndices[1], triIndices[2]);
      }
    }
  }

  // Se mancano le normali le calcoliamo automaticamente [Smooth Normals]
  let hasRealNormals = false;
  for (let i = 0; i < normals.length; i += 3) {
    if (normals[i] !== 0 || normals[i + 1] !== 0 || normals[i + 2] !== 0) {
      hasRealNormals = true;
      break;
    }
  }

  if (!hasRealNormals) {
    for (let i = 0; i < indices.length; i += 3) {
      const ia = indices[i] * 3;
      const ib = indices[i + 1] * 3;
      const ic = indices[i + 2] * 3;

      const a = [positions[ia], positions[ia + 1], positions[ia + 2]];
      const b = [positions[ib], positions[ib + 1], positions[ib + 2]];
      const c = [positions[ic], positions[ic + 1], positions[ic + 2]];

      const ab = vec3Sub(b, a);
      const ac = vec3Sub(c, a);
      const n = vec3Cross(ab, ac);

      normals[ia] += n[0];
      normals[ia + 1] += n[1];
      normals[ia + 2] += n[2];

      normals[ib] += n[0];
      normals[ib + 1] += n[1];
      normals[ib + 2] += n[2];

      normals[ic] += n[0];
      normals[ic + 1] += n[1];
      normals[ic + 2] += n[2];
    }

    for (let i = 0; i < normals.length; i += 3) {
      const n = vec3Normalize([normals[i], normals[i + 1], normals[i + 2]]);
      normals[i] = n[0];
      normals[i + 1] = n[1];
      normals[i + 2] = n[2];
    }
  }

  // Convertiamo i gruppi di materiali in array tipizzati
  const materialGroupsOut = {};
  for (const [materialName, groupIndices] of materialGroups.entries()) {
    if (groupIndices.length > 0) {
      materialGroupsOut[materialName] = new Uint32Array(groupIndices);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
    materialGroups: materialGroupsOut,
  };
}

/**
 * calcola la bounding box e il centro del modello, insieme a un fattore di scala uniforme per normalizzare le dimensioni
 */
export function computeBounds(positions) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (x < min[0]) min[0] = x;
    if (y < min[1]) min[1] = y;
    if (z < min[2]) min[2] = z;
    if (x > max[0]) max[0] = x;
    if (y > max[1]) max[1] = y;
    if (z > max[2]) max[2] = z;
  }

  const center = [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5,
  ];

  const extent = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const longest = Math.max(extent[0], extent[1], extent[2]) || 1;
  const uniformScale = 2 / longest;

  return { center, uniformScale, min, max };
}

export async function loadOBJ(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Impossibile caricare OBJ: " + url);
  }
  const text = await response.text();
  return parseOBJ(text);
}
