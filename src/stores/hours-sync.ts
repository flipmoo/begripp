import { create } from 'zustand';

interface HoursSyncState {
    isSyncing: boolean;
    lastSync: Date | null;
    syncError: string | null;
    syncHours: (startDate: string, endDate: string) => Promise<void>;
}

export const useHoursSyncStore = create<HoursSyncState>((set) => ({
    isSyncing: false,
    lastSync: null,
    syncError: null,

    syncHours: async (startDate: string, endDate: string) => {
        set({ isSyncing: true, syncError: null });
        try {
            const response = await fetch('/api/sync/hours', {
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
            set({ syncError: error instanceof Error ? error.message : 'Failed to sync hours' });
        } finally {
            set({ isSyncing: false });
        }
    },
})); 