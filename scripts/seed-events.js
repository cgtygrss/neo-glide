// Emulator-only seed: never publishes a live event or grants production rewards.
import { initializeApp } from '../backend/node_modules/firebase-admin/lib/app/index.js';
import { getFirestore } from '../backend/node_modules/firebase-admin/lib/firestore/index.js';
import { DEFAULT_TEMPLATES, DAY } from '../backend/shared/events.js';
if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('This script only runs against the emulator.');
initializeApp({projectId:'demo-neo-glide'});
await getFirestore('events').doc('configuration/events').set({drafts:DEFAULT_TEMPLATES.map(t=>({...t,startsAt:Date.now()-DAY,endsAt:Date.now()+30*DAY})),published:DEFAULT_TEMPLATES.map(t=>({...t,revision:1,startsAt:Date.now()-DAY,endsAt:Date.now()+30*DAY}))});
console.log('Emulator event templates published.');
