# Audit — Compagnon Voyageur (MVP)

Légende : 🔴 critique (bloquant avant lancement) · 🟠 important (à traiter rapidement après lancement) · 🟡 à surveiller (roadmap)

---

## 1. Le point le plus important : la notification de porte ne fonctionnera pas telle quelle

🔴 **C'est le cœur de la proposition de valeur de l'app, et l'architecture actuelle ne peut pas la tenir.**

Aujourd'hui, la vérification du vol se fait par `setInterval` dans le navigateur — ça ne fonctionne que **tant que l'app est ouverte à l'écran**. Dès que le téléphone se verrouille ou que l'utilisateur change d'app, la vérification s'arrête. Or l'intérêt du produit, c'est justement d'être prévenu **sans avoir l'app ouverte en permanence** pendant qu'on attend à l'aéroport.

**Ce qu'il faut à la place :**
- Un serveur (Cloud Function planifiée, ex. toutes les 2-5 min) qui vérifie le statut de chaque vol suivi activement.
- **Firebase Cloud Messaging (FCM)** pour pousser une vraie notification même app fermée.

C'est un changement d'architecture, pas un ajustement — à faire avant toute annonce publique du produit, sous peine de décevoir au pire moment (le jour du vol).

---

## 2. Sécurité

- 🔴 **Clé API AeroDataBox exposée côté client.** Actuellement saisie et utilisée directement dans le navigateur — n'importe qui peut l'extraire via les outils de développement et l'utiliser à ta place (vol de quota, voire de facturation si tu passes sur un plan payant). Il faut la faire transiter par une Cloud Function qui la garde côté serveur.
- 🔴 **Règles Firestore en "mode test".** Actuellement, n'importe qui connaissant la structure peut lire/écrire les données de n'importe quel utilisateur. Il faut des règles restreignant chaque utilisateur à ses propres documents avant tout lancement, même en bêta fermée.
- 🟠 **Filtre anti-coordonnées du Fil de vol trivialement contournable.** Le filtre actuel (regex simple) bloque "0612345678" mais pas "06 12 34 56 78" écrit autrement, ni "zéro six douze...", ni une capture d'écran d'un numéro. Un vrai filtre nécessite soit un service de modération dédié, soit au minimum des règles plus robustes + modération humaine a posteriori.
- 🟡 **Pas de limite de débit (rate limiting)** sur les écritures Firestore — un utilisateur malveillant pourrait spammer le Fil de vol ou saturer ta base à moindre coût pour toi mais au détriment de la stabilité.

---

## 3. Données et persistance — des fonctionnalités "en trompe-l'œil"

C'est le point le plus sournois de l'audit : certains modules **donnent l'impression de sauvegarder** alors qu'ils ne sauvegardent rien.

- 🔴 **Photos Bagages et Documents non persistées.** Elles s'affichent après capture, mais rien n'est envoyé à Firebase Storage — tout disparaît au rechargement de la page. Un utilisateur qui compte dessus en cas de bagage perdu n'aura rien. Il faut brancher Firebase Storage (les photos ne peuvent pas aller dans Firestore telles quelles : limite de 1 Mo par document).
- 🟠 **Correspondances non persistées** — ajoutées en mémoire seulement, perdues au rechargement.
- 🟠 **Fil de vol non partagé entre utilisateurs réels.** Aujourd'hui c'est un tableau JavaScript local avec deux messages d'exemple + un message simulé après 15s. Rien n'est encore échangé entre vrais passagers. Il faut une vraie collection Firestore en écoute temps réel (`onSnapshot`), filtrée par vol + date.

**Recommandation :** avant de présenter l'app comme "prête", faire un tableau simple listant chaque module et son état réel de persistance (✅ persisté / ⚠️ visuel seulement) — ça évite de découvrir le problème après le lancement.

---

## 4. Faisabilité à trancher module par module

| Module | Question de faisabilité | Niveau |
|---|---|---|
| Suivi de vol | Le décalage des API tierces (AeroDataBox etc.) par rapport à l'affichage officiel — jugé acceptable | ✅ Tranché |
| Distance/km pour les badges | Décision : table de distances connues entre villes/pays (déjà en place), enrichie au fil de l'eau selon les routes réellement suivies, avec valeur par défaut sinon. Pas besoin de coordonnées GPS ni de calcul orthodromique pour cet usage (badges, pas navigation) | ✅ Tranché |
| Devise & budget | Décision : intégration d'une vraie API de change (Frankfurter, gratuite, sans clé) plutôt qu'une redirection externe — meilleure expérience, effort quasi identique. **Implémenté dans le code.** | ✅ Fait |
| Traduction | Dictionnaire statique, 4 langues, 5 phrases — suffisant pour valider l'usage, pas pour un vrai lancement Premium payant | 🟠 |
| Fil de vol | Masse critique : à combien d'utilisateurs actifs par vol le module devient-il utile ? Sous ce seuil, l'écran sera vide et donnera une mauvaise première impression | 🟠 |
| Mode hors ligne (vendu en Premium) | Décision : périmètre réduit et honnête plutôt qu'un gros chantier. La persistance hors ligne intégrée de Firestore (`enablePersistence()`) suffit à garder checklist, budget, documents et compte consultables sans réseau, avec resynchro automatique au retour de connexion. **Implémenté dans le code.** Le statut de vol en direct reste exclu (a besoin du réseau par nature), et les vraies photos (une fois sur Firebase Storage) demanderont une stratégie de cache séparée si on veut les couvrir un jour | ✅ Fait (périmètre réduit) |
| Paiement Premium | Le bouton actuel simule l'activation sans paiement réel — obligatoire de passer par Google Play Billing pour un vrai abonnement in-app sur Android | 🔴 |

