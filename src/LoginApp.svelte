<!-- Ember LoginApp: extracted from agyfdashboard index.html login card.
     Follows 2-step flow + cookie session from original LoginApp. -->
<script>
  import { onMount } from "svelte";

  let step = $state("login");
  let username = $state("");
  let password = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let error = $state("");
  let busy = $state(false);
  // Rescued 401 draft: displays as a yellow banner, disappears after login attempt.
  let rescued = $state(false);

  async function post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function login(e) {
    e.preventDefault();
    error = "";
    busy = true;
    try {
      const { res, data } = await post("/api/auth/login", { username, password });
      if (!res.ok) {
        error = data.error ?? "Login gagal. Coba lagi.";
        return;
      }
      rescued = false;
      if (data.must_change_password) {
        step = "change";
        password = "";
      } else {
        location.href = "dashboard.html";
      }
    } catch {
      error = "Tidak bisa menghubungi server. Coba lagi.";
    } finally {
      busy = false;
    }
  }

  async function change(e) {
    e.preventDefault();
    error = "";
    if (newPassword.length < 8) {
      error = "Password baru minimal 8 karakter.";
      return;
    }
    if (newPassword !== confirmPassword) {
      error = "Konfirmasi password tidak sama.";
      return;
    }
    busy = true;
    try {
      const { res, data } = await post("/api/auth/ganti-password", { newPassword });
      if (!res.ok) {
        error = data.error ?? "Ganti password gagal. Coba lagi.";
        return;
      }
      location.href = "dashboard.html";
    } catch {
      error = "Tidak bisa menghubungi server. Coba lagi.";
    } finally {
      busy = false;
    }
  }

  // Already logged in = redirect to dashboard. Draft 401 = flag banner.
  onMount(async () => {
    try {
      const me = await fetch("/api/auth/me");
      if (me.ok) {
        location.href = "dashboard.html";
        return;
      }
    } catch {}
    try {
      rescued = !!(
        localStorage.getItem("nava-draft-transaksi") ||
        localStorage.getItem("nava-draft-rab") ||
        localStorage.getItem("nava-draft-brief")
      );
    } catch {
      rescued = false;
    }
  });
</script>

<svelte:head>
  <style>
    body {
      background-color: #fafaf9;
      color: #1c1917;
      font-family: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</svelte:head>

<main class="min-h-dvh flex items-center justify-center p-4" style="background-color:#FAFAF9">
  <div class="w-full max-w-md bg-white rounded-2xl border border-stone-200 p-8 shadow-xl">
    <div class="text-center mb-6">
      <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#C2410C] text-white shadow-md mb-3" aria-hidden="true">
        <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="12 2 22 12 12 22 2 12" fill="white" stroke="none" />
          <circle cx="12" cy="12" r="3" fill="#C2410C" />
        </svg>
      </div>
      <h2 class="text-2xl font-extrabold tracking-tight text-stone-900" style="letter-spacing:-0.025em">NAVA CREATIVE</h2>
      <p class="text-xs text-stone-600 mt-1 uppercase tracking-wider font-semibold">Sistem Rental Alat Multimedia</p>
    </div>

    {#if rescued}
      <div class="mb-4" role="status">
        <div class="flex items-start gap-3 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-sm">
          <svg class="w-5 h-5 text-amber-700 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          <div>
            <p class="font-bold text-amber-950">Sesi Berakhir</p>
            <p class="text-xs text-amber-800 mt-0.5">Draft pekerjaan Anda telah diamankan otomatis ke penyimpanan lokal. Silakan login kembali untuk memulihkannya.</p>
          </div>
        </div>
      </div>
    {/if}

    {#if step === "login"}
      <form class="space-y-4" onsubmit={login}>
        <div>
          <label for="login-username" class="block text-xs font-semibold text-stone-700 mb-1">Nama Pengguna (Admin)</label>
          <input type="text" id="login-username" required autocomplete="username" bind:value={username} class="w-full text-sm p-2.5 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]" />
        </div>

        <div>
          <label for="login-password" class="block text-xs font-semibold text-stone-700 mb-1">Kata Sandi</label>
          <input type="password" id="login-password" required autocomplete="current-password" bind:value={password} class="w-full text-sm p-2.5 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]" />
        </div>

        {#if error}
          <div role="alert" class="text-xs text-red-700 font-semibold p-2.5 bg-red-50 border border-red-200 rounded-lg">{error}</div>
        {/if}

        <button type="submit" disabled={busy} class="w-full py-2.5 text-sm font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg shadow-sm hover:shadow transition-all duration-150 disabled:opacity-50">
          {busy ? "Memproses..." : "Masuk ke Dasbor"}
        </button>
      </form>
    {:else}
      <p class="text-xs text-stone-600 mb-4">Ini login pertamamu, buat password baru untuk mengganti password sekali pakai.</p>
      <form class="space-y-4" onsubmit={change}>
        <div>
          <label for="login-new" class="block text-xs font-semibold text-stone-700 mb-1">Kata Sandi Baru (min. 8 karakter)</label>
          <input type="password" id="login-new" required minlength="8" autocomplete="new-password" bind:value={newPassword} class="w-full text-sm p-2.5 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]" />
        </div>

        <div>
          <label for="login-confirm" class="block text-xs font-semibold text-stone-700 mb-1">Ulangi Kata Sandi Baru</label>
          <input type="password" id="login-confirm" required autocomplete="new-password" bind:value={confirmPassword} class="w-full text-sm p-2.5 bg-stone-50 border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C2410C]/20 focus:border-[#C2410C]" />
        </div>

        {#if error}
          <div role="alert" class="text-xs text-red-700 font-semibold p-2.5 bg-red-50 border border-red-200 rounded-lg">{error}</div>
        {/if}

        <button type="submit" disabled={busy} class="w-full py-2.5 text-sm font-semibold text-white bg-[#C2410C] hover:bg-[#9A3412] rounded-lg shadow-sm hover:shadow transition-all duration-150 disabled:opacity-50">
          {busy ? "Memproses..." : "Simpan dan Masuk"}
        </button>
      </form>
    {/if}
  </div>
</main>
