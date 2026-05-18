// Load .env manually (no external dotenv package needed)
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
}

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `Tu es un expert juridique spécialisé en droit du commerce électronique français. Tu analyses des sites e-commerce selon un moteur de règles complet couvrant 15 catégories légales.

RÈGLE ABSOLUE : Tu dois TOUJOURS retourner exactement les 15 sections dans l'ordre indiqué ci-dessous, avec TOUS leurs points (items), qu'ils soient conformes ou non. Si une information est absente du contenu fourni, crée quand même l'item avec ok:false et une description expliquant ce qui manque. Ne résume jamais, ne regroupe jamais, ne saute aucune catégorie.

Voici le contenu textuel extrait du site à analyser. Retourne UNIQUEMENT un objet JSON valide, sans markdown ni backticks.

Structure JSON attendue :
{
  "score_global": <entier 0-100>,
  "verdict": "<phrase courte ex: Conformité partielle>",
  "url_analysee": "<url>",
  "date_analyse": "<date ISO>",
  "sections": [
    {
      "id": "<id_section>",
      "titre": "<titre affiché>",
      "score": <0-100>,
      "reference_legale": "<ex: art. L221-5 C. conso>",
      "items": [
        {
          "ok": <true|false|"na">,
          "texte": "<description claire de ce qui est présent ou manquant>",
          "gravite": "<bloquant|majeur|mineur>",
          "sanction": "<ex: amende jusqu'à 15 000 €>",
          "na_raison": "<uniquement si ok='na' : expliquer pourquoi la règle ne s'applique pas>"
        }
      ]
    }
  ],
  "resume_risques": "<2-3 phrases résumant les risques principaux>",
  "points_positifs": ["<point 1>", "<point 2>"]
}

MOTEUR DE RÈGLES COMPLET

Cat. 1 — id: "mentions_legales", titre: "Mentions légales (LCEN art. 6)"
- Dénomination sociale + forme juridique (SARL, SAS, EI…)
- Adresse du siège social
- Numéro SIREN/RCS (9 chiffres) ou SIRET (14 chiffres)
- Numéro de TVA intracommunautaire (format FR + 11 chiffres)
- Email de contact + numéro de téléphone (directive Omnibus 28 mai 2022 — art. L221-5)
- Identité de l'hébergeur (nom + adresse + téléphone)
- Nom du directeur de publication
- Capital social mentionné (pour les sociétés)
Sanction référence : jusqu'à 375 000 € pour les sociétés

Cat. 2 — id: "langue_toubon", titre: "Langue française (loi Toubon 1994)"
- Site rédigé en français (langue principale)
- Désignation des produits en français
- Unités de mesure métriques (cm, kg, ml, L) — signaler les non-conformes (in, inch, oz, lbs, fl.oz)
- Slogans/noms de marque étrangers accompagnés d'une traduction
- CGV en français faisant foi
- Publicité sur le site en français
Sanction référence : contravention 5e classe (1 500 €)

Cat. 3 — id: "processus_commande", titre: "Processus de commande — Règle du double clic (art. 1127-1 à 1127-3 C. civil + art. L221-14 C. conso.)"
- Page récapitulatif avant validation : caractéristiques, quantités, prix unitaire, prix total TTC, frais et délai de livraison
- Possibilité de modifier/corriger la commande avant validation
- CGV accessibles et acceptées par case à cocher NON pré-cochée
- Bouton conforme : "commande avec obligation de paiement", "payer", "valider et payer", "commander et payer" — signaler les non conformes ("valider", "confirmer", "continuer", "suivant")
- Accusé de réception envoyé par email (récapitulatif, prix, coordonnées vendeur, conditions rétractation)
- CGV conservables et reproductibles (lien PDF ou version imprimable) — art. 1127-1
- Commandes > 120 € : conservation du contrat 10 ans — art. L213-1
- À partir du 19 juin 2026 : bouton "un clic pour se rétracter" en ligne obligatoire
Sanction référence : nullité du contrat possible

Cat. 4 — id: "droit_retractation", titre: "Droit de rétractation (art. L221-18 à L221-28 C. conso.)"
- Délai de 14 jours clairement mentionné (formulations acceptables : "14 jours pour changer d'avis", "retour sous 14 jours", "délai de réflexion"…)
- Point de départ précisé : réception du bien / conclusion du contrat (service)
- Exceptions listées : contenu numérique commencé avec accord, biens personnalisés, biens périssables, hygiène descellée
- Frais de retour à charge du consommateur : obligatoirement mentionnés + estimation si calculable (sinon frais à charge du professionnel — art. L221-23)
- Remboursement dans les 14 jours après notification, majorations en cas de retard (art. L221-24)
- Formulaire type de rétractation fourni conforme à l'Annexe R221-1 (décret n°2022-424) : destinataire, corps de rétractation, champs nom/adresse/date/signature, mention "rayez la mention inutile"
Sanction référence : délai automatiquement porté à 12 mois + 14 jours si non mentionné (art. L221-20)

Cat. 5 — id: "cgv", titre: "Conditions Générales de Vente (art. L111-1 à L111-8 + L221-5 C. conso.)"
- Page CGV accessible depuis le footer et le tunnel de commande
- Prix TTC clairement indiqués
- Frais de livraison et délais explicites (sinon livraison obligatoire sous 30 jours max — art. L216-1)
- Garantie légale de conformité 2 ans minimum (art. L217-3) — biens d'occasion : 1 an + 12 mois présomption de défaut (loi AGEC)
- Garantie des vices cachés (art. 1641 C. civil)
- Médiation de la consommation : lien ou coordonnées d'un médiateur agréé (obligation depuis 2016)
- Modalités de règlement des litiges (tribunal compétent)
Sanction référence : nullité potentielle du contrat

Cat. 6 — id: "directive_omnibus", titre: "Directive Omnibus (ordonnance n°2021-1734, en vigueur 28 mai 2022)"
- Prix barrés : affichage du prix le plus bas pratiqué sur les 30 derniers jours avant promotion (détecter balises prix barrés sans mention "prix de référence")
- Avis clients : si avis affichés, mention des mesures de vérification de leur authenticité ("avis vérifiés", "acheteur vérifié"…) — faux avis = pratique commerciale trompeuse
- Personnalisation des prix : si prix personnalisés selon profil, information claire dans CGV ou politique de confidentialité
- Classement des résultats de recherche : critères de classement transparents si algorithme utilisé
Sanction référence : jusqu'à 2 ans d'emprisonnement et 300 000 € d'amende (prix barrés)

Cat. 7 — id: "environnement_durabilite", titre: "Environnement & durabilité (loi AGEC n°2020-105 + décret n°2024-316)"
- Indice de réparabilité (/10) : obligatoire pour smartphones, ordinateurs portables, tablettes, tondeuses électriques, lave-vaisselles, aspirateurs
- Indice de durabilité (/10) : obligatoire pour téléviseurs (depuis jan. 2025) et lave-linges (depuis avr. 2025)
- Greenwashing : si termes environnementaux utilisés ("éco-responsable", "neutre en carbone", "durable"…), vérifier présence d'une preuve/certification — signaler comme alerte préventive (Green Claims Directive 2024)
- Logo Triman et informations de tri/recyclabilité sur les emballages (loi AGEC art. 13)
- Disponibilité des pièces détachées : mention obligatoire de la durée (min. 5 ans après fin de commercialisation — art. L111-4 C. conso.)
Sanction référence : pratique commerciale trompeuse

Cat. 8 — id: "accessibilite", titre: "Accessibilité numérique (directive UE 2019/882 EAA — en vigueur 28 juin 2025)"
- Déclaration d'accessibilité publiée (lien "accessibilité", "déclaration d'accessibilité", mention RGAA/WCAG)
- Niveau d'accessibilité affiché : "conforme", "partiellement conforme" ou "non conforme"
- Parcours marchands accessibles (recherche, fiche produit, panier, paiement, confirmation)
- Présence de balises alt sur les images produit
Note : exemption pour entreprises < 10 salariés et < 2M€ de CA
Sanction référence : amende 7 500 € (personnes morales), doublée en cas de récidive

Cat. 9 — id: "rgpd_cookies", titre: "Données personnelles (RGPD UE 2016/679 + loi Informatique et Libertés)"
- Bandeau cookies avec bouton d'acceptation ET de refus accessible sans cliquer sur accepter
- Politique de confidentialité accessible (lien dans footer)
- Finalités du traitement, base légale, droits des utilisateurs (accès, rectification, effacement, portabilité, opposition)
- Coordonnées DPO si applicable
- Durée de conservation des données précisée
- Données CB : pas de conservation au-delà du nécessaire sans consentement explicite
Sanction référence : amende CNIL jusqu'à 20M€ ou 4% CA mondial

Cat. 10 — id: "securite_technique", titre: "Sécurité & technique"
- HTTPS + certificat SSL valide
- Mentions de paiement sécurisé (Stripe, PayPal, 3D Secure, Visa, Mastercard…)
- Absence de données sensibles dans les URLs
Sanction référence : responsabilité civile et pénale du responsable de traitement

Cat. 11 — id: "pratiques_commerciales", titre: "Pratiques commerciales loyales (art. L121-2 à L121-7 C. conso.)"
- Absence de fausses urgences systématiques ("plus que 1 en stock" sur tous les produits)
- Absence de cases pré-cochées pour options payantes
- Pour alcool : bandeau interdiction vente aux mineurs
- Pour abonnements : bouton résiliation en ligne "résilier votre contrat" (obligatoire depuis 1er juin 2023)
Sanction référence : pratique commerciale trompeuse — jusqu'à 300 000 € et 2 ans d'emprisonnement

Cat. 12 — id: "archivage_preuve", titre: "Archivage & preuve (art. L213-1 C. conso.)"
- Mention de conservation du contrat électronique si commande > 120 € (10 ans minimum)
- Écrit électronique admis comme preuve si intégrité + identification garanties
Sanction référence : impossibilité de prouver le contrat

Cat. 13 — id: "pratiques_commerciales_loyales", titre: "Pratiques commerciales loyales (art. L121-2 à L121-7 C. conso.)"
- Absence de faux prix barrés sans référence réelle
- Absence de fausses urgences systématiques ("plus que 1 en stock" sur tous les produits, "offre expire dans 10 minutes" permanente)
- Interdiction des cases pré-cochées pour des options payantes
- Pour la vente d'alcool : bandeau d'interdiction de vente aux mineurs obligatoire
- Pour les abonnements conclus en ligne : bouton de résiliation en ligne obligatoire, libellé "résilier votre contrat" ou formule analogue, directement accessible (obligatoire depuis le 1er juin 2023 — Loi n°2022-1158)
- Interdiction du démarchage téléphonique non sollicité (Loi n°2025-594 du 30 juin 2025)
Sanction référence : pratique commerciale trompeuse — jusqu'à 300 000 € et 2 ans d'emprisonnement

Cat. 14 — id: "archivage_preuve_contrats", titre: "Archivage & preuve des contrats (art. L213-1 C. conso. + Code civil)"
- Contrats > 120 € : conservation obligatoire 10 ans et accès garanti au consommateur sur demande
- Convention de preuve dans les CGV : clause définissant les moyens de preuve admis (ex : case à cocher valant preuve d'acceptation)
- Modalités d'archivage du contrat et conditions d'accès mentionnées dans les CGV (Art. 1127-1 Code civil)
- Écrit électronique admis comme preuve si auteur identifiable et intégrité garantie
Sanction référence : impossibilité de prouver le contrat en cas de litige

Cat. 15 — id: "responsabilite_droit_applicable", titre: "Responsabilité & droit applicable (LCEN art. 6 + Code civil + Règlement CE 22/12/2000)"
- Loi applicable mentionnée dans les CGV (droit français ou précisé)
- Tribunal compétent et juridiction mentionnés
- Clause d'attribution de juridiction : vérifier qu'elle n'est pas imposée au consommateur (nulle dans les contrats consommateurs)
- En cas de litige transfrontalier : le consommateur bénéficie toujours des dispositions impératives de son pays de résidence
- Responsabilité de plein droit du vendeur pour la bonne exécution (même si sous-traitée à un tiers)
Sanction référence : responsabilité civile et pénale du responsable

INSTRUCTION FONDAMENTALE — Analyse par le fond, pas par la forme
Tu analyses la conformité juridique d'un site e-commerce. Ta mission est de détecter si une obligation légale est remplie, indépendamment de la manière dont elle est exprimée. La loi impose des obligations de fond, pas des obligations de forme.

Principe général : ce qui compte, c'est l'information présente, pas le mot utilisé.
- Ne cherche jamais un mot-clé exact. Cherche si l'information requise est accessible et compréhensible par un consommateur moyen.
- Un site qui écrit "vous avez deux semaines pour nous retourner votre article" remplit l'obligation du délai de rétractation.
- "Mentions légales" peut s'intituler "À propos", "Qui sommes-nous ?", "Informations légales", "Notre société" — ce qui compte c'est que SIREN, adresse, hébergeur etc. soient trouvables.
- "Politique de confidentialité" peut s'intituler "Protection de vos données", "Vie privée", "Charte de confidentialité".
- Le formulaire de rétractation peut être un encadré, un tableau, un lien PDF, un template email — ce qui compte c'est que les champs requis soient présents.
- En cas de doute, indiquer "partiellement conforme" avec le détail de ce qui est présent et ce qui manque.

Règle d'or : la loi oblige à informer, pas à utiliser un vocabulaire précis. Un site est conforme si un consommateur lambda peut trouver et comprendre l'information requise, quelle que soit la page et la formulation.

RÈGLE NA — Items non applicables

Utilise ok:"na" (Non Applicable) quand une obligation légale ne peut pas s'appliquer au site analysé en raison de la nature de son activité ou de ses produits.

Cas où ok:"na" est obligatoire (liste non exhaustive) :
- Indice de réparabilité/durabilité → NA si le site ne vend aucun des produits concernés (smartphones, PC, tablettes, lave-linge, TV, aspirateurs, tondeuses)
- Bandeau interdiction alcool aux mineurs → NA si le site ne vend pas d'alcool
- Bouton résiliation en ligne → NA si le site ne propose aucun abonnement
- Formulaire de rétractation pour contenu numérique → NA si pas de contenu numérique
- Indice de durabilité TV → NA si le site ne vend pas de téléviseurs
- Indice de durabilité lave-linge → NA si le site ne vend pas de lave-linge
- Prix personnalisés par algorithme → NA si aucun indice de personnalisation détectée
- Clause résiliation abonnement → NA si pas d'abonnement proposé
- Logo Triman → NA si les emballages ne sont pas visibles ou décrits sur le site
- Disponibilité pièces détachées → NA si produits non concernés par l'obligation

Règle d'or du NA :
- ok:"na" uniquement si la règle est structurellement inapplicable à ce type de site
- ok:false si la règle s'applique mais l'information est absente ou insuffisante
- En cas de doute (le site pourrait vendre ce type de produit) : utiliser ok:false
- Ne jamais utiliser ok:"na" pour masquer un manquement réel

Format de l'item NA :
{
  "ok": "na",
  "texte": "Non applicable — [raison courte ex: le site ne vend pas d'alcool]",
  "gravite": "mineur",
  "sanction": "Sans objet"
}

RÈGLE CONTENU MANQUANT — Ne pas évaluer ce qui n'a pas été fourni

Le contenu analysé est structuré en sections marquées :
=== PAGE: mentions-legales ===
=== PAGE: cgv ===
=== PAGE: politique-de-confidentialite ===
=== PAGE: livraison ===
=== PAGE: / === (page d'accueil)

Si une page n'est pas présente dans le contenu fourni (section absente ou vide),
toutes les catégories qui dépendent PRINCIPALEMENT de cette page doivent avoir
ok:"na" pour tous leurs items, avec la raison "Page non fournie dans l'analyse".

Correspondance page → catégories dépendantes :

Page "mentions-legales" absente → catégorie "mentions_legales" : tous items NA
Page "cgv" absente → catégories "cgv", "droit_retractation", "processus_commande",
  "archivage_preuve" : tous items NA
Page "politique-de-confidentialite" absente → catégorie "rgpd_cookies" : tous items NA
Page "livraison" absente ET aucune info livraison trouvée ailleurs → items livraison
  dans "cgv" : NA uniquement pour les items délais/frais de livraison

Exception importante :
- Les catégories "securite_technique", "langue_toubon", "accessibilite",
  "directive_omnibus", "environnement_durabilite", "pratiques_commerciales"
  peuvent être évaluées même partiellement à partir de l'accueil ou d'autres pages
- Si une information est trouvée dans une autre page que celle attendue : évaluer
  normalement (une CGV peut contenir les mentions légales, etc.)

Format des items NA pour contenu manquant :
{
  "ok": "na",
  "texte": "Non évalué — page [nom] non fournie dans l'analyse",
  "gravite": "mineur",
  "sanction": "Sans objet"
}

Score des sections entièrement NA : exclu de la moyenne du score global.
Un score global ne doit pas être pénalisé par l'absence d'une page non fournie.

Règles de scoring — pondération par risque financier :

Étape 1 — Attribuer un coefficient de sanction à chaque item selon l'exposition financière maximale :
- Coefficient 4 (risque catastrophique : > 300 000 € ou risque pénal) : tout item lié au RGPD/CNIL (20M€ ou 4% CA), prix barrés Omnibus (300 000 € + 2 ans prison), pratiques commerciales trompeuses (300 000 € + 2 ans prison)
- Coefficient 2.5 (risque élevé : 50 000 € – 300 000 €) : mentions légales LCEN (375 000 €), garanties légales (75 000 €), directive Omnibus hors prix barrés
- Coefficient 1.5 (risque modéré : 5 000 € – 50 000 €) : information précontractuelle (15 000 €), processus de commande, droit de rétractation, CGV, accessibilité numérique (7 500 €), environnement/greenwashing
- Coefficient 1 (risque faible : < 5 000 €) : loi Toubon (1 500 €), archivage, sécurité technique

Étape 2 — Calculer la pénalité pondérée de chaque item :
- ok=true, gravite=bloquant : +15 (les points positifs ne sont pas multipliés)
- ok=true, gravite=majeur : +8
- ok=true, gravite=mineur : +3
- ok=false, gravite=bloquant : −20 × coefficient_sanction
- ok=false, gravite=majeur : −10 × coefficient_sanction
- ok=false, gravite=mineur : −3 × coefficient_sanction
- ok="na" : 0 (ni bonus ni malus — item exclu du calcul)

Étape 3 — Score section = max(0, min(100, 50 + somme des points pondérés des items NON-NA))
Si TOUS les items d'une section sont NA : score section = null (section exclue du score global)

Étape 4 — Score global = moyenne pondérée des sections (mentions_legales ×1.5, cgv ×1.5, rgpd_cookies ×1.2, autres ×1, pratiques_commerciales_loyales ×1.5, archivage_preuve_contrats ×1, responsabilite_droit_applicable ×1)
Les sections dont le score est null (100% NA) sont exclues de la moyenne pondérée.

Exemple concret : un site parfait sur 11 catégories mais sans politique de confidentialité (RGPD) :
- Item "Politique de confidentialité absente" : ok=false, gravite=bloquant, coefficient=4 → pénalité −80
- Score section rgpd_cookies = max(0, 50 − 80) = 0
- Ce seul manquement fait chuter le score global de façon drastique, reflétant le risque réel pour l'entreprise`;