---

## 5. Architecture technique

- 🟠 **Fichier HTML unique monolithique.** Très bien pour prototyper vite, mais illisible et risqué à maintenir dès que l'app grossit encore. Avant le développement final, il faudra migrer vers une vraie stack structurée (React Native ou Flutter, comme évoqué précédemment) avec un vrai système de build et de gestion de versions (Git).
- 🟠 **Aucun test automatisé.** Normal à ce stade de prototype, mais à prévoir dès que la V1 réelle démarre, pour ne pas casser une fonctionnalité en ajoutant la suivante.
- 🟡 **Notifications navigateur (Web Notification API)** utilisées pour la démo — ne se comportent pas comme des notifications push natives Android. Cohérent avec le point n°1 : à remplacer par FCM.
- 🟡 **Pas de gestion d'erreurs réseau robuste** (coupure de connexion en plein vol, timeout API) — à renforcer avant mise en production.

---

## 6. Comptes et cycle de vie utilisateur

- 🔴 **Authentification anonyme uniquement.** Les données sont liées à l'appareil : si l'utilisateur change de téléphone ou vide le cache, tout est perdu. Il faut au minimum une **connexion Google** pour permettre une vraie continuité multi-appareil.
- 🔴 **Pas de suppression de compte.** Le Play Store **exige** qu'une app avec comptes utilisateurs propose un moyen de supprimer son compte et ses données — condition de publication, pas une option.
- 🟠 **Pas de déconnexion / changement de compte** dans l'interface actuelle.

---

## 7. Conformité légale (RGPD + Play Store)

- 🔴 **Politique de confidentialité** : obligatoire avant soumission sur le Play Store (photos, email, données de vol = données personnelles).
- 🔴 **Formulaire "Sécurité des données"** du Play Store à remplir précisément (quelles données, pourquoi, partagées ou non).
- 🔴 **Droit à l'oubli (RGPD)** : capacité technique à supprimer entièrement les données d'un utilisateur sur demande.
- 🟠 **Modération du Fil de vol** : en hébergeant des échanges entre utilisateurs, tu deviens responsable de leur contenu sous le DSA européen, même à petite échelle — prévoir au minimum un circuit de traitement des signalements, pas seulement le bouton "Signaler" qui masque localement sans rien transmettre pour l'instant.

---

## 8. Feuille de route avant déploiement

**Bloquant (sans ça, ne pas soumettre au Play Store) :**
1. Passer le suivi de vol en vérification côté serveur + notifications FCM.
2. Sécuriser la clé API (proxy serveur).
3. Écrire de vraies règles de sécurité Firestore.
4. Authentification réelle (a minima Google Sign-In) + suppression de compte.
5. Politique de confidentialité + formulaire Sécurité des données Play Store.
6. Intégrer Google Play Billing pour le Premium (retirer la simulation).
7. Brancher Firebase Storage pour les photos (Bagages, Documents).

**Important (à faire vite après, ou avant si tu veux une V1 solide) :**
8. ~~API de taux de change réelle~~ ✅ Fait.
9. Vraie synchronisation Firestore temps réel pour le Fil de vol + circuit de modération basique.
10. ~~Distance réelle pour fiabiliser les badges kilométriques~~ ✅ Tranché — table de distances connues suffisante pour cet usage.
11. Migration vers une stack structurée (React Native/Flutter) si tu comptes faire évoluer l'app dans la durée.

**Roadmap (peut attendre une V1.1) :**
12. ~~Mode hors ligne réel~~ ✅ Fait (périmètre réduit via la persistance Firestore intégrée — checklist, budget, documents, compte).
13. Élargir la traduction (plus de langues/phrases, API dédiée).
14. Tests automatisés.
15. Onboarding/tutoriel premier lancement.

---

## En résumé

Le prototype a rempli son rôle : il valide très bien le **concept et l'expérience utilisateur**. Mais trois choses empêchent aujourd'hui un vrai déploiement :
1. Le mécanisme de notification ne survit pas à la fermeture de l'app (le problème le plus fondamental).
2. Plusieurs modules donnent l'illusion de sauvegarder des données alors que ce n'est pas branché.
3. Rien n'est encore conforme aux exigences obligatoires du Play Store (compte supprimable, politique de confidentialité, vrai paiement).

Aucun de ces points n'est bloquant *pour continuer à concevoir* — mais tous sont bloquants *pour publier*.
