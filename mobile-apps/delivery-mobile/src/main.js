const retry = document.getElementById('retry');

const hideSplashScreen = () => {
  const splashScreen = window.Capacitor?.Plugins?.SplashScreen;

  if (splashScreen?.hide) {
    splashScreen.hide().catch(() => undefined);
  }
};

window.addEventListener('load', () => {
  window.setTimeout(hideSplashScreen, 700);
});

if (retry) {
  retry.addEventListener('click', () => {
    window.location.href = 'https://www.nex-connect.in/sa/delivery';
  });
}
