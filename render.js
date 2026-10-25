/* EPC (PanelLabels) — render.js
 * Σχεδίαση ετικετών σε πραγματικά χιλιοστά (canvas) και δημιουργία PDF χωρίς εξωτερικές βιβλιοθήκες.
 * Όλες οι διαστάσεις είναι σε mm. Το s = pixels ανά mm για το συγκεκριμένο render.
 */
'use strict';

const LABEL_FONT = 'Arial, "Helvetica Neue", Helvetica, Roboto, "Segoe UI", sans-serif';
const MM_PER_IN = 25.4;

/* Σύμβολα: d = γραμμή (stroke), f = γεμάτα κομμάτια (fill), σε πλαίσιο 24x24. Πηγή: tests/symbols_source.py */
const SYMBOLS = {
  "main": { name: "Γενικός διακόπτης", d: "M12 2.5v6.3M9.6 8.8h4.8M12 16.2v5.3M12 16.2L7.4 9.6", f: "M10.9 16.2a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0" },
  "mcb": { name: "Ασφάλεια (αυτόματη)", d: "M12 2.5v6.3M10.1 6.9l3.8 3.8M13.9 6.9l-3.8 3.8M12 16.2v5.3M12 16.2L7.4 9.6", f: "M10.9 16.2a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0" },
  "rcd": { name: "Ρελέ διαρροής", d: "M12 2.5v5.3M10.3 6l3.4 3.4M13.7 6l-3.4 3.4M12 14.4v7.1M12 14.4L8 8.6M7.4 18.6a4.6 1.9 0 1 0 9.2 0a4.6 1.9 0 1 0 -9.2 0M16.6 18.6h2.4v-6.8h-2.2M15.4 11.8h-1.4", f: "M10.95 14.4a1.05 1.05 0 1 0 2.1 0a1.05 1.05 0 1 0 -2.1 0M17.6 10.3h3v3h-3z" },
  "surge": { name: "Αντικεραυνική προστασία", d: "M12 2.6l7.6 2.9v5.8c0 5.1-3.3 8.6-7.6 10.2-4.3-1.6-7.6-5.1-7.6-10.2V5.5z", f: "M13.62 6.4L8.9 13.23L12.05 13.23L10.79 17.95L15.83 10.6L12.68 10.6L14.15 6.4z" },
  "subboard": { name: "Υποπίνακας", d: "M5.1 3h13.8a1.6 1.6 0 0 1 1.6 1.6v14.8a1.6 1.6 0 0 1 -1.6 1.6h-13.8a1.6 1.6 0 0 1 -1.6 -1.6v-14.8a1.6 1.6 0 0 1 1.6 -1.6zM3.5 7h17", f: "M5.6 9.2h2.2v4.2h-2.2zM8.7 9.2h2.2v4.2h-2.2zM11.8 9.2h2.2v4.2h-2.2zM14.9 9.2h2.2v4.2h-2.2zM18 9.2h2.2v4.2h-2.2zM5.6 15h2.2v4.2h-2.2zM8.7 15h2.2v4.2h-2.2zM11.8 15h2.2v4.2h-2.2zM14.9 15h2.2v4.2h-2.2zM18 15h2.2v4.2h-2.2zM5.55 5a0.65 0.65 0 1 0 1.3 0a0.65 0.65 0 1 0 -1.3 0" },
  "relay": { name: "Ρελέ / τηλεχειριζόμενος", d: "M6.5 7.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1 -1 1h-11a1 1 0 0 1 -1 -1v-7a1 1 0 0 1 1 -1zM5.5 16.5L18.5 7.5M12 2.5v5M12 16.5v5", f: "M11.1 2.9a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0M11.1 21.1a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0" },
  "switch": { name: "Διακόπτης", d: "M2.5 15.5h4.6M8.6 14.7l8.2-5.2M17.4 15.5h4.1", f: "M6.6 15.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0M16.3 15.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0" },
  "dimmer": { name: "Ροοστάτης", d: "M7.6 12a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M5.4 18.6L7 17M17 7l1.6-1.6", f: "M12 7.6a4.4 4.4 0 0 0 0 8.8z" },
  "ev": { name: "Φορτιστής οχήματος", d: "M5.8 3h6.9a1.8 1.8 0 0 1 1.8 1.8v14.9a1.8 1.8 0 0 1 -1.8 1.8h-6.9a1.8 1.8 0 0 1 -1.8 -1.8v-14.9a1.8 1.8 0 0 1 1.8 -1.8zM4 21.5h10.5M14.5 9.5h2.3a1.6 1.6 0 0 1 1.6 1.6v6.2a1.5 1.5 0 0 0 3 0V7.5M19.9 7.5V5.3M18.9 5.3h2", f: "M11.1 6.5L6.6 13L9.6 13L8.4 17.5L13.2 10.5L10.2 10.5L11.6 6.5z" },
  "light": { name: "Φωτισμός", d: "M12 2.8a6.2 6.2 0 0 0-3.7 11.2c.7.6 1.1 1.4 1.1 2.3v.6h5.2v-.6c0-.9.4-1.7 1.1-2.3A6.2 6.2 0 0 0 12 2.8zM10.6 16.9v-2.4l-1.2-2.6M13.4 16.9v-2.4l1.2-2.6", f: "M10 17.6h4a0.6 0.6 0 0 1 0.6 0.6v0.4a0.6 0.6 0 0 1 -0.6 0.6h-4a0.6 0.6 0 0 1 -0.6 -0.6v-0.4a0.6 0.6 0 0 1 0.6 -0.6zM10.6 19.9h2.8a0.6 0.6 0 0 1 0.6 0.6v0.4a0.6 0.6 0 0 1 -0.6 0.6h-2.8a0.6 0.6 0 0 1 -0.6 -0.6v-0.4a0.6 0.6 0 0 1 0.6 -0.6z" },
  "socket": { name: "Πρίζα", d: "M2.8 12a9.2 9.2 0 1 0 18.4 0a9.2 9.2 0 1 0 -18.4 0M5.7 12a6.3 6.3 0 1 0 12.6 0a6.3 6.3 0 1 0 -12.6 0", f: "M8.05 12a1.15 1.15 0 1 0 2.3 0a1.15 1.15 0 1 0 -2.3 0M13.65 12a1.15 1.15 0 1 0 2.3 0a1.15 1.15 0 1 0 -2.3 0M11.3 5.7h1.4a0.4 0.4 0 0 1 0.4 0.4v0.8a0.4 0.4 0 0 1 -0.4 0.4h-1.4a0.4 0.4 0 0 1 -0.4 -0.4v-0.8a0.4 0.4 0 0 1 0.4 -0.4zM11.3 16.7h1.4a0.4 0.4 0 0 1 0.4 0.4v0.8a0.4 0.4 0 0 1 -0.4 0.4h-1.4a0.4 0.4 0 0 1 -0.4 -0.4v-0.8a0.4 0.4 0 0 1 0.4 -0.4z" },
  "lightsocket": { name: "Φωτισμός / πρίζα", d: "M7.2 2.6a4.2 4.2 0 0 0-2.5 7.6c.5.4.7.9.7 1.5v.3h3.6v-.3c0-.6.3-1.1.7-1.5A4.2 4.2 0 0 0 7.2 2.6zM10.4 15.8a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0 -11.2 0M12.4 15.8a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0 -7.2 0", f: "M5.9 12.7h2.6a0.5 0.5 0 0 1 0.5 0.5v0.3a0.5 0.5 0 0 1 -0.5 0.5h-2.6a0.5 0.5 0 0 1 -0.5 -0.5v-0.3a0.5 0.5 0 0 1 0.5 -0.5zM13.55 15.8a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M16.75 15.8a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0" },
  "cee": { name: "Βιομηχανική πρίζα", d: "M5.4 4.6h13.2a2.4 2.4 0 0 1 2.4 2.4v12.2a2.4 2.4 0 0 1 -2.4 2.4h-13.2a2.4 2.4 0 0 1 -2.4 -2.4v-12.2a2.4 2.4 0 0 1 2.4 -2.4zM6.4 14a5.6 5.6 0 1 0 11.2 0a5.6 5.6 0 1 0 -11.2 0M5.2 4.6V3.4a1 1 0 0 1 1-1h11.6a1 1 0 0 1 1 1v1.2", f: "M11.05 11a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0M8.25 13a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0M13.85 13a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0M9.25 16.4a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0M12.85 16.4a0.95 0.95 0 1 0 1.9 0a0.95 0.95 0 1 0 -1.9 0M10.9 7.6h2.2v1.4h-2.2z" },
  "outdoor": { name: "Εξωτερικός χώρος", d: "M2.8 11.2L12 3.6l9.2 7.6M5.2 9.4v11.3h13.6V9.4M14.2 11.2h3v3h-3z", f: "M8.9 13.4h2.8a0.5 0.5 0 0 1 0.5 0.5v6.3a0.5 0.5 0 0 1 -0.5 0.5h-2.8a0.5 0.5 0 0 1 -0.5 -0.5v-6.3a0.5 0.5 0 0 1 0.5 -0.5z" },
  "tv": { name: "Τηλεόραση", d: "M4.4 4.2h15.2a1.6 1.6 0 0 1 1.6 1.6v9.4a1.6 1.6 0 0 1 -1.6 1.6h-15.2a1.6 1.6 0 0 1 -1.6 -1.6v-9.4a1.6 1.6 0 0 1 1.6 -1.6zM5.2 6h13.6a0.6 0.6 0 0 1 0.6 0.6v7.8a0.6 0.6 0 0 1 -0.6 0.6h-13.6a0.6 0.6 0 0 1 -0.6 -0.6v-7.8a0.6 0.6 0 0 1 0.6 -0.6z", f: "M9.2 19.7h5.6a0.7 0.7 0 0 1 0.7 0.7v0.2a0.7 0.7 0 0 1 -0.7 0.7h-5.6a0.7 0.7 0 0 1 -0.7 -0.7v-0.2a0.7 0.7 0 0 1 0.7 -0.7zM11.2 16.8h1.6v3h-1.6z" },
  "net": { name: "Δίκτυο / router", d: "M5 13.2h14a2 2 0 0 1 2 2v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 1 2 -2zM7 13.2l-1.4-4.2M17 13.2l1.4-4.2M8.8 7.4a4.6 4.6 0 0 1 6.4 0M6.6 5.2a7.8 7.8 0 0 1 10.8 0", f: "M6.15 16.7a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M8.95 16.7a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M11.75 16.7a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M11.1 9.6a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0" },
  "cooker": { name: "Κουζίνα", d: "M3.4 9L5.6 4h12.8l2.2 5zM3.4 9h17.2v12.4H3.4zM7.2 11.8h9.6a1 1 0 0 1 1 1v5.2a1 1 0 0 1 -1 1h-9.6a1 1 0 0 1 -1 -1v-5.2a1 1 0 0 1 1 -1z", f: "M7.3 6.5a2 0.9 0 1 0 4 0a2 0.9 0 1 0 -4 0M12.7 6.5a2 0.9 0 1 0 4 0a2 0.9 0 1 0 -4 0M8.7 13.2h6.6a0.5 0.5 0 0 1 0.5 0.5v0.2a0.5 0.5 0 0 1 -0.5 0.5h-6.6a0.5 0.5 0 0 1 -0.5 -0.5v-0.2a0.5 0.5 0 0 1 0.5 -0.5z" },
  "hob": { name: "Εστίες", d: "M5 2.8h14a2.2 2.2 0 0 1 2.2 2.2v14a2.2 2.2 0 0 1 -2.2 2.2h-14a2.2 2.2 0 0 1 -2.2 -2.2v-14a2.2 2.2 0 0 1 2.2 -2.2zM5.2 8.6a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0M13.8 8.2a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0M5.7 15.6a2.3 2.3 0 1 0 4.6 0a2.3 2.3 0 1 0 -4.6 0M12.4 15.2a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0M2.8 19.2h18.4", f: "M7.1 8.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0M15.25 8.2a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M7.15 15.6a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M14.3 15.2a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0" },
  "oven": { name: "Φούρνος", d: "M5.2 2.8h13.6a1.6 1.6 0 0 1 1.6 1.6v15.4a1.6 1.6 0 0 1 -1.6 1.6h-13.6a1.6 1.6 0 0 1 -1.6 -1.6v-15.4a1.6 1.6 0 0 1 1.6 -1.6zM3.6 7.6h16.8M7.8 10.4h8.4a1.4 1.4 0 0 1 1.4 1.4v5.6a1.4 1.4 0 0 1 -1.4 1.4h-8.4a1.4 1.4 0 0 1 -1.4 -1.4v-5.6a1.4 1.4 0 0 1 1.4 -1.4z", f: "M5.55 5.2a1.05 1.05 0 1 0 2.1 0a1.05 1.05 0 1 0 -2.1 0M8.55 5.2a1.05 1.05 0 1 0 2.1 0a1.05 1.05 0 1 0 -2.1 0M13.9 4.6h3.6a0.5 0.5 0 0 1 0.5 0.5v0.2a0.5 0.5 0 0 1 -0.5 0.5h-3.6a0.5 0.5 0 0 1 -0.5 -0.5v-0.2a0.5 0.5 0 0 1 0.5 -0.5zM8.5 12h7a0.5 0.5 0 0 1 0.5 0.5v0.2a0.5 0.5 0 0 1 -0.5 0.5h-7a0.5 0.5 0 0 1 -0.5 -0.5v-0.2a0.5 0.5 0 0 1 0.5 -0.5z" },
  "microwave": { name: "Φούρνος μικροκυμάτων", d: "M4.2 4.6h15.6a1.8 1.8 0 0 1 1.8 1.8v11.2a1.8 1.8 0 0 1 -1.8 1.8h-15.6a1.8 1.8 0 0 1 -1.8 -1.8v-11.2a1.8 1.8 0 0 1 1.8 -1.8zM5.6 7h8.6a1 1 0 0 1 1 1v8a1 1 0 0 1 -1 1h-8.6a1 1 0 0 1 -1 -1v-8a1 1 0 0 1 1 -1zM16.8 4.6v14.8", f: "M17.9 7h2.2v1.6h-2.2zM17.85 10.6a0.55 0.55 0 1 0 1.1 0a0.55 0.55 0 1 0 -1.1 0M19.05 10.6a0.55 0.55 0 1 0 1.1 0a0.55 0.55 0 1 0 -1.1 0M17.85 12.6a0.55 0.55 0 1 0 1.1 0a0.55 0.55 0 1 0 -1.1 0M19.05 12.6a0.55 0.55 0 1 0 1.1 0a0.55 0.55 0 1 0 -1.1 0M18.5 14.6h1a0.6 0.6 0 0 1 0.6 0.6v1.4a0.6 0.6 0 0 1 -0.6 0.6h-1a0.6 0.6 0 0 1 -0.6 -0.6v-1.4a0.6 0.6 0 0 1 0.6 -0.6z" },
  "steam": { name: "Ατμομάγειρας", d: "M4.2 11.6h15.6v5.8a3.4 3.4 0 0 1-3.4 3.4H7.6a3.4 3.4 0 0 1-3.4-3.4zM4.2 13.4H2.4M19.8 13.4h1.8M5.2 9.8h13.6M8.6 7.8c-.9-.9.9-1.6 0-2.5s.9-1.6 0-2.7M12 7.8c-.9-.9.9-1.6 0-2.5s.9-1.6 0-2.7M15.4 7.8c-.9-.9.9-1.6 0-2.5s.9-1.6 0-2.7", f: "M11.2 8.6h1.6a0.6 0.6 0 0 1 0.6 0.6v0.2a0.6 0.6 0 0 1 -0.6 0.6h-1.6a0.6 0.6 0 0 1 -0.6 -0.6v-0.2a0.6 0.6 0 0 1 0.6 -0.6zM4.2 11.6h15.6v1.6h-15.6z" },
  "hood": { name: "Απορροφητήρας", d: "M9 2.6h6v5.4l6 4.6H3l6-4.6zM3 12.6h18M7.6 21.4c-.9-.9.9-1.6 0-2.5s.9-1.6 0-3.5M12 21.4c-.9-.9.9-1.6 0-2.5s.9-1.6 0-3.5M16.4 21.4c-.9-.9.9-1.6 0-2.5s.9-1.6 0-3.5", f: "M3 11.6h18v2h-18zM7.7 14.6a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M14.9 14.6a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0" },
  "dishwasher": { name: "Πλυντήριο πιάτων", d: "M5.2 2.4h13.6a1.6 1.6 0 0 1 1.6 1.6v16a1.6 1.6 0 0 1 -1.6 1.6h-13.6a1.6 1.6 0 0 1 -1.6 -1.6v-16a1.6 1.6 0 0 1 1.6 -1.6zM3.6 6.6h16.8M5.8 18.8h12.4M16.2 11.2h2.2l-.4 4.2h-1.4z", f: "M5.55 4.5a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M8.05 4.5a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M13.9 3.9h3.6a0.5 0.5 0 0 1 0.5 0.5v0.2a0.5 0.5 0 0 1 -0.5 0.5h-3.6a0.5 0.5 0 0 1 -0.5 -0.5v-0.2a0.5 0.5 0 0 1 0.5 -0.5zM7.05 10.2h0a0.85 0.85 0 0 1 0.85 0.85v6.9a0.85 0.85 0 0 1 -0.85 0.85h-0a0.85 0.85 0 0 1 -0.85 -0.85v-6.9a0.85 0.85 0 0 1 0.85 -0.85zM9.85 9.2h0a0.85 0.85 0 0 1 0.85 0.85v7.9a0.85 0.85 0 0 1 -0.85 0.85h-0a0.85 0.85 0 0 1 -0.85 -0.85v-7.9a0.85 0.85 0 0 1 0.85 -0.85zM12.65 10.2h0a0.85 0.85 0 0 1 0.85 0.85v6.9a0.85 0.85 0 0 1 -0.85 0.85h-0a0.85 0.85 0 0 1 -0.85 -0.85v-6.9a0.85 0.85 0 0 1 0.85 -0.85z" },
  "washer": { name: "Πλυντήριο ρούχων", d: "M5.2 2.4h13.6a1.6 1.6 0 0 1 1.6 1.6v16a1.6 1.6 0 0 1 -1.6 1.6h-13.6a1.6 1.6 0 0 1 -1.6 -1.6v-16a1.6 1.6 0 0 1 1.6 -1.6zM3.6 6.6h16.8M6.7 14a5.3 5.3 0 1 0 10.6 0a5.3 5.3 0 1 0 -10.6 0", f: "M5.55 4.5a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M8.05 4.5a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M13.9 3.9h3.6a0.5 0.5 0 0 1 0.5 0.5v0.2a0.5 0.5 0 0 1 -0.5 0.5h-3.6a0.5 0.5 0 0 1 -0.5 -0.5v-0.2a0.5 0.5 0 0 1 0.5 -0.5zM7.6 14.6c1.4-.9 2.9-.9 4.4 0s3 .9 4.4 0a4.4 4.4 0 0 1-8.8 0z" },
  "dryer": { name: "Στεγνωτήριο", d: "M5.2 2.4h13.6a1.6 1.6 0 0 1 1.6 1.6v16a1.6 1.6 0 0 1 -1.6 1.6h-13.6a1.6 1.6 0 0 1 -1.6 -1.6v-16a1.6 1.6 0 0 1 1.6 -1.6zM3.6 6.6h16.8M9 13c-.9-.9.9-1.6 0-2.5s.9-1.6 0-1.7M12 13c-.9-.9.9-1.6 0-2.5s.9-1.6 0-1.7M15 13c-.9-.9.9-1.6 0-2.5s.9-1.6 0-1.7", f: "M15.45 4.5a1.15 1.15 0 1 0 2.3 0a1.15 1.15 0 1 0 -2.3 0M6.5 3.9h3.6a0.5 0.5 0 0 1 0.5 0.5v0.2a0.5 0.5 0 0 1 -0.5 0.5h-3.6a0.5 0.5 0 0 1 -0.5 -0.5v-0.2a0.5 0.5 0 0 1 0.5 -0.5zM7.4 15.6l2-1.2h1.8l.8.9.8-.9h1.8l2 1.2 1.6 1.6-1.3 1.6-1.1-.8v3.2H8.2V18l-1.1.8-1.3-1.6z" },
  "fridge": { name: "Ψυγείο", d: "M7.4 2.2h9.2a1.8 1.8 0 0 1 1.8 1.8v16a1.8 1.8 0 0 1 -1.8 1.8h-9.2a1.8 1.8 0 0 1 -1.8 -1.8v-16a1.8 1.8 0 0 1 1.8 -1.8zM5.6 9.6h12.8M7.4 21.8v.6M16.6 21.8v.6", f: "M8.6 4.6h0.1a0.6 0.6 0 0 1 0.6 0.6v1.8a0.6 0.6 0 0 1 -0.6 0.6h-0.1a0.6 0.6 0 0 1 -0.6 -0.6v-1.8a0.6 0.6 0 0 1 0.6 -0.6zM8.6 11.8h0.1a0.6 0.6 0 0 1 0.6 0.6v3.4a0.6 0.6 0 0 1 -0.6 0.6h-0.1a0.6 0.6 0 0 1 -0.6 -0.6v-3.4a0.6 0.6 0 0 1 0.6 -0.6z" },
  "freezer": { name: "Καταψύκτης", d: "M6.8 2.2h10.4a1.8 1.8 0 0 1 1.8 1.8v16a1.8 1.8 0 0 1 -1.8 1.8h-10.4a1.8 1.8 0 0 1 -1.8 -1.8v-16a1.8 1.8 0 0 1 1.8 -1.8zM12 7.6v10.4M7.5 10.2l9 5.2M7.5 15.4l9-5.2M10.6 7.8L12 9.2l1.4-1.4M10.6 17.8L12 16.4l1.4 1.4", f: "M7.6 4h8.8a0.6 0.6 0 0 1 0.6 0.6v0.1a0.6 0.6 0 0 1 -0.6 0.6h-8.8a0.6 0.6 0 0 1 -0.6 -0.6v-0.1a0.6 0.6 0 0 1 0.6 -0.6z" },
  "iron": { name: "Σίδερο", d: "M2.8 17.6h17.8c0-5.2-2.7-8.6-7.4-8.6H8.6M7.2 9h4.6", f: "M2.8 17.6c.6-3 3-5.2 6.4-5.2h11.2c.1.4.2 1.3.2 2.1v3.1zM5.95 20.4a0.65 0.65 0 1 0 1.3 0a0.65 0.65 0 1 0 -1.3 0M9.75 20.4a0.65 0.65 0 1 0 1.3 0a0.65 0.65 0 1 0 -1.3 0M13.55 20.4a0.65 0.65 0 1 0 1.3 0a0.65 0.65 0 1 0 -1.3 0" },
  "heater": { name: "Θερμοσίφωνας", d: "M11.4 2.4h1.2a5.2 5.2 0 0 1 5.2 5.2v6.4a5.2 5.2 0 0 1 -5.2 5.2h-1.2a5.2 5.2 0 0 1 -5.2 -5.2v-6.4a5.2 5.2 0 0 1 5.2 -5.2zM9.4 19.2v2.6M14.6 19.2v2.6", f: "M14.32 5.8L9.6 12.62L12.75 12.62L11.49 17.35L16.53 10L13.38 10L14.85 5.8zM9.1 21h0.6a0.3 0.3 0 0 1 0.3 0.3v0.6a0.3 0.3 0 0 1 -0.3 0.3h-0.6a0.3 0.3 0 0 1 -0.3 -0.3v-0.6a0.3 0.3 0 0 1 0.3 -0.3zM14.3 21h0.6a0.3 0.3 0 0 1 0.3 0.3v0.6a0.3 0.3 0 0 1 -0.3 0.3h-0.6a0.3 0.3 0 0 1 -0.3 -0.3v-0.6a0.3 0.3 0 0 1 0.3 -0.3z" },
  "instant": { name: "Ταχυθερμαντήρας", d: "M8.4 2.6h7.2a2 2 0 0 1 2 2v10.6a2 2 0 0 1 -2 2h-7.2a2 2 0 0 1 -2 -2v-10.6a2 2 0 0 1 2 -2zM9.6 17.2v2.2M14.4 17.2v2.2M9.6 21.6v.4M14.4 21.6v.4", f: "M12 6.2c-0.69 1.85 -2.29 3.33 -2.29 5.03a2.29 2.29 0 0 0 4.59 0c0 -1.7 -1.61 -3.18 -2.29 -5.03z" },
  "boiler": { name: "Λέβητας", d: "M6.6 2.4h10.8a1.6 1.6 0 0 1 1.6 1.6v16a1.6 1.6 0 0 1 -1.6 1.6h-10.8a1.6 1.6 0 0 1 -1.6 -1.6v-16a1.6 1.6 0 0 1 1.6 -1.6zM5 6.8h14M9 9.4h6a1 1 0 0 1 1 1v7.4a1 1 0 0 1 -1 1h-6a1 1 0 0 1 -1 -1v-7.4a1 1 0 0 1 1 -1z", f: "M6.75 4.6a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M9.35 4.6a0.85 0.85 0 1 0 1.7 0a0.85 0.85 0 1 0 -1.7 0M12 17.6C10.56 17.6 9.64 16.64 9.64 15.32C9.64 14.06 10.53 13.33 10.97 12.15C11.26 12.74 11.52 13.11 12 13.36C11.96 12.22 12.48 11.23 13.33 10.6C13.22 11.71 13.77 12.37 14.17 13.03C14.54 13.62 14.73 14.21 14.73 14.84C14.73 16.42 13.58 17.6 12 17.6z" },
  "gas": { name: "Αέριο", d: "M12 21.6C8.06 21.6 5.53 18.97 5.53 15.33C5.53 11.9 7.96 9.88 9.17 6.64C9.98 8.26 10.69 9.27 12 9.98C11.9 6.85 13.31 4.12 15.64 2.4C15.33 5.43 16.85 7.25 17.96 9.07C18.97 10.69 19.48 12.3 19.48 14.02C19.48 18.37 16.35 21.6 12 21.6z", f: "M12.4 19.6C10.68 19.6 9.57 18.45 9.57 16.86C9.57 15.36 10.63 14.47 11.16 13.06C11.52 13.76 11.83 14.21 12.4 14.52C12.36 13.15 12.97 11.95 13.99 11.2C13.86 12.53 14.52 13.32 15.01 14.12C15.45 14.83 15.67 15.53 15.67 16.28C15.67 18.19 14.3 19.6 12.4 19.6z" },
  "heatpump": { name: "Αντλία θερμότητας", d: "M4 4h16a1.6 1.6 0 0 1 1.6 1.6v11.8a1.6 1.6 0 0 1 -1.6 1.6h-16a1.6 1.6 0 0 1 -1.6 -1.6v-11.8a1.6 1.6 0 0 1 1.6 -1.6zM4 11.5a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0M16.6 7.6h2.8M16.6 10.2h2.8M16.6 12.8h2.8M16.6 15.4h2.8M5 19v1.8M19 19v1.8", f: "M8.3 11.5a0.9 0.9 0 1 0 1.8 0a0.9 0.9 0 1 0 -1.8 0M9.2 10.6c-.2-1.8.4-3.4 2-3.7.9 1.3.3 3.1-2 3.7zM10 12.1c1.6.8 2.5 2.3 1.7 3.8-1.6-.1-2.4-1.8-1.7-3.8zM8.4 12.1c-1.4 1.2-3.1 1.4-3.9-.1.8-1.4 2.7-1.4 3.9.1z" },
  "floor": { name: "Ενδοδαπέδια θέρμανση", d: "M2.8 10L12 2.8 21.2 10M5 21.4h14M6.2 18.4v-5.6a1.55 1.55 0 0 1 3.1 0v3.2a1.55 1.55 0 0 0 3.1 0v-3.2a1.55 1.55 0 0 1 3.1 0v3.2a1.55 1.55 0 0 0 3.1 0v-5.6", f: "M3.8 20.4h16.4v1.6h-16.4z" },
  "convector": { name: "Θερμοπομπός", d: "M4 7h16a1.4 1.4 0 0 1 1.4 1.4v7.6a1.4 1.4 0 0 1 -1.4 1.4h-16a1.4 1.4 0 0 1 -1.4 -1.4v-7.6a1.4 1.4 0 0 1 1.4 -1.4zM5 10.2h10M5 12.6h10M5 15h10M5.6 17.4v2.4M18.4 17.4v2.4M8.2 5.6c-.9-.9.9-1.6 0-2.5s.9-1.6 0-1.5M12 5.6c-.9-.9.9-1.6 0-2.5s.9-1.6 0-1.5M15.8 5.6c-.9-.9.9-1.6 0-2.5s.9-1.6 0-1.5", f: "M17.1 10.8a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M18 13.4h0.4a0.6 0.6 0 0 1 0.6 0.6v1.2a0.6 0.6 0 0 1 -0.6 0.6h-0.4a0.6 0.6 0 0 1 -0.6 -0.6v-1.2a0.6 0.6 0 0 1 0.6 -0.6z" },
  "radiator": { name: "Καλοριφέρ", d: "M4.4 6.6a1.6 1.6 0 0 1 3.2 0v11a1.6 1.6 0 0 1-3.2 0zM8.8 6.6a1.6 1.6 0 0 1 3.2 0v11a1.6 1.6 0 0 1-3.2 0zM13.2 6.6a1.6 1.6 0 0 1 3.2 0v11a1.6 1.6 0 0 1-3.2 0zM17.6 6.6a1.6 1.6 0 0 1 3.2 0v11a1.6 1.6 0 0 1-3.2 0zM2.6 8.6h1.8M2.6 15.6h1.8", f: "M5.2 20.4h1.6v1.6h-1.6zM18.4 20.4h1.6v1.6h-1.6z" },
  "towel": { name: "Πετσετοκρεμάστρα", d: "M6 2.6v18.8M18 2.6v18.8M6 5.6h12M6 9.2h12M6 12.8h12M6 16.4h12", f: "M9.6 9.2h4.8v8.6l-2.4-1.2-2.4 1.2z" },
  "solar": { name: "Ηλιακός θερμοσίφωνας", d: "M2.6 14.4l3.2-8.4h12.4l3.2 8.4zM4.2 10.2h15.6M10 6l-.6 8.4M14 6l.6 8.4M10.4 16.4h3.2a2.4 2.4 0 0 1 2.4 2.4v0.2a2.4 2.4 0 0 1 -2.4 2.4h-3.2a2.4 2.4 0 0 1 -2.4 -2.4v-0.2a2.4 2.4 0 0 1 2.4 -2.4z", f: "M4 3.4a1.4 1.4 0 1 0 2.8 0a1.4 1.4 0 1 0 -2.8 0" },
  "pv": { name: "Φωτοβολταϊκά", d: "M2.4 19.6l3.8-11h15.4l-3.8 11zM4.3 14.1h15.4M11.5 8.6l-2.2 11M16.6 8.6l-2.2 11M7.3 21.6h12", f: "M3.3 4.4a1.9 1.9 0 1 0 3.8 0a1.9 1.9 0 1 0 -3.8 0M5.2 1.2v.8M2 4.4h.8M8.4 4.4h-.8M2.9 2.1l.6.6M7.5 2.1l-.6.6" },
  "battery": { name: "Μπαταρία αποθήκευσης", d: "M4.4 7.2h13.2a2 2 0 0 1 2 2v5.6a2 2 0 0 1 -2 2h-13.2a2 2 0 0 1 -2 -2v-5.6a2 2 0 0 1 2 -2zM19.6 10.2h1.4a.8.8 0 0 1 .8.8v2a.8.8 0 0 1-.8.8h-1.4", f: "M5.1 9.2h2.2a0.7 0.7 0 0 1 0.7 0.7v4.2a0.7 0.7 0 0 1 -0.7 0.7h-2.2a0.7 0.7 0 0 1 -0.7 -0.7v-4.2a0.7 0.7 0 0 1 0.7 -0.7zM9.5 9.2h2.2a0.7 0.7 0 0 1 0.7 0.7v4.2a0.7 0.7 0 0 1 -0.7 0.7h-2.2a0.7 0.7 0 0 1 -0.7 -0.7v-4.2a0.7 0.7 0 0 1 0.7 -0.7zM13.9 9.2h2.2a0.7 0.7 0 0 1 0.7 0.7v4.2a0.7 0.7 0 0 1 -0.7 0.7h-2.2a0.7 0.7 0 0 1 -0.7 -0.7v-4.2a0.7 0.7 0 0 1 0.7 -0.7z" },
  "energy": { name: "Διαχείριση ενέργειας", d: "M3.2 17.6a8.8 8.8 0 1 1 17.6 0M5.4 11.2l1.4.9M12 6.2v1.6M18.6 11.2l-1.4.9M7.4 21.2h9.2", f: "M11.3 17.9l4.6-6.6.7.5-3.8 7.1a1.3 1.3 0 0 1-1.5-1zM10.5 17.9a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0" },
  "generator": { name: "Γεννήτρια / ATS", d: "M4.2 7.4h15.6a1.6 1.6 0 0 1 1.6 1.6v8.4a1.6 1.6 0 0 1 -1.6 1.6h-15.6a1.6 1.6 0 0 1 -1.6 -1.6v-8.4a1.6 1.6 0 0 1 1.6 -1.6zM5 19v2.2M19 19v2.2M2.6 7.4l1.6-3h4.2l1.6 3M12.8 10h6v6.4h-6z", f: "M9.25 9.4L5.2 15.25L7.9 15.25L6.82 19.3L11.14 13L8.44 13L9.7 9.4zM13.9 12a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M16.5 12a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M14.5 14h2.6a0.5 0.5 0 0 1 0.5 0.5v0.1a0.5 0.5 0 0 1 -0.5 0.5h-2.6a0.5 0.5 0 0 1 -0.5 -0.5v-0.1a0.5 0.5 0 0 1 0.5 -0.5z" },
  "softener": { name: "Αποσκληρυντής νερού", d: "M8.8 2.4h6.4a2.6 2.6 0 0 1 2.6 2.6v11.2a2.6 2.6 0 0 1 -2.6 2.6h-6.4a2.6 2.6 0 0 1 -2.6 -2.6v-11.2a2.6 2.6 0 0 1 2.6 -2.6zM9.4 18.8v2.8M14.6 18.8v2.8M6.2 6.4h11.6M8.6 12.8c1.1-.9 2.3-.9 3.4 0s2.3.9 3.4 0", f: "M8.4 3.8h3v1.2h-3zM9.6 15.2l1.2-1.2 1.2 1.2-1.2 1.2zM12.6 15.6l1-1 1 1-1 1zM10.8 9.4l1.1-1.1 1.1 1.1-1.1 1.1z" },
  "water": { name: "Νερό / αντλία", d: "M3.8 13.6a6.2 6.2 0 1 0 12.4 0a6.2 6.2 0 1 0 -12.4 0M14.4 9.2l2.6-2.6h4.4v3.6h-3.2M5 21.6h10M7.8 19.4l-.8 2.2M12.2 19.4l.8 2.2", f: "M10 9.8c-0.63 1.7 -2.11 3.06 -2.11 4.62a2.11 2.11 0 0 0 4.22 0c0 -1.56 -1.48 -2.92 -2.11 -4.62z" },
  "motor": { name: "Μοτέρ", d: "M2.8 12a9.2 9.2 0 1 0 18.4 0a9.2 9.2 0 1 0 -18.4 0", f: "M7.6 16.4V7.6h1.6l2.8 4.2 2.8-4.2h1.6v8.8h-1.7V10.6l-2.7 3.9-2.7-3.9v5.8z" },
  "shutter": { name: "Ρολά", d: "M4.6 7.4V21h14.8V7.4M4.6 10.6h14.8M4.6 13.8h14.8M4.6 17h14.8M12 21v1", f: "M5.6 2.6h12.8a2.4 2.4 0 0 1 2.4 2.4v0a2.4 2.4 0 0 1 -2.4 2.4h-12.8a2.4 2.4 0 0 1 -2.4 -2.4v-0a2.4 2.4 0 0 1 2.4 -2.4z" },
  "blinds": { name: "Περσίδες", d: "M5 8l14 2.2M5 11.4l14 2.2M5 14.8l14 2.2M5 18.2l14 2.2M7.5 6v15M16.5 6v15", f: "M4.6 2.8h14.8a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-14.8a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1z" },
  "garage": { name: "Γκαραζόπορτα", d: "M2.6 10.2L12 3l9.4 7.2v11.2H2.6zM6.2 21.4V12.2h11.6v9.2", f: "M7.6 13.6h8.8v1.8h-8.8zM7.6 16.6h8.8v1.8h-8.8zM7.6 19.6h8.8v1.8h-8.8z" },
  "gate": { name: "Αυλόπορτα", d: "M7.8 8.6v12.6M11 7.6v13.6M14.2 7.6v13.6M7.8 8.6c2.6-1.6 5.8-1.6 8.4 0M6 20h12", f: "M3.2 4.6h2.8v17h-2.8zM18 4.6h2.8v17h-2.8zM3 4.6l1.6-1.8 1.6 1.8zM17.8 4.6l1.6-1.8 1.6 1.8z" },
  "lock": { name: "Ηλεκτρική κλειδαριά", d: "M2.6 12a4.4 4.4 0 1 0 8.8 0a4.4 4.4 0 1 0 -8.8 0M5.5 12a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M11.4 12h10.2M17.6 12v3.4M20.6 12v2.6" },
  "intercom": { name: "Θυροτηλέφωνο", d: "M7.8 2.2h8.4a1.8 1.8 0 0 1 1.8 1.8v16a1.8 1.8 0 0 1 -1.8 1.8h-8.4a1.8 1.8 0 0 1 -1.8 -1.8v-16a1.8 1.8 0 0 1 1.8 -1.8zM9.6 16a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0", f: "M8.7 5.4a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M11.3 5.4a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M13.9 5.4a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M8.7 7.6a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M11.3 7.6a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M13.9 7.6a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M8.7 9.8a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M11.3 9.8a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M13.9 9.8a0.7 0.7 0 1 0 1.4 0a0.7 0.7 0 1 0 -1.4 0M11 16a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" },
  "bell": { name: "Κουδούνι", d: "M6.2 16.4v-5.2a5.8 5.8 0 0 1 11.6 0v5.2l1.8 2.2H4.4zM12 3.4v2M2.6 8.4a10 10 0 0 1 2-4.2M21.4 8.4a10 10 0 0 0-2-4.2", f: "M9.8 19.6h4.4a2.2 2.2 0 0 1-4.4 0z" },
  "alarm": { name: "Συναγερμός", d: "M7 16.4v-4.6a5 5 0 0 1 10 0v4.6M12 2.6v2.2M3.6 6l1.6 1.6M20.4 6l-1.6 1.6M2.4 12h2.2M19.4 12h2.2", f: "M5.4 16.4h13.2a1 1 0 0 1 1 1v2.2a1 1 0 0 1 -1 1h-13.2a1 1 0 0 1 -1 -1v-2.2a1 1 0 0 1 1 -1zM9.6 11.8a2.4 2.4 0 0 1 2.4-2.4v1.4a1 1 0 0 0-1 1z" },
  "cctv": { name: "Κάμερα", d: "M2.8 6.8l13.4 3.6-1.8 6.6L1 13.4zM16.2 10.4l4.2 1.1-1.1 4-4.2-1.1M5.6 14.2v4.6M3 20.6h5.2", f: "M4.6 10.2a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M3.6 19.8h4.2v1.6h-4.2z" },
  "lift": { name: "Ανελκυστήρας", d: "M5.4 2.4h13.2a1.4 1.4 0 0 1 1.4 1.4v16.4a1.4 1.4 0 0 1 -1.4 1.4h-13.2a1.4 1.4 0 0 1 -1.4 -1.4v-16.4a1.4 1.4 0 0 1 1.4 -1.4zM12 6.6v15", f: "M8 4.1l2 2.6H6zM16 6.7l-2-2.6h4zM6.4 10.6h3.2v8.8H6.4zM14.4 10.6h3.2v8.8h-3.2z" },
  "fan": { name: "Ανεμιστήρας", d: "M2.6 12a9.4 9.4 0 1 0 18.8 0a9.4 9.4 0 1 0 -18.8 0", f: "M10.4 12a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0M12 10.2c-1.4-1.6-1.8-4.4-.3-5.8 1.4-.5 3.3 1.3 2.6 3.6-.4 1.1-1.1 1.8-2.3 2.2zM13.6 12.9c2.1-.4 4.7.6 5.1 2.6-.5 1.4-3.1 2.1-4.6.3-.7-.8-.8-1.8-.5-2.9zM10.4 12.9c-.7 2-2.9 3.8-4.9 3.2-1-1.1-.3-3.7 2-4.2 1-.2 2 .1 2.9 1z" },
  "ac": { name: "Κλιματιστικό", d: "M4.4 3.6h15.2a2 2 0 0 1 2 2v4.4a2 2 0 0 1 -2 2h-15.2a2 2 0 0 1 -2 -2v-4.4a2 2 0 0 1 2 -2zM4.6 9.4h14.8M7.4 14.6c-.8 1.6.8 2.6 0 4.2M12 14.6c-.8 1.6.8 2.6 0 4.2M16.6 14.6c-.8 1.6.8 2.6 0 4.2", f: "M17.2 6.4a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0M4.6 10.3h14.8v1.7h-14.8z" },
  "pool": { name: "Πισίνα", d: "M7 2.8v10.8M12.6 2.8v10.8M7 6.4h5.6M7 10h5.6M7 2.8a1.4 1.4 0 0 0-2.4 1M12.6 2.8a1.4 1.4 0 0 0-2.4 1M2.4 17q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0M2.4 21q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0q0.75 -0.9 1.5 0t1.5 0" },
  "sauna": { name: "Σάουνα", d: "M2.8 10L12 2.8 21.2 10M5 8.4v13h14v-13M9 13.6c-.9-.9.9-1.6 0-2.5s.9-1.6 0-2.3M12 13.6c-.9-.9.9-1.6 0-2.5s.9-1.6 0-2.3M15 13.6c-.9-.9.9-1.6 0-2.5s.9-1.6 0-2.3", f: "M7 21.4c0-2.2 1.6-3.4 3.2-3.4 1 0 1.4.6 1.8.6s.8-.6 1.8-.6c1.6 0 3.2 1.2 3.2 3.4z" },
  "spa": { name: "Υδρομασάζ", d: "M2.4 12.2h19.2v2.8a4.8 4.8 0 0 1-4.8 4.8H7.2A4.8 4.8 0 0 1 2.4 15zM6.4 19.8l-.9 1.8M17.6 19.8l.9 1.8M4.6 12.2V5.4a2.2 2.2 0 0 1 4.2-.9", f: "M10.5 8.6a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0 -3 0M14.7 6.2a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0M16.3 9.6a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0 -2.6 0M12.8 4.4a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0" },
  "misc": { name: "Διάφορα", d: "M5.6 3.4h12.8a2.2 2.2 0 0 1 2.2 2.2v12.8a2.2 2.2 0 0 1 -2.2 2.2h-12.8a2.2 2.2 0 0 1 -2.2 -2.2v-12.8a2.2 2.2 0 0 1 2.2 -2.2z", f: "M6.75 12a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0M10.75 12a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0M14.75 12a1.25 1.25 0 1 0 2.5 0a1.25 1.25 0 1 0 -2.5 0" }
};

