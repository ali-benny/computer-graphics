# Wiki progetto WebGL

Questo file documenta lo stato attuale del progetto in modo aderente al codice.
L'obiettivo e` avere una guida locale da aggiornare man mano che il progetto cresce,
cosi` da poter capire rapidamente come funziona ogni pezzo senza dover rileggere tutti i file.

## Obiettivo del progetto

Il progetto attuale implementa una piccola scena 3D in WebGL con:

- terreno centrale a forma di disco;
- casa importata da OBJ;
- personaggio controllabile;
- alberi istanziati;
- camera in terza persona con follow;
- collisioni base contro casa, alberi e confini del mondo;
- luce dinamica, fog e curvatura cilindrica nel vertex shader;
- HUD 2D con minimappa e controlli touch/mobile.

Il punto di partenza principale e` [progetto/main.js](progetto/main.js), che orchestra caricamento risorse, costruzione scena e render loop.

## Struttura dei file

### [progetto/main.js](progetto/main.js)

E` il file che mette insieme tutto:

- carica modelli e texture;
- costruisce la scena;
- crea player, camera e HUD;
- aggiorna il frame ad ogni `requestAnimationFrame`;
- invia uniform e draw call a WebGL.

### [progetto/renderer.js](progetto/renderer.js)

Gestisce l'inizializzazione WebGL e le uniform globali:

- crea il contesto `webgl`;
- compila e linka gli shader;
- abilita `DEPTH_TEST`;
- gestisce resize canvas;
- espone la funzione `render(...)` per disegnare una lista di oggetti.

### [progetto/shaderUtils.js](progetto/shaderUtils.js)

Contiene:

- shader vertex e fragment;
- creazione shader e program;
- creazione mesh/buffer;
- binding degli attributi;
- draw normale e draw instanziato;
- caricamento texture.

### [progetto/geometry.js](progetto/geometry.js)

Genera geometrie base:

- `createPlane(width, depth)`;
- `createCube(size)`;
- `createDisc(radius, radialSegments, ringSegments)`.

### [progetto/objLoader.js](progetto/objLoader.js)

Parsing dei file OBJ e calcolo bounds:

- `parseOBJ(objText)`;
- `computeBounds(positions)`;
- `loadOBJ(url)`.

### [progetto/math.js](progetto/math.js)

Piccola libreria matematica interna:

- vettori 3D;
- matrici 4x4;
- `mat4LookAt`;
- `mat4Perspective`;
- trasformazioni `translate`, `scale`, `rotateY`, `rotateX`.

### [progetto/camera.js](progetto/camera.js)

Camera con piu` modalita`:

- `free` per movimento FPS;
- `follow` per terza persona classica;
- `rolling-follow` per la camera alta usata ora.

### [progetto/player.js](progetto/player.js)

Controller del personaggio:

- legge input da tastiera o touch;
- calcola direzione di movimento relativa alla camera;
- applica accelerazione, attrito e velocita` massima;
- risolve collisioni contro collider semplici.

### [progetto/gameObject.js](progetto/gameObject.js)

Wrapper comodo per oggetti renderizzabili:

- contiene mesh, texture e colore;
- mantiene la `modelMatrix`;
- sa disegnarsi da solo con `render(...)`.

### [progetto/hudCanvas.js](progetto/hudCanvas.js)

Canvas 2D separato per HUD:

- minimappa circolare;
- marker del player;
- marker degli alberi;
- coordinate player/camera.

## Flusso generale dell'app

Il flusso parte da `main()` in [progetto/main.js](progetto/main.js):

1. crea il canvas principale con `createCanvas()`;
2. crea il `Renderer`;
3. carica OBJ e texture con `Promise.all(...)`;
4. costruisce la scena base;
5. inizializza player, camera e HUD;
6. avvia il loop `animate(nowMs)`;
7. ad ogni frame aggiorna input, collisioni, camera e disegno.

## Stato attuale della scena

### Modelli caricati

In [progetto/main.js](progetto/main.js) sono definiti questi percorsi:

- `char` da `obj/animal-crossing-character/source/char.obj`;
- `house` da `obj/animal-crossing-house/source/house.obj`;
- `tree` da `obj/animal-crossing-pine-tree/source/base.obj`.

Le texture sono caricate separatamente per:

- casa: muri/tetto e porta/finestre;
- personaggio;
- albero;
- cartello/foto personale.

### Geometrie costruite a mano

Oltre ai modelli OBJ, il progetto costruisce manualmente:

- disco del terreno con `createDisc(86, 96, 28)`;
- cartello foto con `createPhotoBoardGeometry(1.2, 1.6)`;
- palo e cornice del cartello con `createCube(1)`;
- eventualmente altri oggetti base tramite le funzioni di `geometry.js`.

### Oggetti di scena attuali

La scena contiene:

