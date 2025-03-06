import { create } from 'zustand';

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
            const response = await fetch('/api/sync/absence', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startDate, endDate }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to sync absence data');
            }

            set({ lastSync: new Date(), syncError: null });
        } catch (error) {
            set({ syncError: error instanceof Error ? error.message : 'Failed to sync absence data' });
        } finally {
            set({ isSyncing: false });
        }
    },
})); 