/* Κεφαλαία για ελληνικά χωρίς τόνους (ΓΕΝΙΚΟΣ, όχι ΓΕΝΙΚΌΣ). Κρατά τα διαλυτικά (ΜΑΪΟΥ, ΤΣΑΪ). */
function upGreek(str) {
  const s = String(str || '').normalize('NFD');
  let out = '', prevTonos = false;
  for (const ch of s) {
    if (ch === '\u0301' || ch === '\u0342' || ch === '\u0313' || ch === '\u0314') { prevTonos = ch === '\u0301'; continue; }
    if (ch === '\u0308') { out += ch; prevTonos = false; continue; }
    const U = ch.toUpperCase();
    // ά + ι → ΑΪ (τσάι → ΤΣΑΪ): ο τόνος στο πρώτο φωνήεν δείχνει ότι δεν είναι δίψηφο
    if (prevTonos && (U === 'Ι' || U === 'Υ')) { out += U + '\u0308'; prevTonos = false; continue; }
    prevTonos = false;
    out += U;
  }
  return out.normalize('NFC');
}

const _pathCache = {};
const SYM_LW = 1.4;
function symPath(key) {
  if (!SYMBOLS[key]) return null;
  if (!_pathCache[key]) _pathCache[key] = { s: new Path2D(SYMBOLS[key].d), f: SYMBOLS[key].f ? new Path2D(SYMBOLS[key].f) : null };
  return _pathCache[key];
}
function symSvg(key, cls) {
  if (!SYMBOLS[key]) return '';
  const f = SYMBOLS[key].f ? `<path class="f" d="${SYMBOLS[key].f}"/>` : '';
  return `<svg class="${cls || 'sym'} symv" viewBox="0 0 24 24" aria-hidden="true"><path d="${SYMBOLS[key].d}"/>${f}</svg>`;
}

