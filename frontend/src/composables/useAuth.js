import { ref, readonly } from "vue";
import { supabase } from "../lib/supabase";

const user = ref(null);
const session = ref(null);
const loading = ref(true);

// Listen for auth state changes once at module level
supabase.auth.onAuthStateChange((_event, sess) => {
    session.value = sess;
    user.value = sess?.user ?? null;
    loading.value = false;
});

// Kick off initial session check
supabase.auth.getSession().then(({ data }) => {
    session.value = data.session;
    user.value = data.session?.user ?? null;
    loading.value = false;
});

export function useAuth() {
    async function signInWithEmail(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error };
    }

    async function signUpWithEmail(email, password) {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error };
    }

    async function signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    }

    function getAccessToken() {
        return session.value?.access_token ?? null;
    }

    return {
        user: readonly(user),
        session: readonly(session),
        loading: readonly(loading),
        signInWithEmail,
        signUpWithEmail,
        signOut,
        getAccessToken,
    };
}
