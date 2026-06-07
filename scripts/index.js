  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('btnInstall').style.display = 'inline-flex';
  });

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('btnInstall').style.display = 'none';
    }
    deferredPrompt = null;
  };

  window.addEventListener('appinstalled', () => {
    document.getElementById('btnInstall').style.display = 'none';
    deferredPrompt = null;
  });
