import { create } from 'zustand';

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
            const response = await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ startDate, endDate }),
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(error);
            }

            set({ lastSync: new Date(), syncError: null });
        } catch (error) {
            set({ syncError: error instanceof Error ? error.message : 'Failed to sync' });
        } finally {
            set({ isSyncing: false });
        }
    },
})); 