- [x] Sistema le proporzioni degli oggetti. Prima di aggiungere altro, fai una passata di scala coerente per casa, character, alberi e props. L’idea è definire un’unità di misura del mondo e applicare la stessa logica a tutti i modelli, invece di scalare “a occhio”. Questo ti fa capire bene bounds, trasformazioni e fitting dei modelli 3D. Il punto centrale oggi è la trasformazione dei modelli in main.js e la gestione del player in player.js.

- [x] Costruisci il “mondo a cilindro” o mini-mondo curvo. Questo è un ottimo esercizio WebGL perché ti obbliga a ragionare su geometria, deformazione delle coordinate e coerenza tra rendering e collisioni. Puoi partire con una semplice superficie cilindrica oppure una ground mesh leggermente curvata. È una buona evoluzione del terreno attuale in main.js, che oggi è ancora molto “piatto”.

- [ ] Separazione chiara tra zone del terreno. A questo punto aggiungi materiali o mesh diverse per erba, sabbia e acqua. Non fare tutto con una sola texture: prova a costruire più superfici o più regioni della stessa superficie, così impari a gestire UV, draw call e layering. Questo è il passo giusto per introdurre laghetti e coste senza complicarti subito con shader troppo avanzati.
	- [ ] Crea il cielo:

	Scegliere lo **Sky Shader** procedurale è un'ottima mossa: ti darà il controllo totale sull'atmosfera del tuo villaggio, è leggerissimo e ti permetterà di imparare a ragionare "a pixel" nel Fragment Shader.

Ecco una scaletta logica, divisa in passaggi concettuali, con le relative dritte teoriche per guidarti nella scrittura del codice da zero.

---

## Passo 1: Il "Contenitore" del Cielo (La Geometria)

Prima di colorare, hai bisogno di dire a WebGL *dove* disegnare il cielo. Dato che vuoi un effetto che riempia lo sfondo, ci sono due scuole di pensiero:

* **Il Cubo/Sfera Gigante:** Generi un cubo (puoi riusare `createCube` che hai già) o una sfera, e lo scali fino a farlo diventare immenso (es. scala 100).
* **Il trucco del Full-Screen Quad:** Crei un singolo rettangolo piatto fatto di due triangoli che si incolla perfettamente allo schermo (con coordinate dei vertici che vanno da -1 a 1 in Normalized Device Coordinates).
* **Tip Teorico:** Se usi il cubo o la sfera, ricordati che la telecamera ci camminerà dentro. Di default, WebGL scarta i triangoli rivolti all'indietro (*Back-face culling*). Per vedere il cielo dall'interno, potresti dover invertire l'ordine degli indici dei triangoli nella mesh del cielo, oppure disattivare temporaneamente il culling (`gl.disable(gl.CULL_FACE)`) solo quando disegni il cielo.

---

## Passo 2: Disegnare "Dietro a Tutto" (Il Depth Buffer)

Se disegni un cubo enorme, rischi che copra la casa o gli alberi se questi si allontanano troppo, oppure rischi di sprecare calcoli GPU disegnando il cielo sopra oggetti che lo nascondono.

* **La tecnica classica:** Disegna il cielo come **primissimo oggetto** nel tuo ciclo di `animate`, prima delle case e degli alberi, e **disattiva la scrittura sul buffer di profondità** durante il suo disegno:
```javascript
gl.depthMask(false); // Il cielo non scrive nel depth buffer
// ... disegni il cielo ...
gl.depthMask(true);  // Riattivi per tutto il resto

```


* **Perché funziona?** Il cielo colorerà lo sfondo, ma non scriverà nessuna "profondità". Quando successivamente disegnerai la casa, questa vincerà sempre il test di profondità e si sovrapporrà al cielo perfettamente.

---

## Passo 3: Nel Vertex Shader – Trovare la Direzione dello Sguardo

Per fare un gradiente che sfuma dall'orizzonte allo zenith (il punto più alto del cielo), il Fragment Shader ha bisogno di sapere in che direzione sta guardando quel pixel.

* **Tip Teorico:** Nel Vertex Shader del cielo, prendi la coordinata locale del vertice e passala al Fragment Shader tramite una variabile `varying` (o `out` se usi WebGL 2), chiamiamola ad esempio `vViewDir`.
* Se usi un cubo centrato sulla telecamera, la posizione stessa del vertice (es. `aPosition.xyz`) rappresenta la direzione del raggio visivo che esce dagli occhi dell'osservatore e va verso l'infinito.

