# VibeStore

Plateforme de streaming et de vente de musique (Cameroun / Afrique). React + Vite, déployable sur Vercel.

## État actuel : mode démonstration
Le site fonctionne en entier avec une base locale (navigateur) et des données d'exemple :

- Visiteur : doit créer un compte pour écouter. Auditeur : **30 s d'aperçu gratuit par titre pendant 30 jours** après l'inscription, puis achat obligatoire.
- Achat de titres et d'albums, **prix minimum 500 FCFA**, panier, bibliothèque, historique.
- **Modèle distribution : les comptes artistes et leurs titres sont ajoutés uniquement par VibeStore** (écran Admin : « Ajouter un artiste », « Ajouter une sortie »). L'artiste a un studio en lecture seule (écoutes, ventes, sa part) et une page publique à partager. Pas d'inscription artiste libre.
- Administration : artistes, sorties, ventes, commission, moyens de paiement activables.
- Commission : 15 % pendant 6 mois de lancement, puis 20 % (modifiable dans l'admin).
- Paiement **simulé** (aucun débit). Audio : sons de test générés (le vrai audio vient avec Supabase Storage).

Les données sont dans Supabase (voir `supabase/schema.sql`, à exécuter dans l’éditeur SQL). Pour la démonstration locale sans base : `VITE_SUPABASE_DISABLED=1`. Le premier compte créé avec l’email admin du schéma devient administrateur.

## Lancer en local
```
npm install
npm run dev
```

## Déployer sur Vercel
1. Pousser ce dossier sur GitHub.
2. Sur vercel.com : *Add New > Project*, choisir le dépôt. Vercel détecte Vite (build `npm run build`, dossier `dist`).
3. `vercel.json` gère les routes du site.

## Étape suivante : vraie base de données
`supabase/schema.sql` contient les tables, les règles de sécurité et les buckets de stockage. Il reste à brancher :
1. Supabase Auth, tables et stockage audio à la place de `src/lib/store.js` (les écrans n'ont pas à changer).
2. Le paiement Mobile Money / carte via un agrégateur, avec confirmation côté serveur (fonction Edge).
3. Les extraits de 30 s côté serveur (le fichier complet ne doit jamais être servi avant achat).

## Paiement réel Mobile Money (GuTouch / TouchPay)
Variables à définir sur Vercel (jamais dans le dépôt) : `GT_AGENCE`, `GT_LOGIN_AGENT`, `GT_PASSWORD_AGENT`, `GT_PARTNER_ID`, `GT_AUTH_USER`, `GT_AUTH_PASS` (les noms `INTOUCH_AGENCE`, `INTOUCH_LOGIN_API`, `INTOUCH_PASSWORD_API`, `INTOUCH_PARTNER_ID`, `INTOUCH_AUTH_USER`, `INTOUCH_AUTH_PASS` marchent aussi), et `SUPABASE_SERVICE_ROLE_KEY`.
Puis dans l'admin : Réglages > « Activer le paiement réel ». Routes : `/api/pay`, `/api/pay-status`, `/api/pay-callback`.
