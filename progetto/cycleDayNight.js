import { TIME_PRESETS } from './const.js';
const durationPerPreset = 5.0; // Durata della sfumatura tra ogni fase (in secondi)
let cycleTimer = 0;

// Sfuma un singolo valore numerico
function lerp(start, end, t) {
    return start + (end - start) * t;
}

// Sfuma un array (es. colori RGB [r, g, b])
function lerpColor(out, c1, c2, t) {
    out[0] = lerp(c1[0], c2[0], t);
    out[1] = lerp(c1[1], c2[1], t);
    out[2] = lerp(c1[2], c2[2], t);
}

export function dayNightCycleUpdate(deltaTime, state, hud) {
    if (state.dayNightCycle) {
        cycleTimer += deltaTime;
        
			const presetKeys = Object.keys(TIME_PRESETS);
			const totalDuration = presetKeys.length * durationPerPreset;
        const currentTotalTime = cycleTimer % totalDuration;
        
        // Calcola l'indice della fase corrente e della successiva
        const currentIndex = Math.floor(currentTotalTime / durationPerPreset);
			const nextIndex = (currentIndex + 1) % presetKeys.length;
        
        // Calcola il fattore di avanzamento 't' (da 0.0 a 1.0) tra la fase attuale e la successiva
        const t = (currentTotalTime % durationPerPreset) / durationPerPreset;

			const pCurrent = TIME_PRESETS[presetKeys[currentIndex]];
			const pNext = TIME_PRESETS[presetKeys[nextIndex]];

        // Interpolazione del colore e dell'intensità della luce
        lerpColor(state.lightColor, pCurrent.color, pNext.color, t);
        state.lightIntensity = lerp(pCurrent.intensity, pNext.intensity, t);

        // Interpolazione Skybox Horizon
        lerpColor(state.skyColorHorizon, pCurrent.skyColorHorizon, pNext.skyColorHorizon, t);

        // Interpolazione Skybox Zenith
        lerpColor(state.skyColorZenith, pCurrent.skyColorZenith, pNext.skyColorZenith, t);

			// Aggiorna il nome della fase corrente nella GUI
			state.timeOfDay = presetKeys[currentIndex];

        // Forza il refresh visivo dei controller in dat.GUI
        hud.gui.updateDisplay();
    }
}
