/**
 * Repositorio base genérico sobre Firestore (API modular RN Firebase v26).
 *
 * ¿Qué es esto? Un "repositorio" es una capa intermedia entre las pantallas y la
 * base de datos. En lugar de escribir consultas de Firestore repartidas por toda
 * la app, cada tipo de dato tiene un repositorio con métodos legibles
 * (get, list, create, update, delete). Este BaseRepository implementa esos
 * métodos UNA vez de forma genérica; los repositorios concretos (mesociclos,
 * lesiones, etc.) solo indican en qué colección viven y heredan el CRUD.
 *
 * Ventajas:
 *  - Las pantallas no conocen Firestore -> código desacoplado y testeable.
 *  - Los datos entran y salen ya tipados con los modelos de la Capa 1.
 *  - Un único sitio que tocar si cambia la forma de acceder a la BD.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  type CollectionReference,
  type DocumentReference,
  type DocumentData,
} from '@react-native-firebase/firestore';
import { db } from '../firebase';

/** Todo documento almacenado tiene, como mínimo, un id. */
export interface WithId {
  id: string;
}

export class BaseRepository<T extends WithId> {
  /**
   * @param collectionPath Ruta de la colección en Firestore, ej. 'mesocycles'
   *   o una subcolección 'users/{uid}/injuries'.
   */
  constructor(protected readonly collectionPath: string) {}

  /** Referencia a la colección. */
  protected col(): CollectionReference {
    return collection(db, this.collectionPath);
  }

  /** Referencia a un documento concreto por id. */
  protected ref(id: string): DocumentReference {
    return doc(this.col(), id);
  }

  /** Lee un documento por id. Devuelve null si no existe. */
  async get(id: string): Promise<T | null> {
    const snap = await getDoc(this.ref(id));
    if (!snap.exists()) return null;
    return { ...(snap.data() as object), id: snap.id } as T;
  }

  /** Lista todos los documentos de la colección. */
  async list(): Promise<T[]> {
    const snap = await getDocs(this.col());
    return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
  }

  /** Lista los documentos donde `field` == `value`. */
  async listWhere(field: string, value: unknown): Promise<T[]> {
    const q = query(this.col(), where(field, '==', value));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as T);
  }

  /**
   * Crea o reemplaza un documento. Usa el id que trae el objeto.
   * (setDoc con merge:false para create/replace; los updates parciales usan update()).
   */
  async create(item: T): Promise<void> {
    const { id, ...data } = item;
    await setDoc(this.ref(id), data);
  }

  /** Actualiza parcialmente un documento existente. */
  async update(id: string, patch: Partial<Omit<T, 'id'>>): Promise<void> {
    await updateDoc(this.ref(id), patch as DocumentData);
  }

  /** Elimina un documento por id. */
  async delete(id: string): Promise<void> {
    await deleteDoc(this.ref(id));
  }
}
