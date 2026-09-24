/**
 * Tests del repositorio base con Firestore SIMULADO.
 *
 * Por qué simulado y no el real: estos tests verifican NUESTRA lógica —cómo se
 * arma la referencia, cómo se inyecta el `id` en el objeto devuelto, qué pasa
 * cuando el documento no existe— no el comportamiento de Firestore, que es
 * responsabilidad de Google. Golpear la base de datos real haría los tests
 * lentos, frágiles y dependientes de la red.
 *
 * El punto delicado que cubren: `BaseRepository` guarda el documento SIN el
 * campo `id` (porque el id es la clave) y lo vuelve a añadir al leer. Si esa
 * simetría se rompiera, los objetos saldrían de la base de datos sin id.
 */
import { BaseRepository } from '@/services/repositories/BaseRepository';

// --- Simulación del módulo de Firestore ------------------------------------
const mockGetDoc = jest.fn();
const mockGetDocs = jest.fn();
const mockSetDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();

jest.mock('@react-native-firebase/firestore', () => ({
  collection: jest.fn((_db: unknown, path: string) => ({ path })),
  doc: jest.fn((col: { path: string }, id: string) => ({ path: `${col.path}/${id}`, id })),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  query: jest.fn((col: unknown, ...clauses: unknown[]) => ({ col, clauses })),
  where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}));

jest.mock('@/services/firebase', () => ({ db: { name: 'test-db' }, authInstance: {} }));

interface Widget {
  id: string;
  userId: string;
  label: string;
}

/** Simula un snapshot de documento. */
function docSnap(id: string, data: object | null) {
  return { exists: () => data !== null, id, data: () => data };
}

describe('BaseRepository', () => {
  let repo: BaseRepository<Widget>;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new BaseRepository<Widget>('widgets');
  });

  describe('get', () => {
    it('devuelve el documento con su id inyectado', async () => {
      mockGetDoc.mockResolvedValue(docSnap('w1', { userId: 'u1', label: 'Uno' }));
      await expect(repo.get('w1')).resolves.toEqual({ id: 'w1', userId: 'u1', label: 'Uno' });
    });

    it('devuelve null si el documento no existe', async () => {
      mockGetDoc.mockResolvedValue(docSnap('w1', null));
      await expect(repo.get('w1')).resolves.toBeNull();
    });

    it('el id del documento GANA sobre uno guardado por error en los datos', async () => {
      // Si alguna vez se guardó un `id` dentro del documento, la clave real debe
      // prevalecer: es la que identifica al documento en Firestore.
      mockGetDoc.mockResolvedValue(docSnap('real', { id: 'obsoleto', userId: 'u1', label: 'x' }));
      const result = await repo.get('real');
      expect(result?.id).toBe('real');
    });
  });

  describe('list', () => {
    it('mapea todos los documentos con su id', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [docSnap('a', { userId: 'u1', label: 'A' }), docSnap('b', { userId: 'u1', label: 'B' })],
      });
      await expect(repo.list()).resolves.toEqual([
        { id: 'a', userId: 'u1', label: 'A' },
        { id: 'b', userId: 'u1', label: 'B' },
      ]);
    });

    it('devuelve lista vacía cuando no hay documentos', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });
      await expect(repo.list()).resolves.toEqual([]);
    });
  });

  describe('listWhere', () => {
    it('filtra por igualdad y mapea el resultado', async () => {
      mockGetDocs.mockResolvedValue({ docs: [docSnap('a', { userId: 'u1', label: 'A' })] });
      await expect(repo.listWhere('userId', 'u1')).resolves.toEqual([
        { id: 'a', userId: 'u1', label: 'A' },
      ]);
    });
  });

  describe('create', () => {
    it('NO guarda el campo id dentro del documento', async () => {
      mockSetDoc.mockResolvedValue(undefined);
      await repo.create({ id: 'w1', userId: 'u1', label: 'Uno' });

      const [ref, data] = mockSetDoc.mock.calls[0];
      expect(ref).toEqual({ path: 'widgets/w1', id: 'w1' });
      expect(data).toEqual({ userId: 'u1', label: 'Uno' });
      expect(data).not.toHaveProperty('id');
    });

    it('propaga el error de escritura en lugar de silenciarlo', async () => {
      mockSetDoc.mockRejectedValue(new Error('permission-denied'));
      await expect(repo.create({ id: 'w1', userId: 'u1', label: 'x' })).rejects.toThrow(
        'permission-denied',
      );
    });
  });

  describe('update', () => {
    it('aplica un parche sobre el documento indicado', async () => {
      mockUpdateDoc.mockResolvedValue(undefined);
      await repo.update('w1', { label: 'Nuevo' });

      const [ref, patch] = mockUpdateDoc.mock.calls[0];
      expect(ref.path).toBe('widgets/w1');
      expect(patch).toEqual({ label: 'Nuevo' });
    });
  });

  describe('delete', () => {
    it('borra el documento indicado', async () => {
      mockDeleteDoc.mockResolvedValue(undefined);
      await repo.delete('w1');
      expect(mockDeleteDoc.mock.calls[0][0].path).toBe('widgets/w1');
    });
  });

  describe('rutas de subcolección', () => {
    it('respeta una ruta anidada por usuario', async () => {
      const nested = new BaseRepository<Widget>('users/u1/injuries');
      mockSetDoc.mockResolvedValue(undefined);
      await nested.create({ id: 'i1', userId: 'u1', label: 'Hombro' });
      expect(mockSetDoc.mock.calls[0][0].path).toBe('users/u1/injuries/i1');
    });
  });
});
