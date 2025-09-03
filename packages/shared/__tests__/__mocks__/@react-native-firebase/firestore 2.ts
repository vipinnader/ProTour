// Manual mock for @react-native-firebase/firestore

const mockTimestamp = {
  seconds: 1640995200,
  nanoseconds: 0,
  toDate: jest.fn(() => new Date(1640995200000)),
};

const mockDoc = {
  get: jest.fn().mockResolvedValue({
    exists: false,
    id: 'mock-id',
    data: jest.fn().mockReturnValue({}),
  }),
  update: jest.fn().mockResolvedValue({}),
  delete: jest.fn().mockResolvedValue({}),
  set: jest.fn().mockResolvedValue({}),
};

const mockQuery = {
  get: jest.fn().mockResolvedValue({
    docs: [],
  }),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
};

const mockCollection = {
  add: jest.fn().mockResolvedValue({
    id: 'mock-id',
  }),
  doc: jest.fn().mockReturnValue(mockDoc),
  where: jest.fn().mockReturnValue(mockQuery),
  orderBy: jest.fn().mockReturnValue(mockQuery),
  limit: jest.fn().mockReturnValue(mockQuery),
  get: jest.fn().mockResolvedValue({
    docs: [],
  }),
};

const mockBatch = {
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn().mockResolvedValue({}),
};

const mockFirestore = {
  collection: jest.fn().mockReturnValue(mockCollection),
  batch: jest.fn().mockReturnValue(mockBatch),
};

const firestore = jest.fn(() => mockFirestore);

firestore.Timestamp = {
  now: jest.fn(() => mockTimestamp),
  fromDate: jest.fn((date: Date) => ({
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  })),
};

firestore.FieldValue = {
  delete: jest.fn(() => 'DELETE_FIELD'),
};

export default firestore;
export {
  mockTimestamp,
  mockDoc,
  mockCollection,
  mockQuery,
  mockBatch,
  mockFirestore,
};

// Simple test to prevent Jest "no tests found" error
describe('Firestore Mock', () => {
  it('should export firestore mock', () => {
    expect(firestore).toBeDefined();
    expect(mockFirestore).toBeDefined();
  });
});
