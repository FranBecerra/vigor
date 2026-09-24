/**
 * Inicialización de Firebase para Vigor (API modular de React Native Firebase v26).
 *
 * Con React Native Firebase NO se pasan claves aquí: el SDK nativo lee
 * automáticamente el GoogleService-Info.plist (iOS) declarado en app.json.
 *
 * Persistencia offline (PRD §2.1): en React Native Firebase la caché en disco
 * está ACTIVADA por defecto y sincroniza sola al recuperar red, así que no hay
 * que configurar nada para cumplir el requisito offline-first. Si en el futuro
 * se necesitara desactivarla (p. ej. datos sensibles), se haría con
 * initializeFirestore(getApp(), { persistence: false }) ANTES de cualquier uso.
 *
 * Uso: import { db, authInstance } from '@/services/firebase';
 */
import { getApp } from '@react-native-firebase/app';
import { getFirestore } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

const app = getApp();

/** Instancia de Firestore (la base de datos). */
export const db = getFirestore(app);

/** Instancia de Authentication (login con Apple/Google). */
export const authInstance = getAuth(app);
