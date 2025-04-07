import { create } from 'zustand';
import { API_BASE } from '../services/api';
import { clearEmployeeCache } from '../services/employee.service';

interface AbsenceSyncState {
    isSyncing: boolean;
    lastSync: Date | null;
    syncError: string | null;
    syncAbsence: (startDate: string, endDate: string) => Promise<void>;
}

export const useAbsenceSyncStore = create<AbsenceSyncState>((set) => ({
    isSyncing: false,
    lastSync: null,
    syncError: null,

    syncAbsence: async (startDate: string, endDate: string) => {
        set({ isSyncing: true, syncError: null });
        try {
            console.log(`Syncing absence data for period ${startDate} to ${endDate}`);
            
            const response = await fetch(`${API_BASE}/sync/absence`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startDate, endDate }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                const errorMessage = data.error || data.details || 'Failed to sync absences';
                console.error('Absence sync error:', errorMessage);
                throw new Error(errorMessage);
            }

            console.log('Absence sync successful:', data);
            
            // Clear employee cache after successful sync
            await clearEmployeeCache();
            
            set({ lastSync: new Date(), syncError: null });
        } catch (error) {
            console.error('Absence sync error:', error);
            set({ 
                syncError: error instanceof Error 
                    ? error.message 
                    : typeof error === 'string' 
                        ? error 
                        : 'Failed to sync absences' 
            });
            throw error;
        } finally {
            set({ isSyncing: false });
        }
    },
})); 