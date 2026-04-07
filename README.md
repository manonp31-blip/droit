# Analyseur de conformité e-commerce

Outil d'analyse de conformité juridique pour sites e-commerce français.

Vérifie automatiquement le respect du Code de la consommation, LCEN, loi Hamon, loi Toubon et RGPD, et génère un rapport scoré.

## Prérequis

- Node.js >= 18
- [Playwright](https://playwright.dev) avec Chromium : `npx playwright install chromium`
- Une clé API [Google AI Studio](https://aistudio.google.com)

## Installation

```bash
cp .env.example .env
# Ajouter votre clé API Google AI Studio dans .env
npx playwright install chromium   # si pas déjà installé
```

## Configuration

Éditez le fichier `.env` :

```
GOOGLE_API_KEY=votre_cle_api_ici
PORT=3000
```

## Lancement

```bash
node server.js
```

Ouvrir http://localhost:3000

## Utilisation

1. Entrez l'URL d'un site e-commerce français
2. Cliquez sur **Analyser**
3. Consultez le rapport de conformité (score global, détail par section, risques)
4. Exportez en PDF via le bouton dédié (ou Ctrl+P)

## Sections analysées

- Mentions légales (LCEN art. 6)
- Information précontractuelle (art. L221-5)
- Droit de rétractation (art. L221-18)
- Conditions Générales de Vente (art. 1127-1 C. civil)
- Garanties légales (art. L217-3 et s.)
- Processus de commande (art. L221-14)
- Langue française (loi Toubon 1994)
- Données personnelles (RGPD + loi Informatique et Libertés)

## Stack technique

- Node.js (http, https modules natifs — aucune dépendance npm requise)
- Playwright Chromium (scraping)
- Google Gemini Flash (analyse juridique IA via REST)
- HTML/CSS/JS vanilla (frontend)
