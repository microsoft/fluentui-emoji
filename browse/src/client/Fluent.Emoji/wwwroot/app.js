const onPrefersDarkSchemeChanged = (dotnetObj, callbackMethodName) => {
  let media = window.matchMedia('(prefers-color-scheme: dark)');
  if (media) {
    media.onchange = async (mediaQueryListEvent) => {
      await dotnetObj.invokeMethodAsync(
        callbackMethodName,
        mediaQueryListEvent.matches);
    };
  }

  return media.matches;
};

window.app = Object.assign({}, window.app, {
  onPrefersDarkSchemeChanged
});