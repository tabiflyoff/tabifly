/**
 * Cloud Functions — Compagnon Voyageur
 * ======================================================================
 * Ce fichier contient la brique serveur qui manquait au prototype web :
 * elle continue de vérifier le statut des vols même quand l'app est
 * fermée, et envoie une vraie notification push via Firebase Cloud
 * Messaging (FCM) en cas de changement de porte.
 *
 * DÉPLOIEMENT (depuis un terminal, sur ta machine) :
 *   1. npm install -g firebase-tools   (si pas déjà fait)
 *   2. firebase login
 *   3. Dans le dossier du projet : firebase init functions
 *      (choisis "utiliser un projet existant" → ton projet tabifly-mvp)
 *   4. Copie ce fichier dans functions/index.js
 *   5. Configure ta clé AeroDataBox EN SECRET (jamais en clair dans le code) :
 *        firebase functions:secrets:set AERODATABOX_KEY
 *      (colle ta clé RapidAPI quand demandé)
 *   6. firebase deploy --only functions
 * ======================================================================
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const AERODATABOX_KEY = defineSecret('AERODATABOX_KEY');

// ----------------------------------------------------------------------
// Tâche planifiée : tourne toutes les 3 minutes, vérifie tous les vols
// actuellement suivis par un utilisateur, et notifie en cas de changement.
// ----------------------------------------------------------------------
exports.checkTrackedFlights = onSchedule(
  { schedule: 'every 3 minutes', secrets: [AERODATABOX_KEY] },
  async (event) => {
    const snapshot = await db.collection('users')
      .where('trackingActive', '==', true)
      .get();

    if (snapshot.empty) {
      console.log('Aucun vol actif à vérifier.');
      return;
    }

    const apiKey = AERODATABOX_KEY.value();

    const checks = snapshot.docs.map(async (doc) => {
      const user = doc.data();
      const flightNo = user.lastFlight?.flightNo;
      const date = user.lastFlight?.date;
      const fcmToken = user.fcmToken;

      if (!flightNo || !date) return;

      try {
        const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNo)}/${date}`;
        const res = await fetch(url, {
          headers: {
            'X-RapidAPI-Key': apiKey,
            'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com'
          }
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json();
        const f = Array.isArray(data) ? data[0] : data;

        const newGate = f?.departure?.gate || null;
        const oldGate = user.lastKnownGate || null;

        // Toujours mettre à jour la porte connue, même sans changement
        await doc.ref.set({ lastKnownGate: newGate }, { merge: true });

        if (newGate && oldGate && newGate !== oldGate && fcmToken) {
          await messaging.send({
            token: fcmToken,
            notification: {
              title: 'Porte changée',
              body: `${flightNo} : ${oldGate} → ${newGate}. Vérifie ton temps de marche.`
            },
            data: { flightNo, oldGate, newGate }
          });
          console.log(`Notification envoyée à ${doc.id} : ${oldGate} → ${newGate}`);
        }
      } catch (err) {
        console.error(`Erreur pour l'utilisateur ${doc.id} (vol ${flightNo}) :`, err.message);
      }
    });

    await Promise.all(checks);
  }
);

// ----------------------------------------------------------------------
// Nettoyage optionnel : si tu veux réagir à la suppression d'un compte
// (voir la fonction de suppression de compte côté app) pour purger
// d'éventuelles données annexes (ex: messages du Fil de vol).
// ----------------------------------------------------------------------
exports.onUserDeleted = onDocumentDeleted('users/{uid}', async (event) => {
  console.log(`Données utilisateur supprimées pour ${event.params.uid}`);
  // Ajoute ici la purge d'autres collections liées à cet utilisateur si besoin.
});
