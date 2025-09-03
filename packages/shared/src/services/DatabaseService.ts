// Base database service for ProTour - Epic 1 Implementation

import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

export class DatabaseService {
  protected db: FirebaseFirestoreTypes.Module;

  constructor() {
    this.db = firestore();
  }

  // Generic CRUD operations
  async create<T>(collection: string, data: Omit<T, 'id'>): Promise<T> {
    try {
      const timestamp = firestore.Timestamp.now();
      const docData = {
        ...data,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const docRef = await this.db.collection(collection).add(docData);

      return {
        ...docData,
        id: docRef.id,
      } as T;
    } catch (error) {
      console.error(`Error creating document in ${collection}:`, error);
      throw new Error(`Failed to create ${collection.slice(0, -1)}`);
    }
  }

  async read<T>(collection: string, id: string): Promise<T | null> {
    try {
      const doc = await this.db.collection(collection).doc(id).get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      } as T;
    } catch (error) {
      console.error(`Error reading document from ${collection}:`, error);
      throw new Error(`Failed to read ${collection.slice(0, -1)}`);
    }
  }

  async update<T>(
    collection: string,
    id: string,
    data: Partial<T>
  ): Promise<void> {
    try {
      const updateData = {
        ...data,
        updatedAt: firestore.Timestamp.now(),
      };

      await this.db.collection(collection).doc(id).update(updateData);
    } catch (error) {
      console.error(`Error updating document in ${collection}:`, error);
      throw new Error(`Failed to update ${collection.slice(0, -1)}`);
    }
  }

  async delete(collection: string, id: string): Promise<void> {
    try {
      await this.db.collection(collection).doc(id).delete();
    } catch (error) {
      console.error(`Error deleting document from ${collection}:`, error);
      throw new Error(`Failed to delete ${collection.slice(0, -1)}`);
    }
  }

  async query<T>(
    collection: string,
    queryConstraints: Array<{
      fieldPath: string;
      opStr: string;
      value: any;
    }> = []
  ): Promise<T[]> {
    try {
      let query = this.db.collection(collection) as any;

      // Apply query constraints
      queryConstraints.forEach(constraint => {
        query = query.where(
          constraint.fieldPath,
          constraint.opStr,
          constraint.value
        );
      });

      const querySnapshot = await query.get();

      return querySnapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    } catch (error) {
      console.error(`Error querying ${collection}:`, error);
      throw new Error(`Failed to query ${collection}`);
    }
  }

  // Batch operations for efficiency
  async batchCreate<T>(
    collection: string,
    items: Omit<T, 'id'>[]
  ): Promise<T[]> {
    try {
      const batch = this.db.batch();
      const timestamp = firestore.Timestamp.now();
      const results: T[] = [];

      items.forEach(item => {
        const docRef = this.db.collection(collection).doc();
        const docData = {
          ...item,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        batch.set(docRef, docData);
        results.push({
          ...docData,
          id: docRef.id,
        } as T);
      });

      await batch.commit();
      return results;
    } catch (error) {
      console.error(`Error batch creating documents in ${collection}:`, error);
      throw new Error(`Failed to batch create ${collection}`);
    }
  }

  // Validation helper
  protected validateRequired(data: any, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }
  }

  protected validateEnum(
    value: string,
    allowedValues: string[],
    fieldName: string
  ): void {
    if (!allowedValues.includes(value)) {
      throw new Error(
        `Invalid ${fieldName}: ${value}. Allowed values: ${allowedValues.join(', ')}`
      );
    }
  }

  protected validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
