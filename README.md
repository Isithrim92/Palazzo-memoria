# Palazzo della memoria (versione 2)

Ambiente 3D per provare il metodo dei *loci*: ogni concetto da ricordare è legato a un oggetto in un luogo di un percorso. Funziona nel browser del computer (mouse e tastiera) e del telefono (tocco). Il visore per ora non è previsto.

**Stato:** prototipo di prova. Il contenuto (5 tappe sulle fasi dello studio) è un esempio e si cambia dall'app. Non raccoglie dati e non li invia a nessuno: tutto resta sul dispositivo. Non ha valore clinico e non va presentato come tale.

## Cosa c'è di nuovo rispetto alla versione 1
- **Un vero percorso** sull'Isola dei pirati, con 5 luoghi diversi tra loro: molo all'alba, spiaggia di mattina, collina nel pomeriggio, porto al tramonto, grotta. Ogni luogo ha cielo, luce e punti di riferimento propri.
- **Camminata libera** lungo il percorso (non si può uscire dall'isola) e tappe consigliate: il pulsante "Portami lì" ti accompagna.
- **Menu sempre a portata di mano**, con conferma prima di tornare al menu.
- **Personalizza le tappe** direttamente nell'app, prima di iniziare o durante l'esplorazione.
- **Soprannome facoltativo** (mai nome e cognome), salvato solo sul dispositivo.
- **Mouse invertibile** (sinistra/destra e su/giù) dalle Impostazioni.
- **Feedback sulla prestazione**, non sulla persona: ti dice quante tappe hai richiamato e quali rinforzare.

## Come si usa
- **Percorso**: cammini fino a ogni oggetto, leggi concetto e immagine da collegare, poi "Avanti".
- **Richiamo**: arrivi a ogni oggetto, provi a ricordare, premi "Mostra" e ti autovaluti ("Ricordato" / "Non ricordato"). Alla fine il menu mostra il risultato.
- **Guardarsi intorno**: trascina il mouse (o il dito).
- **Camminare**: tasti W A S D o frecce (su/giù per avanzare, destra/sinistra per girare). Sul telefono usa il cerchio a sinistra.
- **Menu**: il pulsante in alto a sinistra (o il tasto Esc). Chiede conferma.
- **Modifica questa tappa**: il pulsante in alto a destra.

## Come cambiare le tappe (non serve nessun programma)
1. Dal menu premi **Personalizza le tappe** (oppure, durante l'esplorazione, **Modifica questa tappa**).
2. Per ogni tappa scrivi: il concetto da ricordare, una spiegazione breve (facoltativa), l'immagine strana o vivida che colleghi all'oggetto. Scegli forma e colore dell'oggetto.
3. Premi **Salva**. Le modifiche restano su questo dispositivo e su questo browser. Se apri l'indirizzo da un altro telefono o computer, vedrai di nuovo l'esempio.
4. **Ripristina l'esempio** rimette i contenuti di partenza (ma non salva finché non premi Salva).

## Come pubblicarlo (GitHub + Vercel, senza installare nulla)
**Attenzione:** questa versione carica file di modelli 3D, quindi **non funziona aprendo `index.html` con il doppio clic**. Va aperta da un indirizzo web, come descritto qui sotto.

1. Su github.com apri il repository `palazzo-memoria` (se non esiste: **New repository**, nome `palazzo-memoria`, Public, senza README, **Create repository**).
2. Nella pagina del repository: **Add file > Upload files**. Trascina **tutto il contenuto** della cartella (`index.html`, `README.md`, `CREDITS.txt` e le cartelle `js`, `vendor`, `assets`) e premi **Commit changes**. I file sono meno di 100, quindi il caricamento dal sito va bene. Se esistono già file con lo stesso nome (versione 1), vengono sostituiti.
3. Su vercel.com: **Add New > Project**, scegli `palazzo-memoria` e premi **Deploy**, senza cambiare impostazioni. Se il progetto c'era già, Vercel ripubblica da solo dopo il caricamento.
4. Apri l'indirizzo `palazzo-memoria.vercel.app` (o quello che ti dà Vercel) dal telefono e dal computer.

## Cosa guardare nella prova (valutazione ex post)
- Sul telefono: la camminata è fluida? Il cerchio si usa bene? I testi si leggono?
- Il caricamento iniziale (circa 4 MB) è accettabile con la tua connessione?
- La direzione del mouse è quella che preferisci? (Impostazioni.)
- I luoghi si distinguono davvero uno dall'altro? Il percorso aiuta a ricordare la sequenza?
- Le frasi di feedback sono utili e non sembrano giudicare la persona?

## Prima di usarlo con altre persone
- **Minorenni:** consenso di chi esercita la responsabilità genitoriale. Il soprannome è facoltativo e l'app non chiede dati personali.
- **Pubblicità:** descrivere il prototipo come strumento didattico, senza promesse di risultato (Codice deontologico, art. 5 e 40).
- **Efficacia:** l'idea dei loci è nota, ma l'efficacia di *questo* ambiente non è stata verificata. Va cercata una fonte per ogni affermazione che metterai nei testi.

## Struttura dei file
- `index.html`: pagina, menu, pannello, editor.
- `js/content.js`: contenuto di esempio (valori di partenza).
- `js/world.js`: mondo 3D (percorso, terreno, cieli, scenografia, oggetti delle tappe).
- `js/app.js`: movimento, modi (Percorso e Richiamo), salvataggio locale.
- `assets/`: modelli 3D (Kenney e Poly Haven, licenza CC0). `CREDITS.txt` elenca le fonti.
- `vendor/`: libreria A-Frame 1.6.0 (licenza MIT).

## Idee parcheggiate (non ancora fatte)
- Pulsante di teletrasporto con l'elenco dei nomi degli oggetti, per saltare a una tappa.
- Percorso più lungo (più di 5 tappe) e eventuali scorciatoie.
- Visore (quando lo avrai).