- terreno principale;
- casa al centro;
- personaggio giocabile;
- cartello con foto;
- 20 alberi istanziati in modo casuale attorno al centro.

## Come sono costruite le trasformazioni

### `buildModelMatrix(bounds, options)`

Questa funzione e` importante per capire come vengono piazzati i modelli 3D.

Fa tre cose:

- ricava una scala uniforme dai bounds del modello;
- applica una eventuale `scaleMul`;
- trasla il modello in posizione e, se richiesto, lo appoggia a terra.

In pratica viene usata per:

- casa;
- personaggio;
- alberi.

La funzione usa `computeBounds(...)` di [progetto/objLoader.js](progetto/objLoader.js) per ricavare centro, min, max e scala normale del modello.

### `composeSignPart(...)`

Serve per assemblare le parti del cartello della foto.
Prende una matrice base e aggiunge una traslazione locale + scala locale.

## Camera

La camera e` definita in [progetto/camera.js](progetto/camera.js).

### Modalita` disponibili

- `free`: stile FPS, controllata da WASD e mouse;
- `follow`: camera dietro il player, con altezza e distanza fisse;
- `rolling-follow`: camera alta e inclinata, usata nel progetto attuale.

### Stato attuale della camera

In [progetto/main.js](progetto/main.js) la camera viene configurata cosi`:

- `camera.mode = "rolling-follow"`;
- `camera.followTarget = player`;
- `camera.yaw = 0`;
- `camera.rollingBackDistance = 6.6`;
- `camera.rollingHeight = 6.4`;
- `camera.rollingLookAhead = 1.2`;
- `camera.smoothing = 0.12`;

Questo significa che la camera segue il player dall'alto, con un leggero anticipo sul movimento.

### Input camera

La camera ascolta input mouse e tastiera in `setupInput()`:

- click sul canvas per pointer lock;
- `mousemove` per ruotare la visuale in modalita` free/follow;
- `look(dx, dy, sensitivity)` per input da mouse o touch.

In `rolling-follow` il metodo `look(...)` viene disabilitato, quindi la camera resta piu` stabile.

## Player

Il personaggio e` gestito da [progetto/player.js](progetto/player.js).

### Dati principali

- `position`: posizione X/Y/Z;
- `yaw`: rotazione orizzontale;
- `velocity`: velocita` corrente;
- `radius`: raggio del collisore cilindrico;
- `maxSpeed`: velocita` massima;
- `acceleration`: accelerazione;
- `friction`: attrito quando non si muove.

### Movimento

Il metodo `update(deltaTime, inputActions, colliders, cameraForward, cameraRight)` fa:

1. legge gli input;
2. calcola la direzione di movimento relativa alla camera;
3. accelera il player;
4. applica attrito se non ci sono input;
5. limita la velocita` massima;
6. aggiorna `yaw` se il player si sta muovendo;
7. prova una nuova posizione;
8. risolve le collisioni;
9. salva la posizione finale.

### Collisioni supportate

Il controller supporta questi tipi:

- `cylinder`;
- `aabb`;
- `bounds`;
- `boundsCircle`.

Le funzioni interne sono:

- `resolveCylinderCollision(...)` per alberi/ostacoli tondi;
- `resolveAABBCollision(...)` per casa o recinti;
- `resolveBoundsCollision(...)` per limiti rettangolari;
- `resolveBoundsCircleCollision(...)` per il mini-mondo circolare.

## Rendering

Il render passa attraverso [progetto/renderer.js](progetto/renderer.js) e [progetto/shaderUtils.js](progetto/shaderUtils.js).

### Inizializzazione WebGL

Il renderer:

- prende `canvas.getContext("webgl")`;
- richiede `OES_element_index_uint`;
- crea il program dagli shader;
- recupera le uniform principali;
- abilita `DEPTH_TEST`.

### Uniform principali

Le uniform attualmente usate sono:

- `uModelMatrix`;
- `uView`;
- `uProjection`;
- `uLightDir`;
- `uBaseColor`;
- `uCameraPos`;
- `uTexture`;
- `uUseTexture`;
- `uInvertUVY`;
- `uEnableFog`;
- `uFogColor`;
- `uFogNear`;
- `uFogFar`;
- `uCurvatureStrength`;
- `uCurvatureOrigin`;
- `uUseInstancing`;

### Vertex shader

Nel vertex shader ci sono tre aspetti importanti:

1. supporto all'instancing tramite 4 attributi `vec4` che costruiscono una matrice per istanza;
2. deformazione cilindrica del terreno con `uCurvatureStrength` e `uCurvatureOrigin`;
3. passaggio a fragment shader di normali, posizione in world space e UV.

La curvatura e` applicata cosi`:

```glsl
vec2 deltaXZ = worldPos.xz - uCurvatureOrigin;
float dist = length(deltaXZ);
worldPos.y -= dist * dist * uCurvatureStrength;
```

### Fragment shader

Il fragment shader fa:

- lettura colore base o texture;
- illuminazione ambient + diffusa + specular;
- fog opzionale;
- output finale con alpha pieno.

### Mesh e draw

`createMesh(gl, geometry)` crea:

- buffer posizioni;
- buffer normali;
- buffer UV;
- buffer indici.

`setMeshAttributes(...)` collega gli attributi `aPosition`, `aNormal`, `aUV`.

`drawMesh(...)` usa `gl.drawElements` con `UNSIGNED_INT`.

`drawMeshInstanced(...)` usa `ANGLE_instanced_arrays` per disegnare gli alberi.

## Scene composition in main.js

### Ground

Il terreno e` un disco grande e viene aggiunto come primo oggetto della lista `objects`.

