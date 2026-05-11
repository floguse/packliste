# Packliste – Setup-Anleitung

---

## Schritt 1: Supabase-Projekt anlegen

### 1.1 Konto & Projekt
1. Gehe zu [supabase.com](https://supabase.com) und melde dich an (kostenloser Free-Tier reicht).
2. Klicke auf **"New project"**.
3. Wähle deine Organization, vergib einen Projektnamen (z. B. `packliste`) und ein sicheres Datenbank-Passwort.
4. Wähle eine Region (z. B. **Frankfurt** für Deutschland).
5. Klicke **"Create new project"** – warte ca. 1–2 Minuten bis das Projekt bereit ist.

### 1.2 Datenbankschema ausführen
1. Klicke im linken Menü auf **"SQL Editor"**.
2. Klicke oben rechts auf **"New query"**.
3. Öffne die Datei `supabase/schema.sql` aus diesem Projekt.
4. Kopiere den gesamten Inhalt und füge ihn in den SQL-Editor ein.
5. Klicke auf **"Run"** (oder `Cmd+Enter`).
6. Prüfe unten im Ausgabebereich: Es sollte `Success. No rows returned` erscheinen – keine Fehler.

> **Wichtig:** Das Schema legt alle Tabellen, Row Level Security Policies und die drei RPC-Funktionen (`seed_household_data`, `accept_invitation`, `get_invitation_info`) an. Alles wird in einem einzigen Durchlauf erstellt.

### 1.3 API-Zugangsdaten kopieren
1. Klicke im linken Menü auf **"Project Settings"** (Zahnrad-Icon unten).
2. Klicke auf **"API"**.
3. Kopiere folgende zwei Werte – du brauchst sie in Schritt 2:
   - **Project URL** → sieht aus wie `https://abcdefghijkl.supabase.co`
   - **anon / public Key** → langer `eyJ...`-String unter "Project API keys"

---

## Schritt 2: Umgebungsvariablen setzen (`.env`)

1. Öffne das Projektverzeichnis auf deinem Rechner.
2. Erstelle eine Datei namens **`.env`** im Wurzelverzeichnis (neben `package.json`).
3. Füge folgende zwei Zeilen ein und ersetze die Platzhalter durch deine kopierten Werte:

```
VITE_SUPABASE_URL=https://abcdefghijkl.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

4. Speichere die Datei.
5. Starte den Dev-Server neu falls er läuft: `npm run dev`

> **Sicherheit:** Die `.env`-Datei ist bereits in `.gitignore` eingetragen und wird nicht in Git eingecheckt. Der `anon`-Key ist für den Browser bestimmt – er ist durch Row Level Security abgesichert und kann ruhig im Client-Code verwendet werden.

**Lokaler Test:**
```bash
npm install
npm run dev
```
Öffne `http://localhost:5173` – du solltest den Login-Screen sehen. Registriere einen Test-Account.

---

## Schritt 3: GitHub-Repository & Vercel-Deployment

### 3.1 GitHub Repository erstellen
1. Gehe zu [github.com](https://github.com) → **"New repository"**.
2. Vergib einen Namen (z. B. `packliste`), wähle **Private** oder Public.
3. Klicke **"Create repository"**.
4. Führe im Projektverzeichnis folgende Befehle aus:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/DEIN-USERNAME/packliste.git
git push -u origin main
```

### 3.2 Vercel verbinden
1. Gehe zu [vercel.com](https://vercel.com) und melde dich an (kostenlos).
2. Klicke auf **"Add New… → Project"**.
3. Wähle **"Import Git Repository"** und wähle dein `packliste`-Repo aus.
   - Falls Vercel noch keinen GitHub-Zugriff hat: Klicke auf **"Adjust GitHub App Permissions"** und erteile den Zugriff.
4. Vercel erkennt automatisch, dass es sich um ein **Vite**-Projekt handelt. Die Build-Einstellungen sind korrekt vorausgefüllt:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### 3.3 Umgebungsvariablen in Vercel setzen
1. Klappe auf der Import-Seite den Abschnitt **"Environment Variables"** auf (noch vor dem ersten Deploy).
2. Füge die zwei Variablen hinzu:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://abcdefghijkl.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGci...` |

3. Klicke **"Deploy"**.
4. Warte ca. 1–2 Minuten – Vercel baut und deployed die App.
5. Am Ende bekommst du eine URL wie `https://packliste-xyz.vercel.app` → das ist deine Live-App.

> **Tipp:** Bei jedem `git push` auf den `main`-Branch wird automatisch ein neues Deployment ausgelöst.

---

## Schritt 4: Supabase Auth konfigurieren

### 4.1 Site URL setzen
1. Gehe zurück zu deinem Supabase-Projekt.
2. Klicke im linken Menü auf **"Authentication"**.
3. Klicke auf **"URL Configuration"**.
4. Trage unter **"Site URL"** deine Vercel-URL ein:
   ```
   https://packliste-xyz.vercel.app
   ```
5. Klicke **"Save"**.

### 4.2 Redirect URLs erlauben
Ebenfalls unter **"URL Configuration"** → **"Redirect URLs"**:

1. Klicke auf **"Add URL"** und füge folgende URLs hinzu:
   ```
   https://packliste-xyz.vercel.app/**
   http://localhost:5173/**
   ```
2. Klicke **"Save"**.

> Diese URLs werden für den Passwort-Reset-Link und den Einladungsflow benötigt. Ohne diese Einträge schlägt die Weiterleitung nach dem Klicken auf einen E-Mail-Link fehl.

### 4.3 E-Mail-Bestätigung (optional)
Standardmäßig müssen Nutzer ihre E-Mail-Adresse bestätigen, bevor sie sich anmelden können. Für den Start (z. B. für Familie/Freunde) kannst du das deaktivieren:

1. **"Authentication" → "Providers" → "Email"**
2. Deaktiviere **"Confirm email"** falls du keine Bestätigungs-E-Mails möchtest.
3. Klicke **"Save"**.

---

## Alles fertig – erster Login

1. Öffne deine Vercel-URL im Browser oder auf dem iPhone.
2. Klicke **"Noch kein Konto? Registrieren"**.
3. Lege einen Account mit E-Mail + Passwort an.
4. Nach dem Login wirst du aufgefordert, einen **Haushalt** zu erstellen (z. B. „Familie Müller").
5. Nach der Erstellung sind automatisch **10 Kategorien** und **46 Artikel** als Startdaten angelegt.
6. Weitere Familienmitglieder einladen: **Einstellungen → Haushalt → Einladungslink generieren**.

### App auf dem iPhone-Homescreen installieren
1. Öffne die App-URL in **Safari** auf dem iPhone.
2. Tippe unten auf das **Teilen-Symbol** (Rechteck mit Pfeil nach oben).
3. Wische nach unten und tippe auf **"Zum Home-Bildschirm"**.
4. Bestätige mit **"Hinzufügen"**.

Die App ist jetzt als eigenständige App installiert – ohne Browser-Adressleiste, mit eigenem Icon.

---

## Fehlerbehebung

| Problem | Lösung |
|---------|--------|
| Leere Seite nach Login | Prüfe ob `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in Vercel gesetzt sind |
| „Invalid API key" Fehler | Anon Key nochmals aus Supabase → Settings → API kopieren |
| Einladungslink funktioniert nicht | Redirect URL in Supabase Auth → URL Configuration prüfen |
| Passwort-Reset-Mail kommt nicht an | Spam-Ordner prüfen; in Supabase Auth → Logs nachschauen |
| Realtime-Sync funktioniert nicht | Prüfe ob `supabase_realtime` Publication in schema.sql ausgeführt wurde |
| Build schlägt in Vercel fehl | Vercel Logs prüfen; häufigste Ursache: fehlende Env-Variablen |
