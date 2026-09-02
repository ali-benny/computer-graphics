
Fondamenti di Computer Graphics (C.d.S. Magistrale in Ingegneria Informatica)
Computer Grapics (C.d.S. Magistrale in Informatica)
Fondamenti di Computer Graphics (C.d.S. Magistrale in Matematica)
Progetto A.A.2025/26 assegnato il 09/04/2026
Obiettivo
Sviluppare una "3D-WebApp" usando WebGL (HTML5, CSS e contesto webgl o webgl2), linguaggi JavaScript e GLSL, su browser Chrome.
Il progetto d'esame è individuale
Si può lavorare insieme nella fase di progettazione, ma non dalla fase di sviluppo in avanti.
Testo
Si progetti ed implementi un'applicazione 3D interattiva composta da almeno un oggetto principale di tipo mesh poligonale caricato da file (formato OBJ Wavefront). Si definisca un'opportuna scenografia con almeno un oggetto in animazione, illuminando e texturando gli oggetti della scena. Sono banditi i videogioco/applicazioni denominati ''sparatutto'' e ''labirinti''.
Richieste grafiche obbligatorie
geometria 3D visualizzata in proiezione prospettica;
almeno un oggetto 3D deve essere animato;
input utente (si gestisca l'interazione 3D usando sia la tastiera che il mouse e opzionalmente un gamepad);
illuminazione e sfumatura (gli oggetti 3D devono essere illuminati da almeno una luce);
texture mapping (almeno due oggetti 3D devono avere una texture applicata e almeno una deve essere una foto dell'autore)
pannello di controllo su schermo (si preveda un pannello di controllo in cui usando testo e grafica 2D si visualizzino le opzioni a disposizione dell'utente, ecc.);
si ponga attenzione che il tutto sia fruibile anche da un dispositivo mobile (gestione eventi touch);
advanced rendering (opzionale)(da menu' si preveda l'attivazione/disattivazione di almeno una tecnica di resa avanzata come per esempio: ombre, trasparenze, riflessioni, bump-mapping, ecc.)
Elementi di Giudizio['']
Elementi qualificanti il progetto saranno l'originalità delle scelte (tipo di applicazione, oggetti, scenografia, texture, ecc.) e le funzionalità dal punto di vista grafico del codice realizzato. Si rammenti che il progetto è sulla grafica 3D.
Consegna
Si richiede di consegnare un archivio cognome.zip (file zippato) contenente due cartelle:
la prima si chiami "project" e contenga il codice;
la seconda si chiami "doc" e contenga una relazione in html sul progetto realizzato (descrizione dell'applicazione, spiegazione delle scelte effettuate, funzionalità previste, particolarità, ecc.).
L'archivio contenente il progetto deve essere caricato nella sezione "Consegna Progetto d'Esame" su virtuale.unibo.it almeno 7 giorni prima dell'appello d'esame (2 giorni prima nel caso del preappello) e precisamente entro le ore 9:00; contestualmente si invii un email al docente informandolo del caricamento del progetto e indicando l'appello in cui si vuole sostenere l'esame.
Per la realizzazione del progetto d'esame si stimano necessarie almeno 40 ore di lavoro.
Avvertenza 1
Non è vietato "guardare" codice esistente, anzi si caldeggia di farlo, ma per imparare cose nuove e non per plagiare! Se trovate qualcosa di carino che funziona, ma non capite perché, non lo usate; vi potrebbe essere chiesto di spiegarlo.
Avvertenza 2
Non si possono usare librerie diverse da quelle messe a disposizione durante il corso, mentre si raccomanda di utilizzare tutto quello che è stato messo a disposizione (glm_utils.js per il caricamento di file .obj, mesh_utils.js, webgl-utils.js, m4.js, dat.gui.js).
Avvertenza 3
Eventuali domande sul progetto o richieste di spiegazione verrano pubblicate sulla pagina delle FAQ del progetto, per cui consultarla prima di chiedere spiegazioni al docente. 


# Project Frequently Asked Questions

Sto lavorando in ambiente Linux e mi viene segnalato il seguente errore: gl.drawArrays: attempt to access out of range vertices in attribute 0 e non visualizza nulla; ho provato lo stesso codice anche in ambiente Windows e non solo non segnala alcun errore, ma visualizza tutto correttamente. Come mi devo comportare?

Il problema è noto, e dipende dal fatto che in ambiente Windows tutto è più permissivo. L'errore: gl.drawArrays: attempt to access out of range vertices in attribute 0 spesso indica un errore di programmazione e significa che si è cercato di rendere un buffer che è troppo piccolo rispetto a quanto indicato nella gl.drawArrays.
Ovviamente bisogna trovare e correggere l'errore, anche perché il progetto, una volta consegnato, verrà visionato in ambiente Linux; questo è quindi un alert per chi sviluppa in ambiente Windows!!! Prima di consegnare il progetto provatelo in ambiente Linux o Mac.

Sulla ''fruibilità da tablet o mobile''; questo implica che tutti i movimenti o interazioni da tastiera devono essere possibili anche tramite click del mouse? Che nel caso mobile sarebbero le dita? Questo può essere sufficiente oppure ci sono altre modifiche da fare alle quali non ho pensato?

Per la fruibilità da mobile si intende proprio avere un'attenzione al fatto di prevedere delle alternative ad eventuali funzionalità non gestibili su mobile, e se si usa la tastiera, si preveda un'alternativa su mobile.

E' possibile utilizzare delle mesh scaricate da internet e non fatte da noi. Ne ho trovate alcune molto carine per il progetto, in particolare una per l'oggetto principale, però non ho utilizzato Blender e in più richiede qualche secondo iniziale per caricare il tutto ma poi procede tutto bene.

È sicuramente permesso scaricare delle mesh da internet, ma anche se non specificato nel testo del progetto, mi aspetto che usiate Blender, anche solo per ritoccarle. Se ci mette un po' a caricarle, vuol dire che sono pesanti; magari potrebbe usare Blender per semplificarle, anche se un tempo di caricamento più o meno lungo ce lo si deve sempre aspettare. Un altro utilizzo in cui mi aspetto che tutti usiate Blender è per associare una texture ad una mesh usando gli algoritmi di uv-mapping di Blender. Se non lo deve fare per le mesh che ha trovato, lo potrebbe fare per qualche altra o potrebbe cambiare le texture di una che le ha già ricalcolando le coordinate uv. Come logica, tenga presente che il progetto serve per mettere in campo tutto quello che si è visto nel corso. 