### Casa

La casa viene caricata da OBJ e divisa in mesh separate per materiale tramite `materialGroups`.
Se il modello non contiene gruppi materiali, viene usata una mesh unica.

### Alberi

Gli alberi sono gestiti in modo speciale:

- vengono generati `TREE_COUNT = 20` alberi;
- ogni albero ha una matrice diversa;
- le matrici sono memorizzate in `treeMatrices`;
- il rendering avviene in un'unica draw call instanziata.

Per le collisioni, per ogni albero viene creato un collider cilindrico approssimato in `treeColliders`.

### Player

Il player e' reso con un `GameObject` separato, ma la sua `modelMatrix` viene aggiornata ad ogni frame in base allo stato del `PlayerController`.

## Input e controlli

### Desktop

In `createControlPanel(...)` vengono gestiti:

- `WASD` per movimento;
- click sul canvas per pointer lock;
- mouse look quando la camera lo permette.

### Mobile

L'interfaccia mobile contiene:

- pad sinistro per il movimento;
- pad destro per il look;
- supporto touch direttamente sul canvas.

### Stato input

L'oggetto `inputActions` tiene quattro flag:

- `moveForward`;
- `moveBackward`;
- `moveLeft`;
- `moveRight`.

Questo stato viene passato al player ad ogni frame.

## HUD

Il file [progetto/hudCanvas.js](progetto/hudCanvas.js) crea una minimappa separata dal canvas WebGL.

### Cosa mostra

- cerchio del mondo;
- alberi come punti verdi;
- player come triangolo giallo;
- coordinate testuali player/camera.

### Nota tecnica

La minimappa usa un canvas 2D indipendente e viene posizionata con `position: fixed`.

## Stato delle impostazioni visive

Nel progetto ci sono gia` alcuni controlli per debug e tuning:

- toggle della luce orbitante;
- toggle del fog;
- slider per `fogNear`;
- slider per `fogFar`.

I valori iniziali dello stato sono:

- `rotateLight: false`;
- `enableFog: true`;
- `fogNear: 9`;
- `fogFar: 23`.

## Punti forti attuali

- architettura divisa in moduli piccoli;
- modello di rendering chiaro;
- supporto texture e OBJ;
- camera in terza persona funzionante;
- collisioni separate per tipi diversi di collider;
- instancing degli alberi gia` presente;
- HUD separato dal rendering 3D.

## Limiti attuali / cose da migliorare

Questi sono i punti che oggi restano piu` sperimentali o incompleti:

- le proporzioni dei modelli dipendono ancora molto da fattori empirici;
- il mondo e` ancora abbastanza piccolo e molto centrale;
- la curvatura del mondo e` solo visiva, non completamente integrata con tutto il gameplay;
- il cielo non e` un vero skybox o dome;
- l'acqua e i laghetti non hanno ancora una rappresentazione dedicata;
- le strade e le zone di materiale diverso non sono ancora organizzate come sistema formale;
- le collisioni sono semplici e basate su approssimazioni geometriche.

## Regole mentali utili mentre lavori

- Se devi piazzare un oggetto 3D, prima calcola i bounds e poi applica la scala.
- Se un oggetto deve essere interattivo, separa sempre mesh, matrice e collider.
- Se una feature richiede piu` oggetti uguali, valuta subito l'instancing.
- Se una feature cambia il terreno o la visione globale, decidi prima se e` solo grafica o anche gameplay.
- Se una cosa ti sembra "troppo grossa", spezzala in geometria, rendering, collisione e UI.

## Prossime sezioni che posso aggiungere

Questo file e` pensato per crescere. Le sezioni piu` naturali da aggiungere dopo sono:

- mappa completa della scena;
- lista dei collider con disegno e coordinate;
- schema delle texture;
- note sul sistema di illuminazione;
- TODO tecnici ordinati per priorita`;
- spiegazione dettagliata di `renderer.js` e degli shader;
- documentazione del formato OBJ usato dal progetto.

