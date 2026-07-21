/**
 * API client for syncing data with the backend server
 * Data is saved to JSON files in the project directory
 */

const SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Check server health
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SERVER_URL}/api/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export interface SyncedAllData {
  success: boolean;
  data: Record<string, any> | null;
}

export async function saveAllDataToServer(data: Record<string, any>): Promise<SyncResult> {
  try {
    const response = await fetch(`${SERVER_URL}/api/save-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Server saved all data:', result);
    return { success: true, message: 'All data saved to server' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('❌ Failed to save all data:', msg);
    return { success: false, error: msg };
  }
}

export async function loadAllDataFromServer(): Promise<SyncedAllData> {
  try {
    const response = await fetch(`${SERVER_URL}/api/load-all`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log('✅ Server loaded all data');
    return { success: result.success, data: result.data };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn('⚠️  Could not load all data from server:', msg);
    return { success: false, data: null };
  }
}
