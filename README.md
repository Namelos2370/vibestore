# VibeStore

Plateforme de streaming et de vente de musique (Cameroun / Afrique). React + Vite, déployable sur Vercel.

## État actuel : mode démonstration
Le site fonctionne en entier avec une base locale (navigateur) et des données d'exemple :

- Visiteur : doit créer un compte pour écouter. Auditeur : **30 s d'aperçu gratuit par titre pendant 30 jours** après l'inscription, puis achat obligatoire.
- Achat de titres et d'albums, **prix minimum 1 000 FCFA**, panier, bibliothèque, historique.
- Studio artiste (après validation), administration (validation des artistes et sorties, ventes, commission, moyens de paiement activables).
- Commission : 15 % pendant 6 mois de lancement, puis 20 % (modifiable dans l'admin).
- Paiement **simulé** (aucun débit). Audio : sons de test générés (le vrai audio vient avec Supabase Storage).

Comptes de démo (page Connexion) : admin@vibestore.demo / admin123, artiste@vibestore.demo / artiste123.

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
