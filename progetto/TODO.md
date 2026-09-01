- [x] skybox come un cielo con gradiente più scuro in alto e più chiaro in basso
- [ ] aggiungere nuvolette che si spostano
- [x] in base al momento della giornata cambiano il colore dei gradienti in modo sfumato

- [ ] spiaggia

- [ ] fiume con ponticello

- [x] spostare la luce in alto
- [ ] mettere ombre a tutti gli oggetti in scena

---
**Requisiti soddisfatti**

- WebGL e GLSL: presenti in `renderer.js:16-58` e `shaderUtils.js:1-166`.
- Proiezione prospettica: `mat4Perspective` viene usata nel renderer.
- Modelli OBJ: personaggio, casa e alberi caricati in `main.js:1-23`.
- Illuminazione e shading: luce direzionale, ambiente, diffusa e speculare in `shaderUtils.js:54-119`.
- Texture mapping: casa, personaggio, alberi, terreno e bacheca fotografica hanno texture in `main.js:17-23` e `main.js:230-310`.
- Foto dell’autrice: presente `textures/mia-foto.jpg`, usata sulla bacheca.
- Pannello 2D: `dat.GUI` con luce, intensità, preset temporali e fog in `main.js:73-147`.
- Animazione: la luce può ruotare quando `rotateLight` è attivo e gli alberi hanno dissolvenza dinamica in `main.js:420-458`.
- Rendering avanzato: trasparenza, alpha cutout e gestione separata di alberi opachi/trasparenti in `renderer.js:150-220`.
- Collisioni e movimento: implementati in `player.js:1-191`.
- Minimap HUD: presente in `hudCanvas.js:1-101`.

**Mancanze o punti a rischio**

1. **Supporto touch non realmente implementato**

   Questo è il problema più evidente rispetto alle FAQ. Nel progetto risultano soltanto:

   - `touch-action: none` in `index.html:15-19`;
   - gestione tastiera in `main.js:149-180`;
   - pointer lock e mouse move in `camera.js:55-73`.

   Non risultano `touchstart`, `touchmove`, `touchend`, `PointerEvent` per il movimento o joystick virtuali. Quindi su mobile il player non può essere controllato tramite dita. La minimappa inoltre ha `pointerEvents = 'auto'`, ma non implementa controlli.

   Da fare: aggiungere almeno un controllo touch per il movimento e, se necessario, uno swipe o un secondo controllo per la visuale.

2. **Mouse look disabilitato nella modalità corrente**

   La camera è configurata come `rolling-follow` in `main.js:383-392`, ma `look()` ritorna immediatamente in questa modalità in `camera.js:42-52`. Di conseguenza il mouse abilita il pointer lock, ma non modifica la visuale.

   Questo può essere considerato insufficiente per il requisito “tastiera e mouse”. Serve una di queste soluzioni:

   - permettere al mouse di modificare lo yaw nella modalità `rolling-follow`;
   - usare la modalità `follow`;
   - usare il mouse per un’altra interazione 3D significativa.

3. **Animazione dell’oggetto 3D da rendere più sicura**

   La rotazione della luce è animata, ma la luce non è propriamente un oggetto 3D visibile. La dissolvenza degli alberi dipende dalla distanza dalla camera e dal movimento del player.

   Per evitare dubbi in sede d’esame, sarebbe meglio aggiungere un’animazione evidente e autonoma a un oggetto 3D, ad esempio:

   - rotazione della bacheca;
   - oscillazione del personaggio o di un elemento decorativo;
   - movimento delle nuvole;
   - rotazione di un albero o di un oggetto della scena.

4. **Tecnica avanzata non attivabile/disattivabile dal menu**

   La trasparenza è implementata, ma non esiste un controllo `dat.GUI` per abilitarla o disabilitarla. Poiché la specifica descrive l’advanced rendering come opzionale, non è una mancanza obbligatoria; tuttavia, se vuoi presentarla come tecnica avanzata, conviene aggiungere un toggle, ad esempio `enableTransparency`.

5. **Verifica Linux/Mac ancora da fare**

   La FAQ richiede di controllare il progetto in un ambiente Linux o Mac. Il codice usa correttamente `drawElements` con `indexCount` e `UNSIGNED_INT` in `shaderUtils.js:260-268`, ma richiede l’estensione `OES_element_index_uint` in `renderer.js:21-25`.

   Prima della consegna devi verificare:

   - assenza di errori WebGL nella console;
   - caricamento di tutti gli OBJ e delle texture;
   - funzionamento della skybox;
   - funzionamento su Chrome/Linux;
   - nessun errore “out of range vertices”;
   - presenza dell’estensione `OES_element_index_uint` e `ANGLE_instanced_arrays`.

6. **Struttura dell’archivio di consegna mancante**

   La specifica richiede un archivio con:

   ```text
   project/
   doc/
   ```

   Attualmente la cartella contiene direttamente il codice e non è presente una cartella `doc` con una relazione HTML. Questo è un requisito di consegna ancora da completare.

7. **Documentazione della provenienza degli asset**

   Le FAQ permettono mesh scaricate da Internet, ma raccomandano l’uso di Blender per modifiche, semplificazione o UV mapping. Non è un requisito tecnico obbligatorio, ma nella relazione dovresti indicare:

   - origine dei modelli OBJ;
   - origine delle texture;
   - eventuali modifiche fatte;
   - uso o non uso di Blender;
   - presenza della foto personale.

**Priorità consigliata**

1. Implementare i controlli touch.
2. Rendere effettivo il mouse look nella modalità corrente.
3. Aggiungere un’animazione visibile di un oggetto 3D.
4. Aggiungere un toggle per la trasparenza.
5. Preparare `doc/relazione.html` e l’archivio `project/`.
6. Testare tutto su Chrome/Linux, come richiesto esplicitamente dalle FAQ.

Created 3 todos