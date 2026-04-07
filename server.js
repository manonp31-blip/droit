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

// Support playwright installed globally or locally
let chromium;
try {
  chromium = require('playwright').chromium;
} catch {
  try {
    chromium = require('/opt/node22/lib/node_modules/playwright').chromium;
  } catch {
    chromium = require('/opt/node21/lib/node_modules/playwright').chromium;
  }
}

const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `Tu es un expert juridique spécialisé en droit du commerce électronique français. Tu analyses des sites e-commerce selon : Code de la consommation, LCEN, loi Hamon, loi Toubon, RGPD.

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
          "ok": <true|false>,
          "texte": "<description claire de ce qui est présent ou manquant>",
          "gravite": "<bloquant|majeur|mineur>",
          "sanction": "<ex: amende jusqu'à 15 000 €>"
        }
      ]
    }
  ],
  "resume_risques": "<2-3 phrases résumant les risques principaux>",
  "points_positifs": ["<point 1>", "<point 2>"]
}

Sections à analyser obligatoirement :
1. id: "mentions_legales", titre: "Mentions légales (LCEN art. 6)"
   - Nom/raison sociale présent
   - Adresse siège social
   - Numéro RCS ou SIREN
   - Nom directeur de publication
   - Hébergeur identifié (nom + adresse)
   - Numéro de téléphone
   Sanction référence : amende jusqu'à 375 000 €

2. id: "information_precontractuelle", titre: "Information précontractuelle (art. L221-5)"
   - Caractéristiques essentielles des produits décrites
   - Prix TTC clairement affiché
   - Frais de livraison indiqués
   - Date ou délai de livraison mentionné
   - Identité et coordonnées du vendeur
   - Informations sur les garanties légales
   Sanction référence : amende jusqu'à 3 000 € (personne physique) / 15 000 € (morale)

3. id: "droit_retractation", titre: "Droit de rétractation (art. L221-18)"
   - Délai de 14 jours clairement mentionné
   - Formulaire de rétractation fourni ou lien vers formulaire
   - Conditions de remboursement sous 14 jours expliquées
   - Exceptions au droit de rétractation listées (art. L221-28)
   - Information sur les frais de retour
   Sanction référence : extension du délai à 12 mois si non informé

4. id: "cgv", titre: "Conditions Générales de Vente (art. 1127-1 C. civil)"
   - CGV présentes et accessibles
   - Étapes de conclusion du contrat décrites
   - Moyens de paiement acceptés listés
   - Modalités de livraison détaillées
   - Clause de réserve de propriété
   - Loi applicable et juridiction compétente mentionnées
   Sanction référence : nullité potentielle du contrat

5. id: "garanties", titre: "Garanties légales (art. L217-3 et s.)"
   - Garantie légale de conformité 2 ans mentionnée
   - Garantie des vices cachés (art. 1641 C. civil) mentionnée
   - Procédure de mise en œuvre des garanties expliquée
   - Garantie commerciale décrite si proposée
   - Délai de présomption de 24 mois mentionné
   Sanction référence : amende jusqu'à 15 000 € / 75 000 €

6. id: "commande_paiement", titre: "Processus de commande (art. L221-14)"
   - Bouton avec mention "commande avec obligation de paiement" ou équivalent
   - Récapitulatif de commande avant validation
   - Accusé de réception de commande prévu
   - Moyens de paiement sécurisés (mention https/SSL)
   - Politique de conservation données bancaires conforme CNIL
   Sanction référence : nullité de la commande possible

7. id: "langue_toubon", titre: "Langue française (loi Toubon 1994)"
   - Site entièrement en français
   - Conditions générales en français
   - Notices produits en français
   - Pas de termes étrangers non traduits hors exceptions légales
   Sanction référence : contravention 5e classe (1 500 €)

8. id: "donnees_personnelles", titre: "Données personnelles (RGPD + loi Informatique et Libertés)"
   - Politique de confidentialité présente
   - Bandeau cookies avec consentement explicite
   - Droits des personnes (accès, rectification, suppression) mentionnés
   - Identité du responsable de traitement indiquée
   - Durée de conservation des données précisée
   - Coordonnées DPO si applicable
   Sanction référence : amende CNIL jusqu'à 20M€ ou 4% CA mondial

Règles de scoring :
- item ok=true ET gravite=bloquant : +15 points
- item ok=true ET gravite=majeur : +8 points
- item ok=true ET gravite=mineur : +3 points
- item ok=false ET gravite=bloquant : -20 points
- item ok=false ET gravite=majeur : -10 points
- item ok=false ET gravite=mineur : -3 points
- Score section = max(0, min(100, 50 + somme des points))
- Score global = moyenne pondérée des sections (mentions_legales x1.5, cgv x1.5, autres x1)`;

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

// ─── Scraping avec Playwright ────────────────────────────────────────────────

async function scrapeSite(baseUrl) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const collectedTexts = [];

  try {
    for (const urlPath of PATHS_TO_SCRAPE) {
      const fullUrl = baseUrl.replace(/\/$/, '') + urlPath;
      const page = await browser.newPage();
      try {
        await page.setExtraHTTPHeaders({
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const text = await page.evaluate(() => document.body.innerText);
        if (text && text.trim().length > 100) {
          collectedTexts.push(`=== PAGE: ${urlPath} ===\n${text.trim()}`);
        }
      } catch {
        // Page not found or timeout — skip silently
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
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

  const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
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

    const { url } = body;

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
