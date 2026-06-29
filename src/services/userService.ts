// src/services/userService.ts
import { apiFetch } from '../config/supabase';
import { User } from '../types';

export class UserService {
  static async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    try {
      const res = await apiFetch('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to update user data');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user data');
    }
  }

  static async updateUserLogo(userId: string, logoBase64: string | undefined): Promise<void> {
    try {
      await this.updateUser(userId, { companyLogo: logoBase64 } as any);
    } catch (error) {
      console.error('Error updating user logo:', error);
      throw new Error('Failed to update company logo');
    }
  }

  static async updateUserPreferences(userId: string, preferences: { currency: 'USD' | 'ZWG'; vatRate: number }): Promise<void> {
    try {
      await this.updateUser(userId, { preferences } as any);
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw new Error('Failed to update preferences');
    }
  }
}
