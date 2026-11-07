import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

let projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;

if (!projectId) {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      projectId = parsed.projectId;
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json:', err);
  }
}

if (!getApps().length) {
  initializeApp({
    projectId: projectId || 'menkir-default',
  });
}

export const adminAuth = getAuth();