/* ---------- Κείμενο ---------- */
function wrapText(ctx, text, maxPx) {
  const out = [];
  String(text).split(/\n/).forEach(par => {
    const words = par.trim().split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); return; }
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxPx) { line = test; continue; }
      if (line) out.push(line);
      if (ctx.measureText(word).width <= maxPx) { line = word; continue; }
      // λέξη μεγαλύτερη από το πλάτος: σπάσιμο ανά χαρακτήρα
      let part = '';
      for (const ch of word) {
        if (ctx.measureText(part + ch).width > maxPx && part) { out.push(part); part = ch; }
        else part += ch;
      }
      line = part;
    }
    out.push(line);
  });
  while (out.length > 1 && out[out.length - 1] === '') out.pop();
  return out;
}

/* Βρίσκει το μεγαλύτερο μέγεθος γραμματοσειράς (mm) που χωράει σε maxW x maxH (mm). */
/* Όλες οι μετρήσεις κειμένου γίνονται σε σταθερή κλίμακα (REF_S pixel/mm) σε ξεχωριστό canvas,
 * ώστε η αναδίπλωση και το μέγεθος να είναι ίδια σε προεπισκόπηση, PDF και εκτύπωση, όποια κι αν είναι η ανάλυση. */
const REF_S = 24;
let _mctx = null;
function measureCtx() {
  if (!_mctx) _mctx = document.createElement('canvas').getContext('2d');
  return _mctx;
}
const _fitCache = new Map();
function fitText(ctx, s, text, maxW, maxH, maxF, minF, weight) {
  weight = weight || 700;
  const key = [text, maxW.toFixed(3), maxH.toFixed(3), maxF.toFixed(2), minF.toFixed(2), weight].join('\u0001');
  const hit = _fitCache.get(key);
  if (hit) return hit;
  const m = measureCtx();
  let res = null;
  const words = String(text).split(/\s+/).filter(Boolean);
  for (let f = maxF; f >= minF - 1e-6; f -= 0.1) {
    m.font = `${weight} ${(f * REF_S).toFixed(2)}px ${LABEL_FONT}`;
    // μια λέξη δεν σπάει στη μέση όσο υπάρχει μικρότερο μέγεθος που τη χωράει
    if (f > minF + 1e-6 && words.some(w => m.measureText(w).width > maxW * REF_S)) continue;
    const lines = wrapText(m, text, maxW * REF_S);
    const lh = f * 1.13;
    if (lines.length * lh <= maxH + 1e-6) { res = { f, lines, lh, overflow: false }; break; }
  }
  if (!res) {
    m.font = `${weight} ${(minF * REF_S).toFixed(2)}px ${LABEL_FONT}`;
    const lh = minF * 1.13;
    const maxLines = Math.max(1, Math.floor(maxH / lh));
    let lines = wrapText(m, text, maxW * REF_S);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last.length && m.measureText(last + '…').width > maxW * REF_S) last = last.slice(0, -1);
      lines[maxLines - 1] = last + '…';
    }
    res = { f: minF, lines, lh, overflow: true };
  }
  if (_fitCache.size > 4000) _fitCache.clear();
  _fitCache.set(key, res);
  return res;
}
/* Αναδίπλωση σε σταθερή κλίμακα για ελεύθερο κείμενο (αυτοκόλλητο). */
function wrapFixed(text, fontMM, weight, maxW) {
  const m = measureCtx();
  m.font = `${weight} ${(fontMM * REF_S).toFixed(2)}px ${LABEL_FONT}`;
  return wrapText(m, text, maxW * REF_S);
}

