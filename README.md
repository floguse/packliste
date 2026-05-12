# Packliste

Eine kollaborative Packlisten-App für Reisen, entwickelt für Familien und Haushalte. Als Progressive Web App (PWA) lässt sie sich direkt auf dem iPhone-Homescreen installieren.

## Features

- **Reisen planen** – Neue Reisen mit Planungs-Wizard anlegen (Ziel, Datum, Teilnehmer, Dauer)
- **Gemeinsam packen** – Haushaltsmitglieder sehen Änderungen in Echtzeit (Supabase Realtime)
- **Kategorien & Artikel** – Vorgefertigte Kategorien mit 46 Startartikeln, vollständig anpassbar
- **Drag & Drop** – Artikel per Drag & Drop neu anordnen
- **Alles auswählen** – Alle Artikel einer Kategorie mit einem Klick abhaken
- **Archiv** – Abgeschlossene Reisen im Archiv einsehen
- **Einladungslinks** – Familienmitglieder per Link zum Haushalt einladen
- **PWA** – Installierbar auf iOS und Android, funktioniert wie eine native App

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| Backend / DB | Supabase (PostgreSQL + Auth + Realtime) |
| Drag & Drop | dnd-kit |
| Icons | Lucide React |
| Routing | React Router v6 |
| Deployment | Vercel |

## Lokale Entwicklung

### Voraussetzungen

- Node.js 18+
- Ein Supabase-Projekt (siehe [SETUP.md](SETUP.md))

### Installation

```bash
# Abhängigkeiten installieren
npm install

# .env-Datei anlegen
cp .env.example .env
# → VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY eintragen

# Dev-Server starten
npm run dev
```

Die App läuft dann unter `http://localhost:5173`.

### Build

```bash
npm run build
```

## Deployment

Die App wird über Vercel deployed. Jeder Push auf `main` löst automatisch ein neues Deployment aus.

Vollständige Schritt-für-Schritt-Anleitung (Supabase + Vercel + Auth-Konfiguration): [SETUP.md](SETUP.md)

## Projektstruktur

```
src/
├── components/
│   ├── auth/          # Login, Registrierung, Haushalt erstellen
│   ├── layout/        # Layout-Wrapper, Bottom-Navigation
│   ├── packing/       # Packlisten-Ansicht, Reise bearbeiten
│   ├── planning/      # Planungs-Wizard für neue Reisen
│   └── ui/            # Wiederverwendbare UI-Komponenten
├── contexts/          # Auth- und Haushalt-Context (React Context API)
├── lib/               # Supabase-Client
├── pages/             # Seitenkomponenten (Home, Archiv, Einstellungen, Einladung)
└── types/             # TypeScript-Typdefinitionen
supabase/
├── schema.sql         # Vollständiges Datenbankschema inkl. RLS & RPC-Funktionen
└── *.sql              # Migrations-Skripte
```

## Umgebungsvariablen

| Variable | Beschreibung |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL deines Supabase-Projekts |
| `VITE_SUPABASE_ANON_KEY` | Öffentlicher Anon-Key von Supabase |