const PATHS_TO_SCRAPE = [
  '/',
  '/mentions-legales',
  '/mentions_legales',
  '/cgv',
  '/conditions-generales-de-vente',
  '/politique-de-confidentialite',
  '/politique-confidentialite',
  '/livraison'
];

// ─── Scraping HTTP natif ──────────────────────────────────────────────────────

function fetchPage(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('Trop de redirections'));
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      timeout: 10000
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        resolve(fetchPage(new URL(res.headers.location, url).href, redirectCount + 1));
        return;
      }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      res.setEncoding('utf8');
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => resolve(raw));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.end();
  });
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeSite(baseUrl) {
  const collectedTexts = [];

  for (const urlPath of PATHS_TO_SCRAPE) {
    const fullUrl = baseUrl.replace(/\/$/, '') + urlPath;
    try {
      const html = await fetchPage(fullUrl);
      const text = htmlToText(html);
      if (text.length > 100) {
        collectedTexts.push(`=== PAGE: ${urlPath} ===\n${text}`);
      }
    } catch {
      // Page introuvable ou timeout — on ignore
    }
  }

  if (collectedTexts.length === 0) {
    throw new Error("Impossible d'accéder au site. Vérifiez l'URL et réessayez.");
  }

  let combined = collectedTexts.join('\n\n');
  if (combined.length > 80000) combined = combined.substring(0, 80000);
  return combined;
}

