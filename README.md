# Analyseur de conformité e-commerce

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Flash-4285F4?logo=google&logoColor=white)
![Playwright](https://img.shields.io/badge/Playwright-Chromium-2EAD33?logo=playwright&logoColor=white)
![Licence](https://img.shields.io/badge/Licence-MIT-lightgrey)

> Outil d'audit juridique automatisé pour sites e-commerce français.  
> Entrez une URL — recevez en moins d'une minute un rapport de conformité scoré selon le droit français.

---

## Ce que fait l'outil

Il visite automatiquement les pages légales du site (mentions légales, CGV, politique de confidentialité, livraison…), extrait leur contenu, et soumet l'ensemble à une analyse IA spécialisée en droit du commerce électronique français.

**Lois vérifiées :** Code de la consommation · LCEN · Loi Hamon · Loi Toubon · RGPD

---

## Exemple de rapport généré

```
┌─────────────────────────────────────────────────────────────┐
│  Score global : 68 / 100   —   Conformité partielle         │
│  Analysé le : 7 avril 2026  ·  URL : www.exemple.fr         │
└─────────────────────────────────────────────────────────────┘

 Section                                       Score   Statut
─────────────────────────────────────────────────────────────
 Mentions légales (LCEN art. 6)                  45    ⚠ Risqué
 Information précontractuelle (art. L221-5)      80    ✓ Conforme
 Droit de rétractation (art. L221-18)            70    ✓ Conforme
 CGV (art. 1127-1 C. civil)                      75    ✓ Conforme
 Garanties légales (art. L217-3)                 60    ⚠ Partiel
 Processus de commande (art. L221-14)            55    ⚠ Partiel
 Langue française (loi Toubon 1994)              90    ✓ Conforme
 Données personnelles (RGPD)                     50    ⚠ Risqué

 Risques principaux : Mentions légales incomplètes (amende jusqu'à
 375 000 €). Bandeau cookies sans consentement explicite (CNIL).

 Points positifs : Prix TTC affichés · CGV accessibles · Site en français
```

---

## Sections analysées

| # | Section | Référence légale | Sanction max |
|---|---------|-----------------|--------------|
| 1 | Mentions légales | LCEN art. 6 | 375 000 € |
| 2 | Information précontractuelle | Art. L221-5 C. conso | 15 000 € |
| 3 | Droit de rétractation | Art. L221-18 C. conso | Délai étendu à 12 mois |
| 4 | Conditions Générales de Vente | Art. 1127-1 C. civil | Nullité du contrat |
| 5 | Garanties légales | Art. L217-3 et s. | 75 000 € |
| 6 | Processus de commande | Art. L221-14 C. conso | Nullité de commande |
| 7 | Langue française | Loi Toubon 1994 | 1 500 € |
| 8 | Données personnelles | RGPD + Loi Informatique et Libertés | 20 M€ ou 4% CA |

---

## Interface web

- **Jauge SVG** animée affichant le score global (0–100), colorée selon le niveau de risque
- **Cartes accordéon** par section : titre, score, items détaillés au clic
- **Badges colorés** par gravité : 🟢 mineur · 🟠 majeur · 🔴 bloquant
- **Résumé des risques** et **points positifs** en bas de rapport
- **Export PDF** en un clic (impression navigateur)

---

## Prérequis

- Node.js >= 18
- Playwright avec Chromium : `npx playwright install chromium`
- Une clé API [Google AI Studio](https://aistudio.google.com) (gratuite)

---

## Installation & lancement

```bash
# 1. Cloner le dépôt
git clone https://github.com/manonp31-blip/droit.git
cd droit

# 2. Configurer la clé API
cp .env.example .env
#    → éditer .env et renseigner GOOGLE_API_KEY=...

# 3. Installer Playwright si besoin
npx playwright install chromium

# 4. Lancer le serveur
node server.js

# 5. Ouvrir dans le navigateur
#    http://localhost:3000
```

---

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Serveur | Node.js (modules natifs `http`/`https`, sans dépendances npm) |
| Scraping | Playwright Chromium (headless, 15s timeout/page) |
| Analyse IA | Google Gemini Flash (API REST) |
| Frontend | HTML/CSS/JS vanilla (sans framework) |
