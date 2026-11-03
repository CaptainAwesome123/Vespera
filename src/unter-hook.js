/* V61: Räume unter der Stadt (Verstecke der Anarchisten, src/verstecke.js).
   Ein kleiner Haken ohne Abhängigkeiten, damit player.js (Boden, Landung), driving.js (groundAt für Leute,
   Puppen und lose Dinge) und performance.js (Innenraum: kein Schnee, kein Mond) ihn ohne Kreis-Importe fragen können.
   test(p): steht der Punkt in einem Raum unter der Stadt?  ground(x, z, y): Boden dort (wie groundAt) oder null. */
export const UNTER = { test: null, ground: null };
