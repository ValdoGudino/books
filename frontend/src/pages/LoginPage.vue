<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuth } from "../composables/useAuth";

const { signInWithEmail, signUpWithEmail } = useAuth();
const router = useRouter();

const mode = ref("login"); // "login" | "signup"
const email = ref("");
const password = ref("");
const error = ref("");
const info = ref("");
const submitting = ref(false);

async function handleSubmit() {
    error.value = "";
    info.value = "";
    submitting.value = true;
    try {
        if (mode.value === "login") {
            const { error: err } = await signInWithEmail(email.value, password.value);
            if (err) throw err;
            router.push("/");
        } else {
            const { error: err } = await signUpWithEmail(email.value, password.value);
            if (err) throw err;
            info.value = "Check your email to confirm your account.";
        }
    } catch (e) {
        error.value = e.message || "Something went wrong";
    } finally {
        submitting.value = false;
    }
}
</script>

<template>
    <div class="login-page">
        <div class="login-card">
            <h2 class="login-title">{{ mode === "login" ? "Sign in" : "Create account" }}</h2>

            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="info" class="info">{{ info }}</p>

            <form @submit.prevent="handleSubmit" class="login-form">
                <label class="label">Email</label>
                <input
                    v-model="email"
                    type="email"
                    class="input"
                    placeholder="you@example.com"
                    required
                    autocomplete="email"
                />
                <label class="label">Password</label>
                <input
                    v-model="password"
                    type="password"
                    class="input"
                    placeholder="Password"
                    required
                    autocomplete="current-password"
                    minlength="6"
                />
                <button type="submit" class="btn login-btn" :disabled="submitting">
                    {{ submitting ? "..." : mode === "login" ? "Sign in" : "Sign up" }}
                </button>
            </form>

            <p class="login-toggle">
                <template v-if="mode === 'login'">
                    No account?
                    <button type="button" class="link-btn" @click="mode = 'signup'; error = ''; info = ''">
                        Create one
                    </button>
                </template>
                <template v-else>
                    Already have an account?
                    <button type="button" class="link-btn" @click="mode = 'login'; error = ''; info = ''">
                        Sign in
                    </button>
                </template>
            </p>
        </div>
    </div>
</template>

<style scoped>
.login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
}
.login-card {
    width: 100%;
    max-width: 22rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2rem;
}
.login-title {
    font-family: var(--font-serif);
    font-size: 1.5rem;
    color: var(--accent);
    margin: 0 0 1.25rem 0;
    text-align: center;
}
.login-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}
.login-btn {
    margin-top: 0.5rem;
    width: 100%;
}
.login-toggle {
    text-align: center;
    margin-top: 1rem;
    font-size: 0.9rem;
    color: var(--muted);
}
.link-btn {
    background: none;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: inherit;
    font-family: inherit;
    padding: 0;
    text-decoration: underline;
}
.info {
    color: var(--accent);
    margin: 0 0 1rem 0;
    padding: 0.75rem 1rem;
    background: rgba(201, 162, 39, 0.1);
    border-radius: 8px;
    font-size: 0.9rem;
}
</style>
