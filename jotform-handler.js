"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveJotFormSubmission = saveJotFormSubmission;
// jotform-handler.ts
const app_1 = require("firebase/app");
const firestore_1 = require("firebase/firestore");
const firebase_config_1 = require("./firebase-config");
const app = (0, app_1.initializeApp)(firebase_config_1.firebaseConfig);
const db = (0, firestore_1.getFirestore)(app);
// Simulate JotForm webhook handling (normally this would be done server-side or using a Cloud Function)
function saveJotFormSubmission(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, firestore_1.addDoc)((0, firestore_1.collection)(db, 'submissions'), Object.assign(Object.assign({}, data), { createdAt: firestore_1.Timestamp.now() }));
            console.log('Submission saved to Firebase');
        }
        catch (err) {
            console.error('Error saving JotForm data:', err);
        }
    });
}
