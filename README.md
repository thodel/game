# 🏟️ Sports Career Game

Browserbasiertes Karriere-Spiel für Fussball ⚽ und Basketball 🏀.

## Spielen

**Online spielen: https://thodel.github.io/game/**

Lokal: `index.html` lädt ES-Module, also mit einem statischen Server öffnen, z. B. `python3 -m http.server` und dann http://localhost:8000.

## Gameplay

- Wähle eine Sportart und erstelle deinen Spieler
- Trainiere Skills, spiele Matches, verdiene Geld
- Steuere animierte Fussballspieler per Touch-Gamepad (iPad) oder mit WASD/Pfeiltasten, Shift und Leertaste
- Erlebe vor jedem Fussballspiel den Einlauf beider Teams in ein animiertes Flutlichtstadion
- Spiele 11 gegen 11 in einer perspektivischen 3D-Kamera mit Formationen, Rollen und tiefenskalierter Darstellung
- Basketballspiele werden weiterhin als kompakte Match-Simulation ausgewertet
- Steige durch 7 Ligen auf – von der Kreisliga bis zur Champions League / NBA
- Schalte Achievements frei
- Spielstand wird automatisch im Browser gespeichert

## Technologie

Reines HTML/CSS/JavaScript – keine Dependencies, kein Build-Step.

## Development

```bash
npm install
npm test      # run tests
npm run build # optional build step
```

[![CI](https://github.com/thodel/game/actions/workflows/ci.yml/badge.svg)](https://github.com/thodel/game/actions/workflows/ci.yml)
