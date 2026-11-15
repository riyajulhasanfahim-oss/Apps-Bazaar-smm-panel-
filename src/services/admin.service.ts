import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase/client';
import {
  FIRESTORE_COLLECTIONS,
  SETTINGS_DOC_IDS,
  type AdminStaffRole,
  type FirestoreSettingsDoc,
} from '../lib/firestore/collections';
import { OperationType, handleFirestoreError } from '../lib/firestore/errors';

const BOOTSTRAP_ADMIN_EMAIL = 'frofficialbd1@gmail.com';
const VALID_STAFF_ROLES: AdminStaffRole[] = [
  'super_admin',
  'admin',
  'manager',
  'support_staff',
];

export interface StaffAccessVerification {
  isStaff: boolean;
  staffRole: AdminStaffRole | null;
}

export const adminService = {
  /**
   * Verifies granular staff RBAC role from verified bootstrap owner email or active adminUsers record.
   */
  async verifyStaffAccess(
    uid: string,
    email?: string | null,
    emailVerified?: boolean
  ): Promise<StaffAccessVerification> {
    if (emailVerified && email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL) {
      return { isStaff: true, staffRole: 'super_admin' };
    }

    const services = getFirebaseServices();
    if (!services) return { isStaff: false, staffRole: null };

    try {
      const adminSnap = await getDoc(doc(services.db, FIRESTORE_COLLECTIONS.adminUsers, uid));
      if (adminSnap.exists()) {
        const data = adminSnap.data() as { role?: string; status?: string };
        const role = data.role as AdminStaffRole;
        if (data.status === 'active' && VALID_STAFF_ROLES.includes(role)) {
          return { isStaff: true, staffRole: role };
        }
      }
      return { isStaff: false, staffRole: null };
    } catch {
      return { isStaff: false, staffRole: null };
    }
  },

  /**
   * Verifies whether the signed-in user holds any authorized admin/staff console access.
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
