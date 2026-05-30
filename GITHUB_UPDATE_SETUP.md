# Kolbasz Launcher GitHub update setup

## 1. Repo letrehozasa

1. Menj ide: https://github.com/new
2. Repository name: `Launcher-Kolbasz`
3. Visibility: Public
4. Create repository

## 2. Projekt feltoltese

Nyiss PowerShellt a launcher mappajaban, majd:

```powershell
git init
git add .
git commit -m "Initial Kolbasz Launcher release"
git branch -M main
git remote add origin https://github.com/FELHASZNALONEV/Launcher-Kolbasz.git
git push -u origin main
```

A `FELHASZNALONEV` reszt csereld ki a sajat GitHub nevedre.

## 3. Elso release

1. GitHub repo oldalan: Releases
2. Draft a new release
3. Tag: `v1.0.0`
4. Title: `Kolbasz Launcher 1.0.0`
5. Upload asset: `dist/Kolbasz.Launcher.Setup.exe`
6. Publish release

## 4. Update manifest link beallitasa

Az `assets/update-source.json` fajlban a `manifestUrl` legyen ez:

```json
{
  "manifestUrl": "https://raw.githubusercontent.com/FELHASZNALONEV/Launcher-Kolbasz/main/updates/latest.json"
}
```

A `FELHASZNALONEV` reszt itt is csereld ki.

## 5. Uj launcher verzio kiadasa

1. Noveld a `package.json` verziojat, peldaul `1.0.1`-re.
2. Buildeld ujra:

```powershell
npm run dist:win
```

3. GitHubon hozz letre uj release-t:
   - Tag: `v1.0.1`
   - Asset: `dist/Kolbasz.Launcher.Setup.exe`

4. Ird at az `updates/latest.json` fajlt:

```json
{
  "version": "1.0.1",
  "url": "https://github.com/FELHASZNALONEV/Launcher-Kolbasz/releases/download/v1.0.1/Kolbasz%20Launcher%20Setup.exe"
}
```

5. Commit + push:

```powershell
git add updates/latest.json package.json
git commit -m "Release 1.0.1"
git push
```

Ezutan a haveroknal az UPDATE gomb mar latni fogja az uj verziot.