function drawLines(ctx, s, fit, cx, top, weight) {
  ctx.font = `${weight || 700} ${(fit.f * s).toFixed(2)}px ${LABEL_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  fit.lines.forEach((ln, i) => ctx.fillText(ln, cx * s, (top + fit.lh * (i + 0.5)) * s));
}

/* ---------- Κελί ετικέτας ---------- */
function drawCell(ctx, s, x, y, w, h, c, stats, capF, measureOnly) {
  const pad = Math.min(1, w * 0.06);
  const iw = w - pad * 2;
  let top = y + pad, bottom = y + h - pad;
  const cx = x + w / 2;
  const fg = c.fg || '#000', sc = c.sc || '#000';
  ctx.fillStyle = fg;
  ctx.strokeStyle = sc;

  if (c.rating) {
    const fr = fitText(ctx, s, c.rating, iw, Math.min(2.2, h * 0.17), Math.max(1.1, Math.min(2.0, h * 0.15, capF && capF < 99 ? capF : 99)), 1.1, 700);
    const rh = fr.lh * fr.lines.length;
    if (!measureOnly) { ctx.fillStyle = fg; drawLines(ctx, s, fr, cx, bottom - rh, 700); }
    bottom -= rh + 0.3;
  }

  const hasText = c.text && c.text.trim();
  const sym = c.sym && symPath(c.sym);
  if (sym) {
    const ss = Math.max(2, Math.min(hasText ? Math.min((bottom - top) * 0.5, 9) : (bottom - top), iw * 0.9, 12));
    const sy = hasText ? top : top + ((bottom - top) - ss) / 2;
    if (!measureOnly) {
    ctx.save();
    ctx.translate((cx - ss / 2) * s, sy * s);
    ctx.scale((ss * s) / 24, (ss * s) / 24);
    ctx.lineWidth = SYM_LW;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = sc;
    ctx.fillStyle = sc;
    ctx.stroke(sym.s);
    if (sym.f) ctx.fill(sym.f);
    ctx.restore();
    }
    top = sy + ss + 0.3;
  }

  if (hasText) {
    const avail = bottom - top;
    if (avail < 1) { if (stats && !measureOnly) stats.overflow++; return measureOnly ? 1.2 : undefined; }
    const fit = fitText(ctx, s, c.text, iw, avail, Math.min(capF || 99, 3.6, h * 0.26), 1.1, 700);
    if (measureOnly) return fit.f;
    if (fit.overflow && stats) stats.overflow++;
    const th = fit.lh * fit.lines.length;
    if (stats && stats.lines) stats.lines.push(fit.lines.join('|') + '@' + fit.f.toFixed(1));
    ctx.fillStyle = fg;
    drawLines(ctx, s, fit, cx, top + (avail - th) / 2, 700);
  }
}

/* ---------- Λωρίδα (μία σειρά ή τμήμα σειράς) ---------- */
function stripWidth(cells, unit) { return cells.reduce((a, c) => a + c.w * unit, 0); }

function drawStrip(ctx, s, x, y, cells, h, unit, stats) {
  const total = stripWidth(cells, unit);
  // ενιαίο μέγεθος γραμμάτων σε όλη τη λωρίδα (το μικρότερο που χωράει παντού)
  let capF = 99;
  let mx = x;
  cells.forEach(c => {
    if (!c.blank && c.text && c.text.trim()) { const f = drawCell(ctx, s, mx, y, c.w * unit, h, c, null, 99, true); if (f) capF = Math.min(capF, f); }
    mx += c.w * unit;
  });
  // 1. φόντα
  // κάτω όριο: ένα κελί με πολύ κείμενο δεν μικραίνει όλη τη λωρίδα (μικραίνει μόνο το ίδιο)
  capF = Math.max(capF, Math.min(1.8, h * 0.15));
  let cx = x;
  cells.forEach(c => {
    const cw = c.w * unit;
    if (!c.blank && c.bg && c.bg !== '#ffffff') { ctx.fillStyle = c.bg; ctx.fillRect(cx * s, y * s, cw * s, h * s); }
    cx += cw;
  });
  // 2. διαχωριστικά: ανάμεσα σε κενές θέσεις γκρι, αλλιώς στο χρώμα περιγράμματος
  const bcol = (cells.find(c => !c.blank) || {}).bc || '#000';
  cx = x;
  ctx.lineWidth = Math.max(1, 0.18 * s);
  cells.forEach((c, i) => {
    cx += c.w * unit;
    if (i === cells.length - 1) return;
    ctx.strokeStyle = (c.blank && cells[i + 1].blank) ? '#b5b5b5' : bcol;
    ctx.beginPath(); ctx.moveTo(cx * s, y * s); ctx.lineTo(cx * s, (y + h) * s); ctx.stroke();
  });
  // 3. εξωτερικό περίγραμμα (γραμμή κοπής)
  ctx.strokeStyle = bcol;
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.strokeRect(x * s, y * s, total * s, h * s);
  // 4. περιεχόμενο
  cx = x;
  cells.forEach(c => {
    const cw = c.w * unit;
    if (!c.blank) drawCell(ctx, s, cx, y, cw, h, c, stats, capF);
    cx += cw;
  });
}

/* ---------- Δεδομένα έργου → κελιά ---------- */
function rowUnits(row) { return row.items.reduce((a, i) => a + i.w, 0); }

function buildRows(project, settings) {
  const col = (settings && settings.labelColors) || project.colors || { bg: '#ffffff', fg: '#000000', sc: '#000000', bc: '#000000' };
  return project.rows.map((r, ri) => {
    const cells = r.items.map(i => ({
      w: i.w, text: upGreek(i.text), rating: upGreek(i.rating),
      sym: settings.showSymbols ? i.sym : '',
      bg: col.bg, fg: col.fg, sc: col.sc, bc: col.bc
    }));
    const cap = +project.modulesPerRow || 0;
    if (project.fillEmpty && cap > 0) {
      let rem = Math.round((cap - rowUnits(r)) * 2) / 2;
      while (rem >= 1) { cells.push({ w: 1, blank: true }); rem -= 1; }
      if (rem > 0) cells.push({ w: rem, blank: true });
    }
    return { title: r.name || `Σειρά ${ri + 1}`, cells };
  }).filter(r => r.cells.length);
}

function splitCells(cells, unit, maxW) {
  const segs = [];
  let cur = [], w = 0;
  for (const c of cells) {
    const cw = c.w * unit;
    if (cur.length && w + cw > maxW + 0.001) { segs.push(cur); cur = []; w = 0; }
    cur.push(c); w += cw;
  }
  if (cur.length) segs.push(cur);
  return segs;
}

function fmtMM(v) { return (Math.round(v * 10) / 10).toString().replace('.', ','); }
function fmtUnits(v) { return v.toString().replace('.', ','); }

/* Διάταξη σελίδων ετικετών. Επιστρέφει [{w,h,els:[...]}] σε mm. */
function layoutLabelPages(project, st) {
  const unit = +st.unitMM, H = +st.labelH;
  const rows = buildRows(project, st);
  const pages = [];
  if (st.pageMode === 'roll') {
    const maxL = Math.max(unit * 6, +st.rollMax || 250);
    rows.forEach(r => splitCells(r.cells, unit, maxL).forEach(seg => {
      const w = stripWidth(seg, unit);
      pages.push({ w, h: H, color: true, els: [{ t: 'strip', x: 0, y: 0, cells: seg, h: H }] });
    }));
    return pages;
  }
  const [PW, PH] = st.pageMode === 'a4p' ? [210, 297] : [297, 210];
  const M = 10, headH = 8, capH = st.showCaptions ? 4 : 0, gap = 4;
  const maxW = PW - 2 * M;
  let page = null, y = 0;
  const newPage = () => { page = { w: PW, h: PH, color: true, els: [] }; pages.push(page); y = M + headH; };
  newPage();
  rows.forEach(r => {
    const segs = splitCells(r.cells, unit, maxW);
    segs.forEach((seg, si) => {
      const need = capH + H;
      if (y + need > PH - M && page.els.length) newPage();
      if (capH) {
        const units = seg.reduce((a, c) => a + c.w, 0);
        let cap = r.title;
        if (segs.length > 1) cap += `  ·  τμήμα ${si + 1}/${segs.length}`;
        cap += `  ·  ${fmtUnits(units)} μον.  ·  ${fmtMM(stripWidth(seg, unit))} mm`;
        page.els.push({ t: 'caption', x: M, y: y, text: cap });
      }
      page.els.push({ t: 'strip', x: M, y: y + capH, cells: seg, h: H });
      y += need + gap;
    });
  });
  const n = pages.length;
  const date = new Date().toLocaleDateString('el-GR');
  pages.forEach((p, i) => p.els.unshift({
    t: 'header', x: M, y: M, w: PW - 2 * M,
    left: project.name + (project.address ? '  —  ' + project.address : ''),
    right: `Μονάδα ${fmtMM(unit)} mm · ύψος ${fmtMM(H)} mm · ${date} · σελ. ${i + 1}/${n}`
  }));
  if (!rows.length) pages[0].els.push({ t: 'note', x: M, y: M + headH + 4, text: 'Το έργο δεν έχει ακόμη στοιχεία.' });
  return pages;
}

/* Διάταξη αυτοκόλλητου ηλεκτρολόγου. */
function layoutStickerPages(st) {
  const w = +st.stickerW, h = +st.stickerH, copies = Math.max(1, Math.min(200, +st.stickerCopies || 1));
  if (st.pageMode === 'roll') {
    return Array.from({ length: copies }, () => ({ w, h, color: true, els: [{ t: 'sticker', x: 0, y: 0, w, h }] }));
  }
  // A4 κάθετη ή οριζόντια: όποια χωράει το αυτοκόλλητο και βάζει περισσότερα ανά σελίδα
  const M = 10, g = 4;
  const fit = (PW, PH) => {
    if (w > PW - 2 * M + 0.01 || h > PH - 2 * M + 0.01) return null;
    const cols = Math.floor((PW - 2 * M + g) / (w + g)), rows = Math.floor((PH - 2 * M + g) / (h + g));
    return { PW, PH, cols, rowsN: rows, per: cols * rows };
  };
  const opts = [fit(210, 297), fit(297, 210)].filter(Boolean);
  const best = opts.sort((a, b) => b.per - a.per)[0] || { PW: 297, PH: 210, cols: 1, rowsN: 1, per: 1 };
  const { PW, PH, cols, rowsN, per } = best;
  const pages = [];
  for (let k = 0; k < copies; k++) {
    if (k % per === 0) pages.push({ w: PW, h: PH, color: true, els: [] });
    const idx = k % per;
    const c = idx % cols, r = Math.floor(idx / cols);
    pages[pages.length - 1].els.push({ t: 'sticker', x: M + c * (w + g), y: M + r * (h + g), w, h });
  }
  return pages;
}

/* Σελίδα βαθμονόμησης: χάρακες 100 mm και λωρίδα 10 μονάδων. */
function layoutCalibration(st) {
  return [{ w: 210, h: 297, color: false, els: [{ t: 'calib' }] }];
}

/* ---------- Αυτοκόλλητο ---------- */
const ctxLogoSize = { v: 100 };
function drawSticker(ctx, s, x, y, w, h, e, logoImg, stats) {
  const r = Math.min(3, h * 0.1);
  ctx.save();
  ctx.lineWidth = Math.max(1, 0.25 * s);
  ctx.strokeStyle = '#000';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x * s, y * s, w * s, h * s, r * s);
  else ctx.rect(x * s, y * s, w * s, h * s);
  ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(e.bg || '') ? e.bg : '#ffffff';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  const ink = /^#[0-9a-f]{6}$/i.test(e.fg || '') ? e.fg : textOn(e.bg);

  const pad = Math.min(3, h * 0.1);
  let tx = x + pad, tw = w - 2 * pad;
  const hasText = !!(e.name || e.phone || e.email || e.extra);
  if (logoImg) {
    // το λογότυπο κρατά τις αναλογίες του· μεγαλώνει με το αυτοκόλλητο και με τη ρύθμιση «Μέγεθος λογότυπου»
    const scale = Math.min(1, Math.max(0.2, (+ctxLogoSize.v || 100) / 100));
    const maxW = hasText ? (w - 2 * pad) * 0.6 : w - 2 * pad, maxH = h - 2 * pad;
    const k = Math.min(maxW / logoImg.width, maxH / logoImg.height) * scale;
    const lw = logoImg.width * k, lh = logoImg.height * k;
    const lx = hasText ? x + pad : x + (w - lw) / 2;
    ctx.drawImage(logoImg, lx * s, (y + (h - lh) / 2) * s, lw * s, lh * s);
    tx += lw + pad;
    tw -= lw + pad;
  }
  const lines = [];
  if (e.name) lines.push({ text: e.name, k: 1.45, wt: 700 });
  if (e.phone) lines.push({ text: 'Τηλ. ' + e.phone, k: 1, wt: 700 });
  if (e.email) lines.push({ text: e.email, k: 0.9, wt: 400 });
  if (e.extra) lines.push({ text: e.extra, k: 0.85, wt: 400 });
  if (!lines.length) lines.push({ text: 'Συμπληρώστε τα στοιχεία σας', k: 1, wt: 400 });
  const availH = h - 2 * pad;
  ctx.fillStyle = ink;
  for (let f = Math.min(5, h * 0.16); f >= 1.2; f -= 0.1) {
    let total = 0;
    const laid = lines.map(L => {
      const fs = f * L.k;
      const ls = wrapFixed(L.text, fs, L.wt, tw);
      const lh = fs * 1.18;
      total += ls.length * lh;
      return { ls, fs, lh, wt: L.wt };
    });
    total += (laid.length - 1) * f * 0.25;
    if (total <= availH || f <= 1.25) {
      if (total > availH && stats) stats.overflow++;
      let cy = y + (h - Math.min(total, availH)) / 2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      laid.forEach(L => {
        ctx.font = `${L.wt} ${(L.fs * s).toFixed(2)}px ${LABEL_FONT}`;
        L.ls.forEach(ln => { ctx.fillText(ln, tx * s, (cy + L.lh / 2) * s); cy += L.lh; });
        cy += f * 0.25;
      });
      break;
    }
  }
}

/* Μαύρα ή λευκά γράμματα, ανάλογα με το πόσο σκούρο είναι το φόντο */
function textOn(bg) {
  if (!/^#[0-9a-f]{6}$/i.test(bg || '')) return '#000';
  const n = parseInt(bg.slice(1), 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
  const lum = (0.2126 * R + 0.7152 * G + 0.0722 * B) / 255;
  return lum < 0.5 ? '#fff' : '#000';
}

/* ---------- Βαθμονόμηση ---------- */
function drawCalibration(ctx, s, st) {
  const unit = +st.unitMM, H = +st.labelH;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${6 * s}px ${LABEL_FONT}`;
  ctx.fillText('EPC — Δοκιμή διαστάσεων', 15 * s, 22 * s);
  ctx.font = `400 ${3.6 * s}px ${LABEL_FONT}`;
  [
    'Εκτυπώστε σε κλίμακα 100% («Πραγματικό μέγεθος»), όχι «Προσαρμογή στη σελίδα».',
    'Μετρήστε με χάρακα: οι δύο γραμμές παρακάτω πρέπει να είναι ακριβώς 100 mm.',
    `Η λωρίδα πρέπει να είναι ${fmtMM(unit * 10)} mm (10 × ${fmtMM(unit)} mm) και ύψος ${fmtMM(H)} mm.`,
    'Αν η λωρίδα δεν ταιριάζει με τα στοιχεία του πίνακα, αλλάξτε «Πλάτος μονάδας» στις ρυθμίσεις εκτύπωσης.'
  ].forEach((t, i) => ctx.fillText(t, 15 * s, (32 + i * 6) * s));

  const ruler = (x0, y0, horizontal) => {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = Math.max(1, 0.2 * s);
    ctx.beginPath();
    for (let mm = 0; mm <= 100; mm++) {
      const len = mm % 10 === 0 ? 6 : mm % 5 === 0 ? 4 : 2.5;
      if (horizontal) { ctx.moveTo((x0 + mm) * s, y0 * s); ctx.lineTo((x0 + mm) * s, (y0 + len) * s); }
      else { ctx.moveTo(x0 * s, (y0 + mm) * s); ctx.lineTo((x0 + len) * s, (y0 + mm) * s); }
    }
    if (horizontal) { ctx.moveTo(x0 * s, y0 * s); ctx.lineTo((x0 + 100) * s, y0 * s); }
    else { ctx.moveTo(x0 * s, y0 * s); ctx.lineTo(x0 * s, (y0 + 100) * s); }
    ctx.stroke();
    ctx.font = `400 ${2.6 * s}px ${LABEL_FONT}`;
    ctx.textAlign = 'center';
    for (let cm = 0; cm <= 10; cm++) {
      if (horizontal) ctx.fillText(String(cm * 10), (x0 + cm * 10) * s, (y0 + 9.5) * s);
      else { ctx.textAlign = 'left'; ctx.fillText(String(cm * 10), (x0 + 8) * s, (y0 + cm * 10 + 1) * s); }
    }
    ctx.textAlign = 'left';
  };
  ruler(15, 64, true);
  ctx.font = `700 ${3.4 * s}px ${LABEL_FONT}`;
  ctx.fillText('100 mm οριζόντια', 15 * s, 82 * s);
  ruler(160, 64, false);
  ctx.save();
  ctx.translate(156 * s, 175 * s);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('100 mm κάθετα', 0, 0);
  ctx.restore();

  const cells = [
    { w: 2, text: 'Γενικός διακόπτης', sym: 'main', rating: '40A' },
    { w: 1, text: 'Φωτισμός', sym: 'light', rating: '10A' },
    { w: 1.5, text: 'Πρίζες κουζίνας', sym: 'socket', rating: '16A' },
    { w: 1, text: 'Θερμοσίφωνας' }, { w: 1, text: '' }, { w: 1, text: '' },
    { w: 1, text: '' }, { w: 1, text: '' }, { w: 0.5, text: '' }
  ];
  ctx.font = `700 ${3.4 * s}px ${LABEL_FONT}`;
  ctx.fillText(`Λωρίδα 10 μονάδων = ${fmtMM(unit * 10)} mm`, 15 * s, 190 * s);
  drawStrip(ctx, s, 15, 194, cells, H, unit);
  // σημάδια μονάδων
  ctx.lineWidth = Math.max(1, 0.15 * s);
  ctx.beginPath();
  for (let k = 0; k <= 10; k++) {
    ctx.moveTo((15 + k * unit) * s, (196 + H) * s);
    ctx.lineTo((15 + k * unit) * s, (199 + H) * s);
  }
  ctx.stroke();
  ctx.font = `400 ${3 * s}px ${LABEL_FONT}`;
  ctx.fillText('Τοποθετήστε τη λωρίδα πάνω στα στοιχεία της ράγας για έλεγχο.', 15 * s, (206 + H) * s);
}

