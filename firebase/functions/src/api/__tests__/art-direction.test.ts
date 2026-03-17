import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CallableRequest } from 'firebase-functions/v2/https';

vi.mock('../../services/firebase-admin', () => ({
  getDb: vi.fn(),
}));

import {
  listModelsHandler,
  createModelHandler,
  updateModelHandler,
  deleteModelHandler,
  listBackgroundsHandler,
  createBackgroundHandler,
} from '../art-direction';
import { getDb } from '../../services/firebase-admin';
import { makeTenantUserClaims } from '../../test/fixtures';

const mockGetDb = getDb as ReturnType<typeof vi.fn>;

function makeRequest(data: Record<string, unknown> = {}, token?: Record<string, unknown>): CallableRequest {
  return {
    data,
    auth: { uid: 'user-uid-1', token: token ?? makeTenantUserClaims() },
    rawRequest: {},
  } as unknown as CallableRequest;
}

describe('Model CRUD', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listModelsHandler returns all models', async () => {
    const docs = [
      { id: 'm-1', data: () => ({ name: 'Model A' }) },
      { id: 'm-2', data: () => ({ name: 'Model B' }) },
    ];
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs }),
        }),
      }),
    });

    const result = await listModelsHandler(makeRequest());
    expect(result.models).toHaveLength(2);
    expect(result.models[0]).toEqual({ id: 'm-1', name: 'Model A' });
  });

  it('createModelHandler validates and creates', async () => {
    const mockAdd = vi.fn().mockResolvedValue({ id: 'new-model-1' });
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({ add: mockAdd }),
    });

    const result = await createModelHandler(
      makeRequest({
        name: 'Test Model',
        gender: 'female',
        skinColour: 'light',
        hairColour: 'blonde',
        height: '170cm',
        clothingSize: 10,
        age: '20-25',
      }),
    );

    expect(result.id).toBe('new-model-1');
    expect(result.name).toBe('Test Model');
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Test Model', gender: 'female', clothingSize: 10 }),
    );
  });

  it('createModelHandler rejects invalid clothingSize', async () => {
    await expect(
      createModelHandler(
        makeRequest({
          name: 'Test',
          gender: 'female',
          skinColour: 'light',
          hairColour: 'blonde',
          height: '170cm',
          clothingSize: 4, // Below min of 8
          age: '20-25',
        }),
      ),
    ).rejects.toThrow();
  });

  it('updateModelHandler validates and updates', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({ update: mockUpdate }),
    });

    const result = await updateModelHandler(
      makeRequest({
        id: 'm-1',
        name: 'Updated Model',
        gender: 'male',
        skinColour: 'dark',
        hairColour: 'black',
        height: '180cm',
        clothingSize: 14,
        age: '30-35',
      }),
    );

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Updated Model', clothingSize: 14 }),
    );
  });

  it('deleteModelHandler deletes by id', async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    mockGetDb.mockReturnValue({
      doc: vi.fn().mockReturnValue({ delete: mockDelete }),
    });

    const result = await deleteModelHandler(makeRequest({ id: 'm-1' }));
    expect(result.success).toBe(true);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('deleteModelHandler rejects missing id', async () => {
    await expect(deleteModelHandler(makeRequest({}))).rejects.toThrow('Model id is required');
  });
});

describe('Background CRUD', () => {
  beforeEach(() => vi.clearAllMocks());

  it('listBackgroundsHandler returns all backgrounds', async () => {
    const docs = [{ id: 'bg-1', data: () => ({ name: 'Studio White' }) }];
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs }),
        }),
      }),
    });

    const result = await listBackgroundsHandler(makeRequest());
    expect(result.backgrounds).toHaveLength(1);
  });

  it('createBackgroundHandler validates and creates', async () => {
    const mockAdd = vi.fn().mockResolvedValue({ id: 'new-bg-1' });
    mockGetDb.mockReturnValue({
      collection: vi.fn().mockReturnValue({ add: mockAdd }),
    });

    const result = await createBackgroundHandler(
      makeRequest({
        name: 'Beach Sunset',
        type: 'outdoor',
        description: 'Sandy beach at golden hour',
      }),
    );

    expect(result.id).toBe('new-bg-1');
    expect(result.name).toBe('Beach Sunset');
  });

  it('createBackgroundHandler rejects invalid type', async () => {
    await expect(
      createBackgroundHandler(
        makeRequest({
          name: 'Test',
          type: 'invalid_type',
          description: 'Test',
        }),
      ),
    ).rejects.toThrow();
  });
});
