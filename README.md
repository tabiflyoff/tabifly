# Tabifly

Application compagnon voyageur — suivi de vol en temps réel, checklist avant départ, bagages, budget voyage, traduction, fil de vol partagé entre passagers, et système de récompenses.

Prototype actuel : une app web (HTML/JS/Firebase) testée sur un vol réel en septembre 2026, avant migration vers une stack native (React Native/Flutter) pour publication sur le Play Store.

## Structure du dépôt

```
tabifly/
├── app/
│   └── index.html          # Prototype de l'application (HTML/CSS/JS + Firebase)
├── functions/
│   ├── index.js            # Cloud Function : vérification serveur des vols + notifications push (FCM)
│   └── package.json        # Dépendances des Cloud Functions
├── legal/
│   └── privacy-policy.html # Politique de confidentialité (à héberger pour l'URL Play Store)
└── docs/
    └── audit-application.md # Audit technique complet et feuille de route avant déploiement
```

## Démarrer

1. Ouvrir `app/index.html` dans un navigateur pour tester le prototype.
2. Suivre les instructions en commentaire dans `app/index.html` pour configurer un projet Firebase (Auth anonyme + Firestore).
3. Voir `docs/audit-application.md` pour l'état d'avancement détaillé et les étapes restantes avant publication.

## Déploiement des Cloud Functions

Voir les instructions détaillées en commentaire en haut de `functions/index.js` (nécessite `firebase-tools` et un projet Firebase existant).

## Statut

Prototype fonctionnel, testé en conditions réelles. Voir `docs/audit-application.md` pour la liste des points bloquants avant une publication sur le Play Store (paiement réel, authentification complète, migration vers une stack native).
