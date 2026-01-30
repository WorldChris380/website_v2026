# Farbprofil CI/CD 2026

Dieses Dokument beschreibt das neue Farbprofil für das Projekt.

## 📋 Übersicht

Das neue Farbprofil folgt einem bereichsspezifischen Ansatz mit jeweils 3 Variationen (Haupt-, Helle und Dunkle Variante) für jeden Bereich.

## 🎨 Farbpalette

### Hauptfarben

| Bereich | Variable | Hex-Wert | Verwendung |
|---------|----------|----------|------------|
| Career | `$career-black` | `#0b0b0dff` | Hauptfarbe für Career-Bereich, Header, Footer |
| Shop | `$shop-blue` | `#2f3740ff` | Shop-Komponenten und E-Commerce |
| Aviation | `$aviation-blue` | `#2171a6ff` | Luftfahrt-Bereich und Aviation-Komponenten |
| Travel | `$travel-green` | `#659968ff` | Reise-Bereich und Travel-Komponenten |
| Photography | `$photography-orange` | `#ffb300ff` | Fotografie-Bereich und Gallery |
| Warning | `$warning-red` | `#fa003eff` | Fehler, Warnungen, kritische Aktionen |

### Helle Variationen

Für Text auf dunklem Hintergrund, Hover-Effekte, Highlights:

| Bereich | Variable | Hex-Wert |
|---------|----------|----------|
| Career | `$career-black-bright` | `#cbcbd2ff` |
| Shop | `$shop-blue-bright` | `#d1d7ddff` |
| Aviation | `$aviation-blue-bright` | `#cbe4f5ff` |
| Travel | `$travel-green-bright` | `#e0ebe1ff` |
| Photography | `$photography-orange-bright` | `#fff0ccff` |
| Warning | `$warning-red-bright` | `#ffcbd8ff` |

### Dunkle Variationen

Für Hintergründe, Schatten, Dark Mode:

| Bereich | Variable | Hex-Wert |
|---------|----------|----------|
| Career | `$career-black-dark` | `#131316ff` |
| Shop | `$shop-blue-dark` | `#121519ff` |
| Aviation | `$aviation-blue-dark` | `#071926ff` |
| Travel | `$travel-green-dark` | `#121c13ff` |
| Photography | `$photography-orange-dark` | `#2e2000ff` |
| Warning | `$warning-red-dark` | `#2e000bff` |

## 📦 Verwendung

### In SCSS-Dateien

```scss
@use '../_colors.scss' as *;
// oder
@use '../../styles.scss' as *;

.my-component {
    background-color: $aviation-blue;
    color: $aviation-blue-bright;
    
    &:hover {
        background-color: $aviation-blue-dark;
    }
}
```

### CSS Custom Properties

Alle Farben sind auch als CSS Custom Properties verfügbar:

```css
.my-element {
    background-color: var(--aviation-blue);
    color: var(--aviation-blue-bright);
}
```

### Dark Mode

Im Dark Mode werden automatisch die hellen Varianten für Text verwendet:

```scss
body.dark-mode {
    background-color: $career-black-dark;
    color: $career-black-bright;
}
```

## 🔄 Migration von alten Farben

### Mapping der alten Variablen

Für Kompatibilität wurden die alten Variablen auf die neuen gemappt:

| Alt | Neu |
|-----|-----|
| `$cb-grey-ish` | `$career-black` |
| `$cb-green-ish` | `$photography-orange` |
| `$cb-dark-green-ish` | `$travel-green` |
| `$cb-blue-ish` | `$aviation-blue` |
| `$cb-career-grey` | `$career-black` |
| `$cb-orange-ish` | `$photography-orange-bright` |
| `$cb-red-ish` | `$warning-red` |

## 📍 Verwendungsrichtlinien

### Career/Hauptbereich
- Header, Footer, Navigationsleiste
- Haupttexte und Standard-Elemente
- Farbe: `$career-black`

### Shop
- Shop-Komponenten, Warenkorb, Checkout
- Produkt-Cards
- Farbe: `$shop-blue`

### Aviation
- Aviation-Spotter-Hotels
- Luftfahrt-Galerie
- Aviation-bezogene Inhalte
- Farbe: `$aviation-blue`

### Travel
- Reise-Seiten, Reise-Galerie
- Länder-Karten, Reiseberichte
- Farbe: `$travel-green`

### Photography
- Photography-Galerie, Fotografie-Bereiche
- Bild-Highlights und Foto-bezogene Elemente
- Farbe: `$photography-orange`

### Warnings/Errors
- Fehlermeldungen, Validierungsfehler
- Kritische Aktionen, Delete-Buttons
- Farbe: `$warning-red`

## ✅ Checkliste für Migration

- [x] Neue Farbvariablen in `styles.scss` definiert
- [x] CSS Custom Properties erstellt
- [x] Dark Mode Farben angepasst
- [x] Header und Footer aktualisiert
- [ ] Alle Component-SCSS-Dateien aktualisiert
- [ ] Gradient-Definitionen angepasst
- [ ] Inline-Styles in HTML-Dateien geprüft

## 🔍 Weitere Informationen

Siehe `_colors.scss` für die vollständige Farbdefinition und Kommentare.
