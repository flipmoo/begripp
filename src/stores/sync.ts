import { create } from 'zustand';
import { clearEmployeeCache } from '../services/employee.service';

// Update API base URL to use port 3002
const API_BASE = 'http://localhost:3002/api';

interface SyncState {
    isSyncing: boolean;
    lastSync: Date | null;
    syncError: string | null;
    sync: (startDate: string, endDate: string) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set) => ({
    isSyncing: false,
    lastSync: null,
    syncError: null,

    sync: async (startDate: string, endDate: string) => {
        set({ isSyncing: true, syncError: null });
        try {
            console.log(`Syncing data for period ${startDate} to ${endDate}`);
            
            // Clear client-side cache before making API call
            // This ensures fresh data even if the API call fails
            clearEmployeeCache();
            
            const response = await fetch(`${API_BASE}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startDate, endDate }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                const errorMessage = data.error || data.details || 'Failed to sync';
                console.error('Sync error:', errorMessage);
                throw new Error(errorMessage);
            }

            console.log('Sync successful:', data);
            
            // Clear employee cache on server after successful sync
            await clearEmployeeCache();
            
            set({ lastSync: new Date(), syncError: null });
        } catch (error) {
            console.error('Sync error:', error);
            set({ 
                syncError: error instanceof Error 
                    ? error.message 
                    : typeof error === 'string' 
                        ? error 
                        : 'Failed to sync' 
            });
            throw error;
        } finally {
            set({ isSyncing: false });
        }
    },
})); 