/* ---------- Render σελίδας σε canvas ---------- */
function loadImage(src) {
  return new Promise(res => {
    if (!src) return res(null);
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function renderPage(page, dpi, ctxData, stats) {
  const s = dpi / MM_PER_IN;
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(page.w * s));
  cv.height = Math.max(1, Math.round(page.h * s));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  const st = ctxData.settings;
  page.els.forEach(el => {
    ctx.fillStyle = '#000';
    if (el.t === 'strip') drawStrip(ctx, s, el.x, el.y, el.cells, el.h, +st.unitMM, stats);
    else if (el.t === 'caption') {
      ctx.font = `400 ${2.6 * s}px ${LABEL_FONT}`;
      ctx.fillStyle = '#444';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(el.text, el.x * s, (el.y + 3) * s);
    } else if (el.t === 'header') {
      ctx.textBaseline = 'alphabetic';
      ctx.font = `700 ${3.4 * s}px ${LABEL_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(el.left, el.x * s, (el.y + 3.4) * s);
      ctx.font = `400 ${2.4 * s}px ${LABEL_FONT}`;
      ctx.fillStyle = '#555';
      ctx.textAlign = 'right';
      ctx.fillText(el.right, (el.x + el.w) * s, (el.y + 3.4) * s);
    } else if (el.t === 'note') {
      ctx.font = `400 ${3.4 * s}px ${LABEL_FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(el.text, el.x * s, el.y * s);
    } else if (el.t === 'sticker') { ctxLogoSize.v = st.logoSize || 100; drawSticker(ctx, s, el.x, el.y, el.w, el.h, ctxData.electrician, ctxData.logo, stats); }
    else if (el.t === 'calib') drawCalibration(ctx, s, st);
  });
  return cv;
}

/* ---------- PDF ---------- */
async function deflateBytes(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const stream = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch (e) { return null; }
}

async function canvasToPdfImage(cv, color) {
  const w = cv.width, h = cv.height;
  const px = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const n = color ? 3 : 1;
  const raw = new Uint8Array(w * h * n);
  if (color) {
    for (let i = 0, j = 0; i < px.length; i += 4) { raw[j++] = px[i]; raw[j++] = px[i + 1]; raw[j++] = px[i + 2]; }
  } else {
    for (let i = 0, j = 0; i < px.length; i += 4) raw[j++] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000 | 0;
  }
  const z = await deflateBytes(raw);
  if (z) return { w, h, filter: '/FlateDecode', cs: color ? '/DeviceRGB' : '/DeviceGray', data: z };
  const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95));
  return { w, h, filter: '/DCTDecode', cs: '/DeviceRGB', data: new Uint8Array(await blob.arrayBuffer()) };
}

/* pages: [{w,h,color,...}], renderFn(page) → canvas. Δημιουργεί PDF με ακριβές μέγεθος σελίδας σε mm. */
async function buildPdf(pages, renderFn) {
  const enc = new TextEncoder();
  const parts = [];
  const offs = [];
  let len = 0;
  const add = x => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const pt = mm => +(mm * 72 / MM_PER_IN).toFixed(3);

  add('%PDF-1.4\n');
  add(new Uint8Array([37, 226, 227, 207, 211, 10]));
  offs[1] = len; add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(' ');
  offs[2] = len; add(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>\nendobj\n`);

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const cv = await renderFn(p);
    const img = await canvasToPdfImage(cv, p.color);
    cv.width = cv.height = 1; // αποδέσμευση μνήμης
    const W = pt(p.w), H = pt(p.h), pn = 3 + 3 * i;
    offs[pn] = len;
    add(`${pn} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${pn + 2} 0 R >> >> /Contents ${pn + 1} 0 R >>\nendobj\n`);
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    offs[pn + 1] = len;
    add(`${pn + 1} 0 obj\n<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
    offs[pn + 2] = len;
    add(`${pn + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace ${img.cs} /BitsPerComponent 8 /Filter ${img.filter} /Length ${img.data.length} >>\nstream\n`);
    add(img.data);
    add('\nendstream\nendobj\n');
  }
  const total = 3 + 3 * pages.length;
  const xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  add(x);
  add(`trailer\n<< /Size ${total} /Root 1 0 R /Info << /Producer (EPC) >> >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}