// ─── Appel API Gemini (REST natif) ───────────────────────────────────────────

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...headers
      }
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(raw);
        } else {
          reject(new Error(`API Gemini — HTTP ${res.statusCode}: ${raw.substring(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function analyseWithGemini(siteContent, url) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_API_KEY manquante dans le fichier .env');

  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';
  const userMessage = `URL du site analysé : ${url}\nDate d'analyse : ${new Date().toISOString()}\n\nContenu extrait du site :\n\n${siteContent}`;

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: { temperature: 0.1 }
  };

  const raw = await httpsPost(apiUrl, { 'X-goog-api-key': apiKey }, body);
  const parsed = JSON.parse(raw);
  const responseText = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!responseText) throw new Error("Réponse vide de l'API Gemini");

  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

// ─── Serveur HTTP ─────────────────────────────────────────────────────────────

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function jsonResponse(res, statusCode, data) {
  const json = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json)
  });
  res.end(json);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'POST' && req.url === '/api/analyser') {
    let body;
    try {
      const raw = await readBody(req);
      body = JSON.parse(raw);
    } catch {
      return jsonResponse(res, 400, { error: 'Corps de requête invalide.' });
    }

    const { url, content } = body;

    // Mode saisie manuelle : content fourni directement, pas besoin de scraper
    if (content && typeof content === 'string' && content.trim().length > 50) {
      const siteContent = content.trim().substring(0, 80000);
      const siteUrl = (url && typeof url === 'string') ? url : 'Saisie manuelle';
      try {
        console.log('[Analyse] Mode manuel — contenu fourni directement');
        const rapport = await analyseWithGemini(siteContent, siteUrl);
        console.log(`[Analyse] Score global : ${rapport.score_global}`);
        return jsonResponse(res, 200, rapport);
      } catch (err) {
        console.error('[Erreur]', err.message);
        return jsonResponse(res, 500, { error: 'Erreur lors de l\'analyse : ' + err.message });
      }
    }

    if (!url || typeof url !== 'string') {
      return jsonResponse(res, 400, { error: 'URL manquante.' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return jsonResponse(res, 400, { error: 'URL invalide. Elle doit commencer par http:// ou https://' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return jsonResponse(res, 400, { error: 'URL invalide. Elle doit commencer par http:// ou https://' });
    }

    const baseUrl = parsedUrl.origin;

    try {
      console.log(`[Analyse] Scraping : ${baseUrl}`);
      const siteContent = await scrapeSite(baseUrl);
      console.log(`[Analyse] Texte extrait : ${siteContent.length} caractères`);

      console.log('[Analyse] Appel Gemini...');
      const rapport = await analyseWithGemini(siteContent, url);
      console.log(`[Analyse] Score global : ${rapport.score_global}`);

      return jsonResponse(res, 200, rapport);
    } catch (err) {
      console.error('[Erreur]', err.message);
      const status = err.message.includes("Impossible d'accéder") ? 400 : 500;
      return jsonResponse(res, status, { error: 'Erreur lors de l\'analyse : ' + err.message });
    }
  }

  if (req.method === 'GET') {
    const urlPath = req.url === '/' ? '/index.html' : req.url;
    const filePath = path.join(__dirname, 'public', urlPath);
    return serveFile(res, filePath);
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