---

## Passo 4: Nel Fragment Shader – Calcolare il Gradiente

Qui avviene la magia matematica. Ricevi `vViewDir` dal Vertex Shader (ricordati di fare `normalize(vViewDir)` nel fragment, perché le interpolazioni alterano la lunghezza dei vettori!).

* **L'uso della componente Y:** La componente `y` del tuo vettore direzione normalizzato ti dice quanto in alto si trova quel pixel. Varierà da `0.0` (perfettamente sull'orizzonte) a `1.0` (perfettamente sopra la testa del personaggio).
* **La funzione magica `mix()`:** In GLSL, `mix(coloreA, coloreB, fattore)` esegue un'interpolazione lineare. Se usi la `y` della direzione dello sguardo come `fattore`, otterrai una sfumatura perfetta:
* Quando $Y = 0 \rightarrow$ vedi solo il `coloreA` (Orizzonte).
* Quando $Y = 1 \rightarrow$ vedi solo il `coloreB` (Zenith).


* **Tip per la curvatura:** Se vuoi che il gradiente si concentri molto vicino all'orizzonte e diventi subito blu in alto (effetto atmosfera terrestre), puoi alterare il fattore usando funzioni come `pow(factor, esponente)` o `clamp()`.

---

## Passo 5: Sincronizzare Nebbia e Orizzonte (Il tocco finale)

Come accennavamo, l'illusione ottica di un mondo infinito si compie quando la fine del mondo si fonde con l'inizio del cielo.

* **Tip Teorico:** Prendi il `coloreA` (quello che hai scelto per l'orizzonte nel tuo Sky Shader) e passalo come parametro `uniform` alla nebbia del terreno e degli alberi (`uFogColor`). Quando gli alberi in fondo alla mappa sfumeranno nella nebbia, diventeranno dello stesso identico pixel dell'orizzonte, scomparendo nel nulla in modo magico e fotorealistico.

Da quale di questi passi vuoi iniziare a buttare giù la struttura? Se vuoi, possiamo analizzare la logica del Vertex Shader per capire come passare la direzione dello sguardo!

- [ ] Disegna le stradine. Le strade sono perfette per imparare a costruire geometrie secondarie sopra il terreno: strip, plane sottili, decal o mesh dedicate. Qui impari bene come appoggiare oggetti su un terreno già esistente e come farli seguire la curvatura del mondo se passi al cilindro.
- [ ] Implementa il mare e i laghetti come superfici dedicate. Prima versiona semplice, poi versione più bella. In pratica: prima una mesh piatta o leggermente curva con colore/texture blu, poi riflessioni, trasparenza o rifrazione se vuoi fare un passo in più. Questo ti insegna bene blending, depth test e ordine di rendering. Se vuoi un riferimento di ordine di rendering, nel repository hai esempi storici di gestione scena e camera in HTML5_webgl_4/webgl2_transparency.html.
- [ ] Sistema illuminazione e sole. Dopo la geometria, lavora sulla luce: direzionale per il sole, ambiente per non avere ombre troppo dure, e magari una variazione del sole nel tempo. Questo ti fa capire il cuore del rendering 3D: normali, prodotti scalari, base color e risposta materiale. Nel tuo progetto hai già la gestione della luce nel loop di rendering in main.js e il renderer espone i uniform giusti in renderer.js.
- [ ] Migliora le collisioni in base alle nuove zone. Quando aggiungi strade, acqua, sabbia e laghetti, non basta più il collider generico del mondo. Ti conviene introdurre regole diverse: aree non attraversabili, aree con attrito diverso, zone dove il player rallenta o non può entrare. La logica attuale in player.js è già un buon punto di partenza.
- [ ] Organizza il world building in modo data-driven. Quando il mondo cresce, smetti di piazzare tutto “a mano” in main.js e passa a una struttura dati per props, zone, collider e materiali. Questo ti farà capire meglio il rapporto tra scene graph, rendering e gameplay. È il passo che trasforma il progetto da demo a piccolo engine.
- [ ] Solo alla fine fai polish visivo e tecnico. Qui entrano cielo, nuvole, gradiente, post-processing leggero, mini mappa più bella, animazioni del sole e magari acqua animata. Questo è il livello in cui il progetto comincia a sembrare un mondo, ma conviene arrivarci solo dopo che geometria, camera, luce e collisioni sono solidi.