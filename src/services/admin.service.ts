import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase/client';
import {
  FIRESTORE_COLLECTIONS,
  SETTINGS_DOC_IDS,
  type AdminStaffRole,
  type FirestoreSettingsDoc,
} from '../lib/firestore/collections';
import { OperationType, handleFirestoreError } from '../lib/firestore/errors';

const DESIGNATED_ADMIN_EMAIL = 'riyajulhasanfahim@gmail.com';

export interface StaffAccessVerification {
  isStaff: boolean;
  staffRole: AdminStaffRole | null;
  reason?: 'verified' | 'not_admin' | 'email_unverified';
}

export const adminService = {
  isDesignatedAdminEmail(email?: string | null): boolean {
    return Boolean(email && email.trim().toLowerCase() === DESIGNATED_ADMIN_EMAIL);
  },

  /**
   * Verifies server-side Admin authorization via /api/auth/verify-admin with Firebase ID token.
   * Only the designated verified administrator (riyajulhasanfahim@gmail.com) is authorized.
   */
  async verifyStaffAccess(
    _uid: string,
    email?: string | null,
    emailVerified?: boolean
  ): Promise<StaffAccessVerification> {
    if (!this.isDesignatedAdminEmail(email)) {
      return { isStaff: false, staffRole: null, reason: 'not_admin' };
    }

    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) {
      return { isStaff: false, staffRole: null, reason: 'not_admin' };
    }

    try {
      const idToken = await services.auth.currentUser.getIdToken();
      const res = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          firebaseProjectId: services.config.projectId,
          firebaseDatabaseId: services.config.firestoreDatabaseId || '(default)',
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          ok?: boolean;
          isAdmin?: boolean;
          staffRole?: AdminStaffRole | null;
          reason?: 'verified' | 'not_admin' | 'email_unverified';
        };
        if (json.ok && json.isAdmin) {
          return {
            isStaff: true,
            staffRole: json.staffRole || 'super_admin',
            reason: 'verified',
          };
        }
        return {
          isStaff: false,
          staffRole: null,
          reason: json.reason || (emailVerified ? 'not_admin' : 'email_unverified'),
        };
      }
    } catch {
      // If server verify endpoint is unreachable (e.g. static build), fall back strictly to verified Firebase Auth user
      if (emailVerified && this.isDesignatedAdminEmail(email)) {
        return { isStaff: true, staffRole: 'super_admin', reason: 'verified' };
      }
    }

    return {
      isStaff: false,
      staffRole: null,
      reason: emailVerified ? 'not_admin' : 'email_unverified',
    };
  },

  /**
   * Verifies whether the signed-in user holds authorized admin access.
   */
  async verifyAdminRole(
    uid: string,
    email?: string | null,
    emailVerified?: boolean
  ): Promise<boolean> {
    const res = await this.verifyStaffAccess(uid, email, emailVerified);
    return res.isStaff;
  },

  /**
   * Fetches public/system settings document from Firestore.
   */
  async getSystemSettings(): Promise<Partial<FirestoreSettingsDoc> | null> {
    const services = getFirebaseServices();
    if (!services) return null;

    try {
      const snap = await getDoc(
        doc(services.db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system)
      );
      return snap.exists() ? (snap.data() as FirestoreSettingsDoc) : null;
    } catch {
      return null;
    }
  },

  /**
   * Updates white-label system settings (Admin-only via Firestore rules).
   */
  async updateSystemSettings(patch: Partial<FirestoreSettingsDoc>): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const ref = doc(services.db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system);
    try {
      const existingSnap = await getDoc(ref);
      const baseDefaults = existingSnap.exists()
        ? {}
        : {
            websiteName: patch.websiteName || 'SMM Panel',
            currency: patch.currency || 'BDT',
            maintenanceMode: patch.maintenanceMode ?? false,
          };

      await setDoc(
        ref,
        {
          ...baseDefaults,
          ...patch,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.settings}/${SETTINGS_DOC_IDS.system}`,
        services.auth
      );
    }
  },
};
