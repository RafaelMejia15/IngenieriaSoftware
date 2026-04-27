import { User } from '@/types/user.types';
import { persist, createJSONStorage } from 'zustand/middleware';
import { create } from 'zustand';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
    token: string | null;
    user: User | null;
    setAuth: (token: string, user: User) => void;
    logout: () => void;
}

// Web usa localStorage, nativo usa AsyncStorage
const storage = Platform.OS === 'web'
    ? createJSONStorage(() => localStorage)
    : createJSONStorage(() => AsyncStorage);

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            user: null,
            setAuth: (token, user) => set({ token, user }),
            logout: () => set({ token: null, user: null }),
        }),
        {
            name: 'auth',
            storage,
        }
    )
);