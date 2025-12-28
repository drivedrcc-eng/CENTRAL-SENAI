import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

// Custom storage adapter to handle quota exceeded errors
const customStorage = {
    getItem: (key: string) => {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.error('Error getting item from localStorage', e);
            return null;
        }
    },
    setItem: (key: string, value: string) => {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            // If we hit quota, try to clear potential garbage or fallback to sessionStorage
            // For now, we'll try to use sessionStorage as a fallback so the user can at least log in
            console.warn('LocalStorage quota exceeded, falling back to sessionStorage for auth token');
            try {
                sessionStorage.setItem(key, value);
            } catch (e2) {
                console.error('SessionStorage also full or unavailable', e2);
            }
        }
    },
    removeItem: (key: string) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: customStorage,
        persistSession: true,
        autoRefreshToken: true,
    },
});
