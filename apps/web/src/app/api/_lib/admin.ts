import * as admin from 'firebase-admin';

let initialized = false;

function ensureInitialized(): void {
  if (!initialized) {
    if (admin.apps.length === 0) {
      admin.initializeApp();
    }
    initialized = true;
  }
}

export function getDb(): admin.firestore.Firestore {
  ensureInitialized();
  return admin.firestore();
}

export function getAuth(): admin.auth.Auth {
  ensureInitialized();
  return admin.auth();
}

export function getStorage(): admin.storage.Storage {
  ensureInitialized();
  return admin.storage();
}
