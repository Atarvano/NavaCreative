<script>
  // LoginApp: the /login page shell. Step 1 = username+password form, step 2
  // (forced when must_change_password) = new-password form. On success the
  // API sets the HttpOnly session cookie and we hard-navigate to dashboard.
  let step = $state('login');
  let username = $state('');
  let password = $state('');
  let newPassword = $state('');
  let confirmPassword = $state('');
  let error = $state('');
  let busy = $state(false);

  async function post(path, body) {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  }

  async function login(e) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const { res, data } = await post('/api/auth/login', { username, password });
      if (!res.ok) {
        error = data.error ?? 'Login gagal. Coba lagi.';
        return;
      }
      if (data.must_change_password) {
        step = 'change';
        password = '';
      } else {
        location.href = 'dashboard.html';
      }
    } catch {
      error = 'Tidak bisa menghubungi server. Coba lagi.';
    } finally {
      busy = false;
    }
  }

  async function change(e) {
    e.preventDefault();
    error = '';
    if (newPassword.length < 8) {
      error = 'Password baru minimal 8 karakter.';
      return;
    }
    if (newPassword !== confirmPassword) {
      error = 'Konfirmasi password tidak sama.';
      return;
    }
    busy = true;
    try {
      const { res, data } = await post('/api/auth/ganti-password', { newPassword });
      if (!res.ok) {
        error = data.error ?? 'Ganti password gagal. Coba lagi.';
        return;
      }
      location.href = 'dashboard.html';
    } catch {
      error = 'Tidak bisa menghubungi server. Coba lagi.';
    } finally {
      busy = false;
    }
  }
</script>

<main class="grid min-h-dvh place-items-center bg-canvas px-(--pad)">
  <div class="w-full max-w-sm">
    <p class="text-subheading font-normal">Nava Creative</p>
    <h1 class="mt-1 text-heading-sm font-light">Masuk dashboard</h1>

    {#if step === 'login'}
      <form class="mt-8 grid gap-4" onsubmit={login}>
        <label class="grid gap-1 text-body-sm">
          Username
          <input
            class="rounded-none border border-ash bg-bone-white px-4 py-3 text-body"
            type="text"
            name="username"
            autocomplete="username"
            required
            bind:value={username}
          />
        </label>
        <label class="grid gap-1 text-body-sm">
          Password
          <input
            class="rounded-none border border-ash bg-bone-white px-4 py-3 text-body"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            bind:value={password}
          />
        </label>
        {#if error}<p role="alert" class="text-body-sm text-magenta-bloom">{error}</p>{/if}
        <button
          class="rounded-pill bg-navy-ink px-6 py-3 text-body-sm text-bone-white disabled:opacity-50"
          type="submit"
          disabled={busy}
        >
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    {:else}
      <p class="mt-4 text-body-sm text-graphite">
        Ini login pertamamu — buat password baru untuk mengganti password sekali pakai.
      </p>
      <form class="mt-8 grid gap-4" onsubmit={change}>
        <label class="grid gap-1 text-body-sm">
          Password baru (min. 8 karakter)
          <input
            class="rounded-none border border-ash bg-bone-white px-4 py-3 text-body"
            type="password"
            name="new-password"
            autocomplete="new-password"
            required
            minlength="8"
            bind:value={newPassword}
          />
        </label>
        <label class="grid gap-1 text-body-sm">
          Ulangi password baru
          <input
            class="rounded-none border border-ash bg-bone-white px-4 py-3 text-body"
            type="password"
            name="confirm-password"
            autocomplete="new-password"
            required
            bind:value={confirmPassword}
          />
        </label>
        {#if error}<p role="alert" class="text-body-sm text-magenta-bloom">{error}</p>{/if}
        <button
          class="rounded-pill bg-navy-ink px-6 py-3 text-body-sm text-bone-white disabled:opacity-50"
          type="submit"
          disabled={busy}
        >
          {busy ? 'Memproses…' : 'Simpan & masuk'}
        </button>
      </form>
    {/if}
  </div>
</main>
