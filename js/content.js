/*
  CONTENUTO DI ESEMPIO DEL PALAZZO DELLA MEMORIA
  ----------------------------------------------
  Le 5 tappe possono essere cambiate direttamente nell'app, con "Personalizza le tappe":
  non serve toccare questo file. Qui ci sono solo i valori di partenza.

  Ogni tappa ha:
    title : il concetto da ricordare
    note  : una riga di spiegazione
    image : l'immagine strana o vivida che colleghi al concetto (e all'oggetto nel luogo)
    shape : oggetto: box | cone | torus | torusknot | octahedron | sphere | cylinder | m:cannonball | m:chest | m:compass | m:bottle | m:flag | m:cannon | m:barrel | m:lantern | m:flame | m:key | m:coin | m:potion | m:pot
    color : colore dell'oggetto (esadecimale)
*/
window.PALAZZO_CONTENT = {
  title: "Palazzo della memoria",
  items: [
    {
      title: "Organizzazione",
      note: "Decidere cosa studiare, quando e quanto.",
      image: "un'agenda gialla gigante",
      shape: "box",
      color: "#f4b942"
    },
    {
      title: "Comprensione ed elaborazione",
      note: "Capire il testo e rielaborarlo con parole proprie.",
      image: "un nodo azzurro che si scioglie da solo",
      shape: "torusknot",
      color: "#4ecdc4"
    },
    {
      title: "Memorizzazione",
      note: "Fissare le informazioni con tecniche adatte.",
      image: "un faro rosso che illumina un archivio",
      shape: "cone",
      color: "#ff6b6b"
    },
    {
      title: "Ripasso",
      note: "Tornare sui contenuti a intervalli distanziati.",
      image: "una ruota viola che gira e ritorna al punto di partenza",
      shape: "torus",
      color: "#a78bfa"
    },
    {
      title: "Convinzioni e attenzione",
      note: "Cosa pensi di te come studente e quanto riesci a restare concentrato.",
      image: "una lente verde che mette a fuoco",
      shape: "octahedron",
      color: "#7bd88f"
    }
  ]
};
