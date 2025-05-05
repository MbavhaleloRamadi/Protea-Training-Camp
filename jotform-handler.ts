// jotform-handler.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { firebaseConfig } from './firebase-config';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Simulate JotForm webhook handling (normally this would be done server-side or using a Cloud Function)
export async function saveJotFormSubmission(data: {
  name: string,
  email: string,
  tasks: string[],
  score: number
}) {
  try {
    await addDoc(collection(db, 'submissions'), {
      ...data,
      createdAt: Timestamp.now()
    });
    console.log('Submission saved to Firebase');
  } catch (err) {
    console.error('Error saving JotForm data:', err);
  }
}
