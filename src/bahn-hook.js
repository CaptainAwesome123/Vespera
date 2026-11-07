/* V63: Zustand der Bahn (src/bahn.js) ohne Abhängigkeiten, damit main.js (Bau), performance.js (jedes Bild, Kamera, Sitzen),
   audio.js (Fahrgeräusch) und karte.js (Linien, Haltestellen, Schnellfahrt) ihn ohne Kreis-Importe lesen können.
   bahn.js füllt die Felder und die Funktionen (build, update, obstacles, seatInput, seatModel, camera, travelTo, sideAt). */
export const BAHN = {
  built: false, lines: [], tracks: [], stations: [], veh: [], cars: [], pool: { tram: [], hoch: [] },
  ride: null, sit: null, cam: 'innen', fare: 1, rides: 0, travel: null, keepOut: [],
  crowd: null, ag: [], t: 0, bellT: 0,
  build: null, update: null, obstacles: null, seatInput: null, seatModel: null, camera: null, travelTo: null, sideAt: null,
};
