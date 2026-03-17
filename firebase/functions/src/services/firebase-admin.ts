import * as admin from 'firebase-admin';

export function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

export function getAuth(): admin.auth.Auth {
  return admin.auth();
}

export function getStorage(): admin.storage.Storage {
  return admin.storage();
}
