import { create } from 'zustand';
import { API_BASE } from '../services/api';
import { clearEmployeeCache } from '../services/employee.service';

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

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Sync error response:', errorText);
                
                let errorData;
                try {
                    errorData = JSON.parse(errorText);
                } catch (e) {
                    console.error('Failed to parse error response as JSON:', e);
                    throw new Error(`Sync failed with status ${response.status}: ${errorText.substring(0, 100)}`);
                }
                
                const errorMessage = errorData.error || errorData.details || `Failed to sync with status ${response.status}`;
                console.error('Sync error:', errorMessage);
                throw new Error(errorMessage);
            }
            
            const data = await response.json();
            console.log('Sync successful:', data);
            
            // Clear employee cache after successful sync
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