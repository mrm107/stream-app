// WebView
(function () {
    var eventHandlers = {};
  
    var locationHash = '';
    try {
      locationHash = location.hash.toString();
    } catch (e) {}
  
    var initParams = urlParseHashParams(locationHash);
    var storedParams = sessionStorageGet('initParams');
    if (storedParams) {
      for (var key in storedParams) {
        if (typeof initParams[key] === 'undefined') {
          initParams[key] = storedParams[key];
        }
      }
    }
    sessionStorageSet('initParams', initParams);
  
    var isIframe = false, iFrameStyle;
    try {
      isIframe = (window.parent != null && window != window.parent);
      if (isIframe) {
        window.addEventListener('message', function (event) {
          if (event.source !== window.parent) return;
          try {
            var dataParsed = JSON.parse(event.data);
          } catch (e) {
            return;
          }
          if (!dataParsed || !dataParsed.eventType) {
            return;
          }
          if (dataParsed.eventType == 'set_custom_style') {
            if (event.origin === 'https://web.eitaa.com') {
              iFrameStyle.innerHTML = dataParsed.eventData;
            }
          } else if (dataParsed.eventType == 'reload_iframe') {
            try {
              window.parent.postMessage(JSON.stringify({eventType: 'iframe_will_reload'}), '*');
            } catch (e) {}
            location.reload();
          } else {
            receiveEvent(dataParsed.eventType, dataParsed.eventData);
          }
        });
        iFrameStyle = document.createElement('style');
        document.head.appendChild(iFrameStyle);
        try {
          window.parent.postMessage(JSON.stringify({eventType: 'iframe_ready', eventData: {reload_supported: true}}), '*');
        } catch (e) {}
      }
    } catch (e) {}
  
    function urlSafeDecode(urlencoded) {
      try {
        urlencoded = urlencoded.replace(/\+/g, '%20');
        return decodeURIComponent(urlencoded);
      } catch (e) {
        return urlencoded;
      }
    }
  
    function urlParseHashParams(locationHash) {
      locationHash = locationHash.replace(/^#/, '');
      var params = {};
      if (!locationHash.length) {
        return params;
      }
      if (locationHash.indexOf('=') < 0 && locationHash.indexOf('?') < 0) {
        params._path = urlSafeDecode(locationHash);
        return params;
      }
      var qIndex = locationHash.indexOf('?');
      if (qIndex >= 0) {
        var pathParam = locationHash.substr(0, qIndex);
        params._path = urlSafeDecode(pathParam);
        locationHash = locationHash.substr(qIndex + 1);
      }
      var query_params = urlParseQueryString(locationHash);
      for (var k in query_params) {
        params[k] = query_params[k];
      }
      return params;
    }
  
    function urlParseQueryString(queryString) {
      var params = {};
      if (!queryString.length) {
        return params;
      }
      var queryStringParams = queryString.split('&');
      var i, param, paramName, paramValue;
      for (i = 0; i < queryStringParams.length; i++) {
        param = queryStringParams[i].split('=');
        paramName = urlSafeDecode(param[0]);
        paramValue = param[1] == null ? null : urlSafeDecode(param[1]);
        params[paramName] = paramValue;
      }
      return params;
    }
  
    function postEvent(eventType, callback, eventData) {
      if (!callback) {
        callback = function () {};
      }
      if (eventData === undefined) {
        eventData = '';
      }
      console.log('[Eitaa.WebView] > postEvent', eventType, eventData);
  
      if (window.EitaaWebviewProxy !== undefined) {
        EitaaWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
        callback();
      }
      else if (window.external && 'notify' in window.external) {
        window.external.notify(JSON.stringify({eventType: eventType, eventData: eventData}));
        callback();
      }
      else if (isIframe) {
        try {
          var trustedTarget = 'https://web.eitaa.com';
          // For now we don't restrict target, for testing purposes
          trustedTarget = '*';
          window.parent.postMessage(JSON.stringify({eventType: eventType, eventData: eventData}), trustedTarget);
          callback();
        } catch (e) {
          callback(e);
        }
      }
      else {
        callback({notAvailable: true});
      }
    };
  
    function receiveEvent(eventType, eventData) {
      console.log('[Eitaa.WebView] < receiveEvent', eventType, eventData);
      callEventCallbacks(eventType, function(callback) {
        callback(eventType, eventData);
      });
    }
  
    function callEventCallbacks(eventType, func) {
      var curEventHandlers = eventHandlers[eventType];
      if (curEventHandlers === undefined ||
          !curEventHandlers.length) {
        return;
      }
      for (var i = 0; i < curEventHandlers.length; i++) {
        try {
          func(curEventHandlers[i]);
        } catch (e) {}
      }
    }
  
    function onEvent(eventType, callback) {
      if (eventHandlers[eventType] === undefined) {
        eventHandlers[eventType] = [];
      }
      var index = eventHandlers[eventType].indexOf(callback);
      if (index === -1) {
        eventHandlers[eventType].push(callback);
      }
    };
  
    function offEvent(eventType, callback) {
      if (eventHandlers[eventType] === undefined) {
        return;
      }
      var index = eventHandlers[eventType].indexOf(callback);
      if (index === -1) {
        return;
      }
      eventHandlers[eventType].splice(index, 1);
    };
  
    function openProtoUrl(url) {
      if (!url.match(/^(web\+)?tgb?:\/\/./)) {
        return false;
      }
      var useIframe = navigator.userAgent.match(/iOS|iPhone OS|iPhone|iPod|iPad/i) ? true : false;
      if (useIframe) {
        var iframeContEl = document.getElementById('tgme_frame_cont') || document.body;
        var iframeEl = document.createElement('iframe');
        iframeContEl.appendChild(iframeEl);
        var pageHidden = false;
        var enableHidden = function () {
          pageHidden = true;
        };
        window.addEventListener('pagehide', enableHidden, false);
        window.addEventListener('blur', enableHidden, false);
        if (iframeEl !== null) {
          iframeEl.src = url;
        }
        setTimeout(function() {
          if (!pageHidden) {
            window.location = url;
          }
          window.removeEventListener('pagehide', enableHidden, false);
          window.removeEventListener('blur', enableHidden, false);
        }, 2000);
      }
      else {
        window.location = url;
      }
      return true;
    }
  
    function sessionStorageSet(key, value) {
      try {
        window.sessionStorage.setItem('__eitaa__' + key, JSON.stringify(value));
        return true;
      } catch(e) {}
      return false;
    }
    function sessionStorageGet(key) {
      try {
        return JSON.parse(window.sessionStorage.getItem('__eitaa__' + key));
      } catch(e) {}
      return null;
    }
  
    if (!window.Eitaa) {
      window.Eitaa = {};
    }
    window.Eitaa.WebView = {
      initParams: initParams,
      isIframe: isIframe,
      onEvent: onEvent,
      offEvent: offEvent,
      postEvent: postEvent,
      receiveEvent: receiveEvent,
      callEventCallbacks: callEventCallbacks
    };
  
    window.Eitaa.Utils = {
      urlSafeDecode: urlSafeDecode,
      urlParseQueryString: urlParseQueryString,
      urlParseHashParams: urlParseHashParams,
      sessionStorageSet: sessionStorageSet,
      sessionStorageGet: sessionStorageGet
    };
  
    // For Windows Phone app
    window.EitaaGameProxy_receiveEvent = receiveEvent;
  
    // App backward compatibility
    window.EitaaGameProxy = {
      receiveEvent: receiveEvent
    };
  })();
  
  // WebApp
  (function () {
    var Utils = window.Eitaa.Utils;
    var WebView = window.Eitaa.WebView;
    var initParams = WebView.initParams;
    var isIframe = WebView.isIframe;
  
    var WebApp = {};
    var webAppInitData = '', webAppInitDataUnsafe = {};
    var themeParams = {}, colorScheme = 'light';
    var webAppVersion = '0.0';
    var webAppPlatform = 'unknown';
    var webAppIsActive = true;
    var webAppIsFullscreen = false;
    var webAppIsOrientationLocked = false;
    var webAppBackgroundColor = 'bg_color';
    var webAppHeaderColorKey = 'bg_color';
    var webAppHeaderColor = null;
  
    if (initParams.tgWebAppData && initParams.tgWebAppData.length) {
      webAppInitData = initParams.tgWebAppData;
      webAppInitDataUnsafe = Utils.urlParseQueryString(webAppInitData);
      for (var key in webAppInitDataUnsafe) {
        var val = webAppInitDataUnsafe[key];
        try {
          if (val.substr(0, 1) == '{' && val.substr(-1) == '}' ||
              val.substr(0, 1) == '[' && val.substr(-1) == ']') {
            webAppInitDataUnsafe[key] = JSON.parse(val);
          }
        } catch (e) {}
      }
    }
    var stored_theme_params = Utils.sessionStorageGet('themeParams');
    if (initParams.tgWebAppThemeParams && initParams.tgWebAppThemeParams.length) {
      var themeParamsRaw = initParams.tgWebAppThemeParams;
      try {
        var theme_params = JSON.parse(themeParamsRaw);
        if (theme_params) {
          setThemeParams(theme_params);
        }
      } catch (e) {}
    }
    if (stored_theme_params) {
      setThemeParams(stored_theme_params);
    }
    var stored_def_colors = Utils.sessionStorageGet('defaultColors');
    if (initParams.tgWebAppDefaultColors && initParams.tgWebAppDefaultColors.length) {
      var defColorsRaw = initParams.tgWebAppDefaultColors;
      try {
        var def_colors = JSON.parse(defColorsRaw);
        if (def_colors) {
          setDefaultColors(def_colors);
        }
      } catch (e) {}
    }
    if (stored_def_colors) {
      setDefaultColors(stored_def_colors);
    }
    if (initParams.tgWebAppVersion) {
      webAppVersion = initParams.tgWebAppVersion;
    }
    if (initParams.tgWebAppPlatform) {
      webAppPlatform = initParams.tgWebAppPlatform;
    }
  
    var stored_fullscreen = Utils.sessionStorageGet('isFullscreen');
    if (initParams.tgWebAppFullscreen) {
      setFullscreen(true);
    }
    if (stored_fullscreen) {
      setFullscreen(stored_fullscreen == 'yes');
    }
  
    var stored_orientation_lock = Utils.sessionStorageGet('isOrientationLocked');
    if (stored_orientation_lock) {
      setOrientationLock(stored_orientation_lock == 'yes');
    }
  
    function onThemeChanged(eventType, eventData) {
      if (eventData.theme_params) {
        setThemeParams(eventData.theme_params);
        window.Eitaa.WebApp.MainButton.setParams({});
        window.Eitaa.WebApp.SecondaryButton.setParams({});
        updateHeaderColor();
        updateBackgroundColor();
        updateBottomBarColor();
        receiveWebViewEvent('themeChanged');
      }
    }
  
    var lastWindowHeight = window.innerHeight;
    function onViewportChanged(eventType, eventData) {
      if (eventData.height) {
        window.removeEventListener('resize', onWindowResize);
        setViewportHeight(eventData);
      }
    }
  
    function onWindowResize(e) {
      if (lastWindowHeight != window.innerHeight) {
        lastWindowHeight = window.innerHeight;
        receiveWebViewEvent('viewportChanged', {
          isStateStable: true
        });
      }
    }
  
    function onSafeAreaChanged(eventType, eventData) {
      if (eventData) {
        setSafeAreaInset(eventData);
      }
    }
    function onContentSafeAreaChanged(eventType, eventData) {
      if (eventData) {
        setContentSafeAreaInset(eventData);
      }
    }
  
    function onVisibilityChanged(eventType, eventData) {
      if (eventData.is_visible) {
        webAppIsActive = true;
        receiveWebViewEvent('activated');
      } else {
        webAppIsActive = false;
        receiveWebViewEvent('deactivated');
      }
    }
  
    function linkHandler(e) {
      if (e.metaKey || e.ctrlKey) return;
      var el = e.target;
      while (el.tagName != 'A' && el.parentNode) {
        el = el.parentNode;
      }
      if (el.tagName == 'A' &&
          el.target != '_blank' &&
          (el.protocol == 'http:' || el.protocol == 'https:') &&
          el.hostname == 'eitaa.com') {
        WebApp.openTgLink(el.href);
        e.preventDefault();
      }
    }
  
    function strTrim(str) {
      return str.toString().replace(/^\s+|\s+$/g, '');
    }
  
    function receiveWebViewEvent(eventType) {
      var args = Array.prototype.slice.call(arguments);
      eventType = args.shift();
      WebView.callEventCallbacks('webview:' + eventType, function(callback) {
        callback.apply(WebApp, args);
      });
    }
  
    function onWebViewEvent(eventType, callback) {
      WebView.onEvent('webview:' + eventType, callback);
    };
  
    function offWebViewEvent(eventType, callback) {
      WebView.offEvent('webview:' + eventType, callback);
    };
  
    function setCssProperty(name, value) {
      var root = document.documentElement;
      if (root && root.style && root.style.setProperty) {
        root.style.setProperty('--tg-' + name, value);
      }
    }
  
    function setFullscreen(is_fullscreen) {
      webAppIsFullscreen = !!is_fullscreen;
      Utils.sessionStorageSet('isFullscreen', webAppIsFullscreen ? 'yes' : 'no');
    }
  
    function setOrientationLock(is_locked) {
      webAppIsOrientationLocked = !!is_locked;
      Utils.sessionStorageSet('isOrientationLocked', webAppIsOrientationLocked ? 'yes' : 'no');
    }
  
    function setThemeParams(theme_params) {
      // temp iOS fix
      if (theme_params.bg_color == '#1c1c1d' &&
          theme_params.bg_color == theme_params.secondary_bg_color) {
        theme_params.secondary_bg_color = '#2c2c2e';
      }
      var color;
      for (var key in theme_params) {
        if (color = parseColorToHex(theme_params[key])) {
          themeParams[key] = color;
          if (key == 'bg_color') {
            colorScheme = isColorDark(color) ? 'dark' : 'light'
            setCssProperty('color-scheme', colorScheme);
          }
          key = 'theme-' + key.split('_').join('-');
          setCssProperty(key, color);
        }
      }
      Utils.sessionStorageSet('themeParams', themeParams);
    }
  
    function setDefaultColors(def_colors) {
      if (colorScheme == 'dark') {
        if (def_colors.bg_dark_color) {
          webAppBackgroundColor = def_colors.bg_dark_color;
        }
        if (def_colors.header_dark_color) {
          webAppHeaderColorKey = null;
          webAppHeaderColor = def_colors.header_dark_color;
        }
      } else {
        if (def_colors.bg_color) {
          webAppBackgroundColor = def_colors.bg_color;
        }
        if (def_colors.header_color) {
          webAppHeaderColorKey = null;
          webAppHeaderColor = def_colors.header_color;
        }
      }
      Utils.sessionStorageSet('defaultColors', def_colors);
    }
  
    var webAppCallbacks = {};
    function generateCallbackId(len) {
      var tries = 100;
      while (--tries) {
        var id = '', chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', chars_len = chars.length;
        for (var i = 0; i < len; i++) {
          id += chars[Math.floor(Math.random() * chars_len)];
        }
        if (!webAppCallbacks[id]) {
          webAppCallbacks[id] = {};
          return id;
        }
      }
      throw Error('WebAppCallbackIdGenerateFailed');
    }
  
    var viewportHeight = false, viewportStableHeight = false, isExpanded = true;
    function setViewportHeight(data) {
      if (typeof data !== 'undefined') {
        isExpanded = !!data.is_expanded;
        viewportHeight = data.height;
        if (data.is_state_stable) {
          viewportStableHeight = data.height;
        }
        receiveWebViewEvent('viewportChanged', {
          isStateStable: !!data.is_state_stable
        });
      }
      var height, stable_height;
      if (viewportHeight !== false) {
        height = (viewportHeight - bottomBarHeight) + 'px';
      } else {
        height = bottomBarHeight ? 'calc(100vh - ' + bottomBarHeight + 'px)' : '100vh';
      }
      if (viewportStableHeight !== false) {
        stable_height = (viewportStableHeight - bottomBarHeight) + 'px';
      } else {
        stable_height = bottomBarHeight ? 'calc(100vh - ' + bottomBarHeight + 'px)' : '100vh';
      }
      setCssProperty('viewport-height', height);
      setCssProperty('viewport-stable-height', stable_height);
    }
  
    var safeAreaInset = {top: 0, bottom: 0, left: 0, right: 0};
    function setSafeAreaInset(data) {
      if (typeof data !== 'undefined') {
        if (typeof data.top !== 'undefined') {
          safeAreaInset.top = data.top;
        }
        if (typeof data.bottom !== 'undefined') {
          safeAreaInset.bottom = data.bottom;
        }
        if (typeof data.left !== 'undefined') {
          safeAreaInset.left = data.left;
        }
        if (typeof data.right !== 'undefined') {
          safeAreaInset.right = data.right;
        }
        receiveWebViewEvent('safeAreaChanged');
      }
      setCssProperty('safe-area-inset-top', safeAreaInset.top + 'px');
      setCssProperty('safe-area-inset-bottom', safeAreaInset.bottom + 'px');
      setCssProperty('safe-area-inset-left', safeAreaInset.left + 'px');
      setCssProperty('safe-area-inset-right', safeAreaInset.right + 'px');
    }
  
    var contentSafeAreaInset = {top: 0, bottom: 0, left: 0, right: 0};
    function setContentSafeAreaInset(data) {
      if (typeof data !== 'undefined') {
        if (typeof data.top !== 'undefined') {
          contentSafeAreaInset.top = data.top;
        }
        if (typeof data.bottom !== 'undefined') {
          contentSafeAreaInset.bottom = data.bottom;
        }
        if (typeof data.left !== 'undefined') {
          contentSafeAreaInset.left = data.left;
        }
        if (typeof data.right !== 'undefined') {
          contentSafeAreaInset.right = data.right;
        }
        receiveWebViewEvent('contentSafeAreaChanged');
      }
      setCssProperty('content-safe-area-inset-top', contentSafeAreaInset.top + 'px');
      setCssProperty('content-safe-area-inset-bottom', contentSafeAreaInset.bottom + 'px');
      setCssProperty('content-safe-area-inset-left', contentSafeAreaInset.left + 'px');
      setCssProperty('content-safe-area-inset-right', contentSafeAreaInset.right + 'px');
    }
  
    var isClosingConfirmationEnabled = false;
    function setClosingConfirmation(need_confirmation) {
      if (!versionAtLeast('1.0')) {
        console.warn('[Eitaa.WebApp] Closing confirmation is not supported in version ' + webAppVersion);
        return;
      }
      isClosingConfirmationEnabled = !!need_confirmation;
      WebView.postEvent('web_app_setup_closing_behavior', false, {need_confirmation: isClosingConfirmationEnabled});
    }
  
    var isVerticalSwipesEnabled = true;
    function toggleVerticalSwipes(enable_swipes) {
      if (!versionAtLeast('1.0')) {
        console.warn('[Eitaa.WebApp] Changing swipes behavior is not supported in version ' + webAppVersion);
        return;
      }
      isVerticalSwipesEnabled = !!enable_swipes;
      WebView.postEvent('web_app_setup_swipe_behavior', false, {allow_vertical_swipe: isVerticalSwipesEnabled});
    }

    var isWindowSecureEnabled = false;
    function toggleWindowSecure(enable_secure) {
      if (!versionAtLeast('1.5')) {
        console.warn('[Eitaa.WebApp] Changing window secure behavior is not supported in version ' + webAppVersion);
        return;
      }
      isWindowSecureEnabled = !!enable_secure;
      WebView.postEvent('web_app_update_window_secure', false, {allowSecure: isWindowSecureEnabled});
    }
  
    function onFullscreenChanged(eventType, eventData) {
      setFullscreen(eventData.is_fullscreen);
      receiveWebViewEvent('fullscreenChanged');
    }
    function onFullscreenFailed(eventType, eventData) {
      if (eventData.error == 'ALREADY_FULLSCREEN' && !webAppIsFullscreen) {
        setFullscreen(true);
      }
      receiveWebViewEvent('fullscreenFailed', {
        error: eventData.error
      });
    }
  
    function toggleOrientationLock(locked) {
      if (!versionAtLeast('1.3')) {
        console.warn('[Eitaa.WebApp] Orientation locking is not supported in version ' + webAppVersion);
        return;
      }
      setOrientationLock(locked);
      WebView.postEvent('web_app_toggle_orientation_lock', false, {locked: webAppIsOrientationLocked});
    }
  
    var homeScreenCallbacks = [];
    function onHomeScreenAdded(eventType, eventData) {
      receiveWebViewEvent('homeScreenAdded');
    }
    function onHomeScreenChecked(eventType, eventData) {
      var status = eventData.status || 'unknown';
      if (homeScreenCallbacks.length > 0) {
        for (var i = 0; i < homeScreenCallbacks.length; i++) {
          var callback = homeScreenCallbacks[i];
          callback(status);
        }
        homeScreenCallbacks = [];
      }
      receiveWebViewEvent('homeScreenChecked', {
        status: status
      });
    }
  
    var webAppPopupOpened = false;
    function onPopupClosed(eventType, eventData) {
      if (webAppPopupOpened) {
        var popupData = webAppPopupOpened;
        webAppPopupOpened = false;
        var button_id = null;
        if (typeof eventData.button_id !== 'undefined') {
          button_id = eventData.button_id;
        }
        if (popupData.callback) {
          popupData.callback(button_id);
        }
        receiveWebViewEvent('popupClosed', {
          button_id: button_id
        });
      }
    }
  
  
    function getHeaderColor() {
      if (webAppHeaderColorKey == 'secondary_bg_color') {
        return themeParams.secondary_bg_color;
      } else if (webAppHeaderColorKey == 'bg_color') {
        return themeParams.bg_color;
      }
      return webAppHeaderColor;
    }
    function setHeaderColor(color) {
      if (!versionAtLeast('1.0')) {
        console.warn('[Eitaa.WebApp] Header color is not supported in version ' + webAppVersion);
        return;
      }
      var head_color = null, color_key = null;
      if (color == 'bg_color' || color == 'secondary_bg_color') {
        color_key = color;
      } else {
        head_color = parseColorToHex(color);
        if (!head_color) {
          console.error('[Eitaa.WebApp] Header color format is invalid', color);
          throw Error('WebAppHeaderColorInvalid');
        }
      }
      webAppHeaderColorKey = color_key;
      webAppHeaderColor = head_color;
      updateHeaderColor();
    }
    var appHeaderColorKey = null, appHeaderColor = null;
    function updateHeaderColor() {
      if (appHeaderColorKey != webAppHeaderColorKey ||
          appHeaderColor != webAppHeaderColor) {
        appHeaderColorKey = webAppHeaderColorKey;
        appHeaderColor = webAppHeaderColor;
        if (appHeaderColor) {
          WebView.postEvent('web_app_set_header_color', false, {color: webAppHeaderColor});
        } else {
          WebView.postEvent('web_app_set_header_color', false, {color_key: webAppHeaderColorKey});
        }
      }
    }
  
    function getBackgroundColor() {
      if (webAppBackgroundColor == 'secondary_bg_color') {
        return themeParams.secondary_bg_color;
      } else if (webAppBackgroundColor == 'bg_color') {
        return themeParams.bg_color;
      }
      return webAppBackgroundColor;
    }
    function setBackgroundColor(color) {
      if (!versionAtLeast('1.0')) {
        console.warn('[Eitaa.WebApp] Background color is not supported in version ' + webAppVersion);
        return;
      }
      var bg_color;
      if (color == 'bg_color' || color == 'secondary_bg_color') {
        bg_color = color;
      } else {
        bg_color = parseColorToHex(color);
        if (!bg_color) {
          console.error('[Eitaa.WebApp] Background color format is invalid', color);
          throw Error('WebAppBackgroundColorInvalid');
        }
      }
      webAppBackgroundColor = bg_color;
      updateBackgroundColor();
    }
    var appBackgroundColor = null;
    function updateBackgroundColor() {
      var color = getBackgroundColor();
      if (appBackgroundColor != color) {
        appBackgroundColor = color;
        WebView.postEvent('web_app_set_background_color', false, {color: color});
      }
    }
  
    var bottomBarColor = 'bottom_bar_bg_color';
    function getBottomBarColor() {
      if (bottomBarColor == 'bottom_bar_bg_color') {
        return themeParams.bottom_bar_bg_color || themeParams.secondary_bg_color || '#ffffff';
      } else if (bottomBarColor == 'secondary_bg_color') {
        return themeParams.secondary_bg_color;
      } else if (bottomBarColor == 'bg_color') {
        return themeParams.bg_color;
      }
      return bottomBarColor;
    }
    function setBottomBarColor(color) {
      if (!versionAtLeast('1.3')) {
        console.warn('[Eitaa.WebApp] Bottom bar color is not supported in version ' + webAppVersion);
        return;
      }
      var bg_color;
      if (color == 'bg_color' || color == 'secondary_bg_color' || color == 'bottom_bar_bg_color') {
        bg_color = color;
      } else {
        bg_color = parseColorToHex(color);
        if (!bg_color) {
          console.error('[Eitaa.WebApp] Bottom bar color format is invalid', color);
          throw Error('WebAppBottomBarColorInvalid');
        }
      }
      bottomBarColor = bg_color;
      updateBottomBarColor();
      window.Eitaa.WebApp.SecondaryButton.setParams({});
    }
    var appBottomBarColor = null;
    function updateBottomBarColor() {
      var color = getBottomBarColor();
      if (appBottomBarColor != color) {
        appBottomBarColor = color;
        WebView.postEvent('web_app_set_bottom_bar_color', false, {color: color});
      }
      if (initParams.tgWebAppDebug) {
        updateDebugBottomBar();
      }
    }
  
  
    function parseColorToHex(color) {
      color += '';
      var match;
      if (match = /^\s*#([0-9a-f]{6})\s*$/i.exec(color)) {
        return '#' + match[1].toLowerCase();
      }
      else if (match = /^\s*#([0-9a-f])([0-9a-f])([0-9a-f])\s*$/i.exec(color)) {
        return ('#' + match[1] + match[1] + match[2] + match[2] + match[3] + match[3]).toLowerCase();
      }
      else if (match = /^\s*rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+\.{0,1}\d*))?\)\s*$/.exec(color)) {
        var r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
        r = (r < 16 ? '0' : '') + r.toString(16);
        g = (g < 16 ? '0' : '') + g.toString(16);
        b = (b < 16 ? '0' : '') + b.toString(16);
        return '#' + r + g + b;
      }
      return false;
    }
  
    function isColorDark(rgb) {
      rgb = rgb.replace(/[\s#]/g, '');
      if (rgb.length == 3) {
        rgb = rgb[0] + rgb[0] + rgb[1] + rgb[1] + rgb[2] + rgb[2];
      }
      var r = parseInt(rgb.substr(0, 2), 16);
      var g = parseInt(rgb.substr(2, 2), 16);
      var b = parseInt(rgb.substr(4, 2), 16);
      var hsp = Math.sqrt(0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b));
      return hsp < 120;
    }
  
    function versionCompare(v1, v2) {
      if (typeof v1 !== 'string') v1 = '';
      if (typeof v2 !== 'string') v2 = '';
      v1 = v1.replace(/^\s+|\s+$/g, '').split('.');
      v2 = v2.replace(/^\s+|\s+$/g, '').split('.');
      var a = Math.max(v1.length, v2.length), i, p1, p2;
      for (i = 0; i < a; i++) {
        p1 = parseInt(v1[i]) || 0;
        p2 = parseInt(v2[i]) || 0;
        if (p1 == p2) continue;
        if (p1 > p2) return 1;
        return -1;
      }
      return 0;
    }
  
    function versionAtLeast(ver) {
      return versionCompare(webAppVersion, ver) >= 0;
    }
  
    function byteLength(str) {
      if (window.Blob) {
        try { return new Blob([str]).size; } catch (e) {}
      }
      var s = str.length;
      for (var i=str.length-1; i>=0; i--) {
        var code = str.charCodeAt(i);
        if (code > 0x7f && code <= 0x7ff) s++;
        else if (code > 0x7ff && code <= 0xffff) s+=2;
        if (code >= 0xdc00 && code <= 0xdfff) i--;
      }
      return s;
    }
  
    var BackButton = (function() {
      var isVisible = false;
  
      var backButton = {};
      Object.defineProperty(backButton, 'isVisible', {
        set: function(val){ setParams({is_visible: val}); },
        get: function(){ return isVisible; },
        enumerable: true
      });
  
      var curButtonState = null;
  
      WebView.onEvent('back_button_pressed', onBackButtonPressed);
  
      function onBackButtonPressed() {
        receiveWebViewEvent('backButtonClicked');
      }
  
      function buttonParams() {
        return {is_visible: isVisible};
      }
  
      function buttonState(btn_params) {
        if (typeof btn_params === 'undefined') {
          btn_params = buttonParams();
        }
        return JSON.stringify(btn_params);
      }
  
      function buttonCheckVersion() {
        if (!versionAtLeast('1.0')) {
          console.warn('[Eitaa.WebApp] BackButton is not supported in version ' + webAppVersion);
          return false;
        }
        return true;
      }
  
      function updateButton() {
        var btn_params = buttonParams();
        var btn_state = buttonState(btn_params);
        if (curButtonState === btn_state) {
          return;
        }
        curButtonState = btn_state;
        WebView.postEvent('web_app_setup_back_button', false, btn_params);
      }
  
      function setParams(params) {
        if (!buttonCheckVersion()) {
          return backButton;
        }
        if (typeof params.is_visible !== 'undefined') {
          isVisible = !!params.is_visible;
        }
        updateButton();
        return backButton;
      }
  
      backButton.onClick = function(callback) {
        if (buttonCheckVersion()) {
          onWebViewEvent('backButtonClicked', callback);
        }
        return backButton;
      };
      backButton.offClick = function(callback) {
        if (buttonCheckVersion()) {
          offWebViewEvent('backButtonClicked', callback);
        }
        return backButton;
      };
      backButton.show = function() {
        return setParams({is_visible: true});
      };
      backButton.hide = function() {
        return setParams({is_visible: false});
      };
      return backButton;
    })();
  
    var debugBottomBar = null, debugBottomBarBtns = {}, bottomBarHeight = 0;
    if (initParams.tgWebAppDebug) {
      debugBottomBar = document.createElement('tg-bottom-bar');
      var debugBottomBarStyle = {
        display: 'flex',
        gap: '7px',
        font: '600 14px/18px sans-serif',
        width: '100%',
        background: getBottomBarColor(),
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0',
        margin: '0',
        padding: '7px',
        textAlign: 'center',
        boxSizing: 'border-box',
        zIndex: '10000'
      };
      for (var k in debugBottomBarStyle) {
        debugBottomBar.style[k] = debugBottomBarStyle[k];
      }
      document.addEventListener('DOMContentLoaded', function onDomLoaded(event) {
        document.removeEventListener('DOMContentLoaded', onDomLoaded);
        document.body.appendChild(debugBottomBar);
      });
      var animStyle = document.createElement('style');
      animStyle.innerHTML = 'tg-bottom-button.shine { position: relative; overflow: hidden; } tg-bottom-button.shine:before { content:""; position: absolute; top: 0; width: 100%; height: 100%; background: linear-gradient(120deg, transparent, rgba(255, 255, 255, .2), transparent); animation: tg-bottom-button-shine 5s ease-in-out infinite; } @-webkit-keyframes tg-bottom-button-shine { 0% {left: -100%;} 12%,100% {left: 100%}} @keyframes tg-bottom-button-shine { 0% {left: -100%;} 12%,100% {left: 100%}}';
      debugBottomBar.appendChild(animStyle);
    }
    function updateDebugBottomBar() {
      var mainBtn = debugBottomBarBtns.main._bottomButton;
      var secondaryBtn = debugBottomBarBtns.secondary._bottomButton;
      if (mainBtn.isVisible || secondaryBtn.isVisible) {
        debugBottomBar.style.display = 'flex';
        bottomBarHeight = 58;
        if (mainBtn.isVisible && secondaryBtn.isVisible) {
          if (secondaryBtn.position == 'top') {
            debugBottomBar.style.flexDirection = 'column-reverse';
            bottomBarHeight += 51;
          } else if (secondaryBtn.position == 'bottom') {
            debugBottomBar.style.flexDirection = 'column';
            bottomBarHeight += 51;
          } else if (secondaryBtn.position == 'left') {
            debugBottomBar.style.flexDirection = 'row-reverse';
          } else if (secondaryBtn.position == 'right') {
            debugBottomBar.style.flexDirection = 'row';
          }
        }
      } else {
        debugBottomBar.style.display = 'none';
        bottomBarHeight = 0;
      }
      debugBottomBar.style.background = getBottomBarColor();
      if (document.documentElement) {
        document.documentElement.style.boxSizing = 'border-box';
        document.documentElement.style.paddingBottom = bottomBarHeight + 'px';
      }
      setViewportHeight();
    }
  
  
    var BottomButtonConstructor = function(type) {
      var isMainButton = (type == 'main');
      if (isMainButton) {
        var setupFnName = 'web_app_setup_main_button';
        var tgEventName = 'main_button_pressed';
        var webViewEventName = 'mainButtonClicked';
        var buttonTextDefault = 'Continue';
        var buttonColorDefault = function(){ return themeParams.button_color || '#2481cc'; };
        var buttonTextColorDefault = function(){ return themeParams.button_text_color || '#ffffff'; };
      } else {
        var setupFnName = 'web_app_setup_secondary_button';
        var tgEventName = 'secondary_button_pressed';
        var webViewEventName = 'secondaryButtonClicked';
        var buttonTextDefault = 'Cancel';
        var buttonColorDefault = function(){ return getBottomBarColor(); };
        var buttonTextColorDefault = function(){ return themeParams.button_color || '#2481cc'; };
      }
  
      var isVisible = false;
      var isActive = true;
      var hasShineEffect = false;
      var isProgressVisible = false;
      var buttonType = type;
      var buttonText = buttonTextDefault;
      var buttonColor = false;
      var buttonTextColor = false;
      var buttonPosition = 'left';
  
      var bottomButton = {};
      Object.defineProperty(bottomButton, 'type', {
        get: function(){ return buttonType; },
        enumerable: true
      });
      Object.defineProperty(bottomButton, 'text', {
        set: function(val){ bottomButton.setParams({text: val}); },
        get: function(){ return buttonText; },
        enumerable: true
      });
      Object.defineProperty(bottomButton, 'color', {
        set: function(val){ bottomButton.setParams({color: val}); },
        get: function(){ return buttonColor || buttonColorDefault(); },
        enumerable: true
      });
      Object.defineProperty(bottomButton, 'textColor', {
        set: function(val){ bottomButton.setParams({text_color: val}); },
        get: function(){ return buttonTextColor || buttonTextColorDefault(); },
        enumerable: true
      });
      Object.defineProperty(bottomButton, 'isVisible', {
        set: function(val){ bottomButton.setParams({is_visible: val}); },
        get: function(){ return isVisible; },
        enumerable: true
      });
      Object.defineProperty(bottomButton, 'isProgressVisible', {
        get: function(){ return isProgressVisible; },
        enumerable: true
      });
      Object.defineProperty(bottomButton, 'isActive', {
        set: function(val){ bottomButton.setParams({is_active: val}); },
        get: function(){ return isActive; },
        enumerable: true
      });
      Object.defineProperty(bottomButton, 'hasShineEffect', {
        set: function(val){ bottomButton.setParams({has_shine_effect: val}); },
        get: function(){ return hasShineEffect; },
        enumerable: true
      });
      if (!isMainButton) {
        Object.defineProperty(bottomButton, 'position', {
          set: function(val){ bottomButton.setParams({position: val}); },
          get: function(){ return buttonPosition; },
          enumerable: true
        });
      }
  
      var curButtonState = null;
  
      WebView.onEvent(tgEventName, onBottomButtonPressed);
  
      var debugBtn = null;
      if (initParams.tgWebAppDebug) {
        debugBtn = document.createElement('tg-bottom-button');
        var debugBtnStyle = {
          display: 'none',
          width: '100%',
          height: '44px',
          borderRadius: '0',
          background: 'no-repeat right center',
          padding: '13px 15px',
          textAlign: 'center',
          boxSizing: 'border-box'
        };
        for (var k in debugBtnStyle) {
          debugBtn.style[k] = debugBtnStyle[k];
        }
        debugBottomBar.appendChild(debugBtn);
        debugBtn.addEventListener('click', onBottomButtonPressed, false);
        debugBtn._bottomButton = bottomButton;
        debugBottomBarBtns[type] = debugBtn;
      }
  
      function onBottomButtonPressed() {
        if (isActive) {
          receiveWebViewEvent(webViewEventName);
        }
      }
  
      function buttonParams() {
        var color = bottomButton.color;
        var text_color = bottomButton.textColor;
        if (isVisible) {
          var params = {
            is_visible: true,
            is_active: isActive,
            is_progress_visible: isProgressVisible,
            text: buttonText,
            color: color,
            text_color: text_color,
            has_shine_effect: hasShineEffect && isActive && !isProgressVisible
          };
          if (!isMainButton) {
            params.position = buttonPosition;
          }
        } else {
          var params = {
            is_visible: false
          };
        }
        return params;
      }
  
      function buttonState(btn_params) {
        if (typeof btn_params === 'undefined') {
          btn_params = buttonParams();
        }
        return JSON.stringify(btn_params);
      }
  
      function updateButton() {
        var btn_params = buttonParams();
        var btn_state = buttonState(btn_params);
        if (curButtonState === btn_state) {
          return;
        }
        curButtonState = btn_state;
        WebView.postEvent(setupFnName, false, btn_params);
        if (initParams.tgWebAppDebug) {
          updateDebugButton(btn_params);
        }
      }
  
      function updateDebugButton(btn_params) {
        if (btn_params.is_visible) {
          debugBtn.style.display = 'block';
  
          debugBtn.style.opacity = btn_params.is_active ? '1' : '0.8';
          debugBtn.style.cursor = btn_params.is_active ? 'pointer' : 'auto';
          debugBtn.disabled = !btn_params.is_active;
          debugBtn.innerText = btn_params.text;
          debugBtn.className = btn_params.has_shine_effect ? 'shine' : '';
          debugBtn.style.backgroundImage = btn_params.is_progress_visible ? "url('data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewport="0 0 48 48" width="48px" height="48px"><circle cx="50%" cy="50%" stroke="' + btn_params.text_color + '" stroke-width="2.25" stroke-linecap="round" fill="none" stroke-dashoffset="106" r="9" stroke-dasharray="56.52" rotate="-90"><animate attributeName="stroke-dashoffset" attributeType="XML" dur="360s" from="0" to="12500" repeatCount="indefinite"></animate><animateTransform attributeName="transform" attributeType="XML" type="rotate" dur="1s" from="-90 24 24" to="630 24 24" repeatCount="indefinite"></animateTransform></circle></svg>') + "')" : 'none';
          debugBtn.style.backgroundColor = btn_params.color;
          debugBtn.style.color = btn_params.text_color;
        } else {
          debugBtn.style.display = 'none';
        }
        updateDebugBottomBar();
      }
  
      function setParams(params) {
        if (typeof params.text !== 'undefined') {
          var text = strTrim(params.text);
          if (!text.length) {
            console.error('[Eitaa.WebApp] Bottom button text is required', params.text);
            throw Error('WebAppBottomButtonParamInvalid');
          }
          if (text.length > 64) {
            console.error('[Eitaa.WebApp] Bottom button text is too long', text);
            throw Error('WebAppBottomButtonParamInvalid');
          }
          buttonText = text;
        }
        if (typeof params.color !== 'undefined') {
          if (params.color === false ||
              params.color === null) {
            buttonColor = false;
          } else {
            var color = parseColorToHex(params.color);
            if (!color) {
              console.error('[Eitaa.WebApp] Bottom button color format is invalid', params.color);
              throw Error('WebAppBottomButtonParamInvalid');
            }
            buttonColor = color;
          }
        }
        if (typeof params.text_color !== 'undefined') {
          if (params.text_color === false ||
              params.text_color === null) {
            buttonTextColor = false;
          } else {
            var text_color = parseColorToHex(params.text_color);
            if (!text_color) {
              console.error('[Eitaa.WebApp] Bottom button text color format is invalid', params.text_color);
              throw Error('WebAppBottomButtonParamInvalid');
            }
            buttonTextColor = text_color;
          }
        }
        if (typeof params.is_visible !== 'undefined') {
          if (params.is_visible &&
              !bottomButton.text.length) {
            console.error('[Eitaa.WebApp] Bottom button text is required');
            throw Error('WebAppBottomButtonParamInvalid');
          }
          isVisible = !!params.is_visible;
        }
        if (typeof params.has_shine_effect !== 'undefined') {
          hasShineEffect = !!params.has_shine_effect;
        }
        if (!isMainButton && typeof params.position !== 'undefined') {
          if (params.position != 'left' && params.position != 'right' &&
              params.position != 'top' && params.position != 'bottom') {
            console.error('[Eitaa.WebApp] Bottom button posiition is invalid', params.position);
            throw Error('WebAppBottomButtonParamInvalid');
          }
          buttonPosition = params.position;
        }
        if (typeof params.is_active !== 'undefined') {
          isActive = !!params.is_active;
        }
        updateButton();
        return bottomButton;
      }
  
      bottomButton.setText = function(text) {
        return bottomButton.setParams({text: text});
      };
      bottomButton.onClick = function(callback) {
        onWebViewEvent(webViewEventName, callback);
        return bottomButton;
      };
      bottomButton.offClick = function(callback) {
        offWebViewEvent(webViewEventName, callback);
        return bottomButton;
      };
      bottomButton.show = function() {
        return bottomButton.setParams({is_visible: true});
      };
      bottomButton.hide = function() {
        return bottomButton.setParams({is_visible: false});
      };
      bottomButton.enable = function() {
        return bottomButton.setParams({is_active: true});
      };
      bottomButton.disable = function() {
        return bottomButton.setParams({is_active: false});
      };
      bottomButton.showProgress = function(leaveActive) {
        isActive = !!leaveActive;
        isProgressVisible = true;
        updateButton();
        return bottomButton;
      };
      bottomButton.hideProgress = function() {
        if (!bottomButton.isActive) {
          isActive = true;
        }
        isProgressVisible = false;
        updateButton();
        return bottomButton;
      }
      bottomButton.setParams = setParams;
      return bottomButton;
    };
    var MainButton = BottomButtonConstructor('main');
    var SecondaryButton = BottomButtonConstructor('secondary');
  
    var SettingsButton = (function() {
      var isVisible = false;
  
      var settingsButton = {};
      Object.defineProperty(settingsButton, 'isVisible', {
        set: function(val){ setParams({is_visible: val}); },
        get: function(){ return isVisible; },
        enumerable: true
      });
  
      var curButtonState = null;
  
      WebView.onEvent('settings_button_pressed', onSettingsButtonPressed);
  
      function onSettingsButtonPressed() {
        receiveWebViewEvent('settingsButtonClicked');
      }
  
      function buttonParams() {
        return {is_visible: isVisible};
      }
  
      function buttonState(btn_params) {
        if (typeof btn_params === 'undefined') {
          btn_params = buttonParams();
        }
        return JSON.stringify(btn_params);
      }
  
      function buttonCheckVersion() {
        if (!versionAtLeast('1.0')) {
          console.warn('[Eitaa.WebApp] SettingsButton is not supported in version ' + webAppVersion);
          return false;
        }
        return true;
      }
  
      function updateButton() {
        var btn_params = buttonParams();
        var btn_state = buttonState(btn_params);
        if (curButtonState === btn_state) {
          return;
        }
        curButtonState = btn_state;
        WebView.postEvent('web_app_setup_settings_button', false, btn_params);
      }
  
      function setParams(params) {
        if (!buttonCheckVersion()) {
          return settingsButton;
        }
        if (typeof params.is_visible !== 'undefined') {
          isVisible = !!params.is_visible;
        }
        updateButton();
        return settingsButton;
      }
  
      settingsButton.onClick = function(callback) {
        if (buttonCheckVersion()) {
          onWebViewEvent('settingsButtonClicked', callback);
        }
        return settingsButton;
      };
      settingsButton.offClick = function(callback) {
        if (buttonCheckVersion()) {
          offWebViewEvent('settingsButtonClicked', callback);
        }
        return settingsButton;
      };
      settingsButton.show = function() {
        return setParams({is_visible: true});
      };
      settingsButton.hide = function() {
        return setParams({is_visible: false});
      };
      return settingsButton;
    })();
  
    var HapticFeedback = (function() {
      var hapticFeedback = {};
  
      function triggerFeedback(params) {
        if (!versionAtLeast('1.0')) {
          console.warn('[Eitaa.WebApp] HapticFeedback is not supported in version ' + webAppVersion);
          return hapticFeedback;
        }
        if (params.type == 'impact') {
          if (params.impact_style != 'light' &&
              params.impact_style != 'medium' &&
              params.impact_style != 'heavy' &&
              params.impact_style != 'rigid' &&
              params.impact_style != 'soft') {
            console.error('[Eitaa.WebApp] Haptic impact style is invalid', params.impact_style);
            throw Error('WebAppHapticImpactStyleInvalid');
          }
        } else if (params.type == 'notification') {
          if (params.notification_type != 'error' &&
              params.notification_type != 'success' &&
              params.notification_type != 'warning') {
            console.error('[Eitaa.WebApp] Haptic notification type is invalid', params.notification_type);
            throw Error('WebAppHapticNotificationTypeInvalid');
          }
        } else if (params.type == 'selection_change') {
          // no params needed
        } else {
          console.error('[Eitaa.WebApp] Haptic feedback type is invalid', params.type);
          throw Error('WebAppHapticFeedbackTypeInvalid');
        }
        WebView.postEvent('web_app_trigger_haptic_feedback', false, params);
        return hapticFeedback;
      }
  
      hapticFeedback.impactOccurred = function(style) {
        return triggerFeedback({type: 'impact', impact_style: style});
      };
      hapticFeedback.notificationOccurred = function(type) {
        return triggerFeedback({type: 'notification', notification_type: type});
      };
      hapticFeedback.selectionChanged = function() {
        return triggerFeedback({type: 'selection_change'});
      };
      return hapticFeedback;
    })();
  
    var Accelerometer = (function() {
      var isStarted = false;
      var valueX = null, valueY = null, valueZ = null;
      var startCallbacks = [], stopCallbacks = [];
  
      var accelerometer = {};
      Object.defineProperty(accelerometer, 'isStarted', {
        get: function(){ return isStarted; },
        enumerable: true
      });
      Object.defineProperty(accelerometer, 'x', {
        get: function(){ return valueX; },
        enumerable: true
      });
      Object.defineProperty(accelerometer, 'y', {
        get: function(){ return valueY; },
        enumerable: true
      });
      Object.defineProperty(accelerometer, 'z', {
        get: function(){ return valueZ; },
        enumerable: true
      });
  
      WebView.onEvent('accelerometer_started', onAccelerometerStarted);
      WebView.onEvent('accelerometer_stopped', onAccelerometerStopped);
      WebView.onEvent('accelerometer_changed', onAccelerometerChanged);
      WebView.onEvent('accelerometer_failed',  onAccelerometerFailed);
  
      function onAccelerometerStarted(eventType, eventData) {
        isStarted = true;
        if (startCallbacks.length > 0) {
          for (var i = 0; i < startCallbacks.length; i++) {
            var callback = startCallbacks[i];
            callback(true);
          }
          startCallbacks = [];
        }
        receiveWebViewEvent('accelerometerStarted');
      }
      function onAccelerometerStopped(eventType, eventData) {
        isStarted = false;
        if (stopCallbacks.length > 0) {
          for (var i = 0; i < stopCallbacks.length; i++) {
            var callback = stopCallbacks[i];
            callback(true);
          }
          stopCallbacks = [];
        }
        receiveWebViewEvent('accelerometerStopped');
      }
      function onAccelerometerChanged(eventType, eventData) {
        valueX = eventData.x;
        valueY = eventData.y;
        valueZ = eventData.z;
        receiveWebViewEvent('accelerometerChanged');
      }
      function onAccelerometerFailed(eventType, eventData) {
        if (startCallbacks.length > 0) {
          for (var i = 0; i < startCallbacks.length; i++) {
            var callback = startCallbacks[i];
            callback(false);
          }
          startCallbacks = [];
        }
        receiveWebViewEvent('accelerometerFailed', {
          error: eventData.error
        });
      }
  
      function checkVersion() {
        if (!versionAtLeast('1.3')) {
          console.warn('[Eitaa.WebApp] Accelerometer is not supported in version ' + webAppVersion);
          return false;
        }
        return true;
      }
  
      accelerometer.start = function(params, callback) {
        params = params || {};
        if (!checkVersion()) {
          return accelerometer;
        }
        var req_params = {};
        var refresh_rate = parseInt(params.refresh_rate || 1000);
        if (isNaN(refresh_rate) || refresh_rate < 20 || refresh_rate > 1000) {
          console.warn('[Eitaa.WebApp] Accelerometer refresh_rate is invalid', refresh_rate);
        } else {
          req_params.refresh_rate = refresh_rate;
        }
  
        if (callback) {
          startCallbacks.push(callback);
        }
        WebView.postEvent('web_app_start_accelerometer', false, req_params);
        return accelerometer;
      };
      accelerometer.stop = function(callback) {
        if (!checkVersion()) {
          return accelerometer;
        }
        if (callback) {
          stopCallbacks.push(callback);
        }
        WebView.postEvent('web_app_stop_accelerometer');
        return accelerometer;
      };
      return accelerometer;
    })();
  
    var DeviceOrientation = (function() {
      var isStarted = false;
      var valueAlpha = null, valueBeta = null, valueGamma = null, valueAbsolute = false;
      var startCallbacks = [], stopCallbacks = [];
  
      var deviceOrientation = {};
      Object.defineProperty(deviceOrientation, 'isStarted', {
        get: function(){ return isStarted; },
        enumerable: true
      });
      Object.defineProperty(deviceOrientation, 'absolute', {
        get: function(){ return valueAbsolute; },
        enumerable: true
      });
      Object.defineProperty(deviceOrientation, 'alpha', {
        get: function(){ return valueAlpha; },
        enumerable: true
      });
      Object.defineProperty(deviceOrientation, 'beta', {
        get: function(){ return valueBeta; },
        enumerable: true
      });
      Object.defineProperty(deviceOrientation, 'gamma', {
        get: function(){ return valueGamma; },
        enumerable: true
      });
  
      WebView.onEvent('device_orientation_started',  onDeviceOrientationStarted);
      WebView.onEvent('device_orientation_stopped',  onDeviceOrientationStopped);
      WebView.onEvent('device_orientation_changed', onDeviceOrientationChanged);
      WebView.onEvent('device_orientation_failed',  onDeviceOrientationFailed);
  
      function onDeviceOrientationStarted(eventType, eventData) {
        isStarted = true;
        if (startCallbacks.length > 0) {
          for (var i = 0; i < startCallbacks.length; i++) {
            var callback = startCallbacks[i];
            callback(true);
          }
          startCallbacks = [];
        }
        receiveWebViewEvent('deviceOrientationStarted');
      }
      function onDeviceOrientationStopped(eventType, eventData) {
        isStarted = false;
        if (stopCallbacks.length > 0) {
          for (var i = 0; i < stopCallbacks.length; i++) {
            var callback = stopCallbacks[i];
            callback(true);
          }
          stopCallbacks = [];
        }
        receiveWebViewEvent('deviceOrientationStopped');
      }
      function onDeviceOrientationChanged(eventType, eventData) {
        valueAbsolute = !!eventData.absolute;
        valueAlpha = eventData.alpha;
        valueBeta  = eventData.beta;
        valueGamma = eventData.gamma;
        receiveWebViewEvent('deviceOrientationChanged');
      }
      function onDeviceOrientationFailed(eventType, eventData) {
        if (startCallbacks.length > 0) {
          for (var i = 0; i < startCallbacks.length; i++) {
            var callback = startCallbacks[i];
            callback(false);
          }
          startCallbacks = [];
        }
        receiveWebViewEvent('deviceOrientationFailed', {
          error: eventData.error
        });
      }
  
      function checkVersion() {
        if (!versionAtLeast('1.3')) {
          console.warn('[Eitaa.WebApp] DeviceOrientation is not supported in version ' + webAppVersion);
          return false;
        }
        return true;
      }
  
      deviceOrientation.start = function(params, callback) {
        params = params || {};
        if (!checkVersion()) {
          return deviceOrientation;
        }
        var req_params = {};
        var refresh_rate = parseInt(params.refresh_rate || 1000);
        if (isNaN(refresh_rate) || refresh_rate < 20 || refresh_rate > 1000) {
          console.warn('[Eitaa.WebApp] DeviceOrientation refresh_rate is invalid', refresh_rate);
        } else {
          req_params.refresh_rate = refresh_rate;
        }
        req_params.need_absolute = !!params.need_absolute;
  
        if (callback) {
          startCallbacks.push(callback);
        }
        WebView.postEvent('web_app_start_device_orientation', false, req_params);
        return deviceOrientation;
      };
      deviceOrientation.stop = function(callback) {
        if (!checkVersion()) {
          return deviceOrientation;
        }
        if (callback) {
          stopCallbacks.push(callback);
        }
        WebView.postEvent('web_app_stop_device_orientation');
        return deviceOrientation;
      };
      return deviceOrientation;
    })();
  
    var Gyroscope = (function() {
      var isStarted = false;
      var valueX = null, valueY = null, valueZ = null;
      var startCallbacks = [], stopCallbacks = [];
  
      var gyroscope = {};
      Object.defineProperty(gyroscope, 'isStarted', {
        get: function(){ return isStarted; },
        enumerable: true
      });
      Object.defineProperty(gyroscope, 'x', {
        get: function(){ return valueX; },
        enumerable: true
      });
      Object.defineProperty(gyroscope, 'y', {
        get: function(){ return valueY; },
        enumerable: true
      });
      Object.defineProperty(gyroscope, 'z', {
        get: function(){ return valueZ; },
        enumerable: true
      });
  
      WebView.onEvent('gyroscope_started',  onGyroscopeStarted);
      WebView.onEvent('gyroscope_stopped',  onGyroscopeStopped);
      WebView.onEvent('gyroscope_changed', onGyroscopeChanged);
      WebView.onEvent('gyroscope_failed',  onGyroscopeFailed);
  
      function onGyroscopeStarted(eventType, eventData) {
        isStarted = true;
        if (startCallbacks.length > 0) {
          for (var i = 0; i < startCallbacks.length; i++) {
            var callback = startCallbacks[i];
            callback(true);
          }
          startCallbacks = [];
        }
        receiveWebViewEvent('gyroscopeStarted');
      }
      function onGyroscopeStopped(eventType, eventData) {
        isStarted = false;
        if (stopCallbacks.length > 0) {
          for (var i = 0; i < stopCallbacks.length; i++) {
            var callback = stopCallbacks[i];
            callback(true);
          }
          stopCallbacks = [];
        }
        receiveWebViewEvent('gyroscopeStopped');
      }
      function onGyroscopeChanged(eventType, eventData) {
        valueX = eventData.x;
        valueY = eventData.y;
        valueZ = eventData.z;
        receiveWebViewEvent('gyroscopeChanged');
      }
      function onGyroscopeFailed(eventType, eventData) {
        if (startCallbacks.length > 0) {
          for (var i = 0; i < startCallbacks.length; i++) {
            var callback = startCallbacks[i];
            callback(false);
          }
          startCallbacks = [];
        }
        receiveWebViewEvent('gyroscopeFailed', {
          error: eventData.error
        });
      }
  
      function checkVersion() {
        if (!versionAtLeast('1.3')) {
          console.warn('[Eitaa.WebApp] Gyroscope is not supported in version ' + webAppVersion);
          return false;
        }
        return true;
      }
  
      gyroscope.start = function(params, callback) {
        params = params || {};
        if (!checkVersion()) {
          return gyroscope;
        }
        var req_params = {};
        var refresh_rate = parseInt(params.refresh_rate || 1000);
        if (isNaN(refresh_rate) || refresh_rate < 20 || refresh_rate > 1000) {
          console.warn('[Eitaa.WebApp] Gyroscope refresh_rate is invalid', refresh_rate);
        } else {
          req_params.refresh_rate = refresh_rate;
        }
  
        if (callback) {
          startCallbacks.push(callback);
        }
        WebView.postEvent('web_app_start_gyroscope', false, req_params);
        return gyroscope;
      };
      gyroscope.stop = function(callback) {
        if (!checkVersion()) {
          return gyroscope;
        }
        if (callback) {
          stopCallbacks.push(callback);
        }
        WebView.postEvent('web_app_stop_gyroscope');
        return gyroscope;
      };
      return gyroscope;
    })();
  
    var webAppPopupOpened = false;
    function onPopupClosed(eventType, eventData) {
      if (webAppPopupOpened) {
        var popupData = webAppPopupOpened;
        webAppPopupOpened = false;
        var button_id = null;
        if (typeof eventData.button_id !== 'undefined') {
          button_id = eventData.button_id;
        }
        if (popupData.callback) {
          popupData.callback(button_id);
        }
        receiveWebViewEvent('popupClosed', {
          button_id: button_id
        });
      }
    }
  
    var webAppScanQrPopupOpened = false;
    function onQrTextReceived(eventType, eventData) {
      if (webAppScanQrPopupOpened) {
        var popupData = webAppScanQrPopupOpened;
        var data = null;
        if (typeof eventData.data !== 'undefined') {
          data = eventData.data;
        }
        if (popupData.callback) {
          if (popupData.callback(data)) {
            webAppScanQrPopupOpened = false;
            WebView.postEvent('web_app_close_scan_qr_popup', false);
          }
        }
        receiveWebViewEvent('qrTextReceived', {
          data: data
        });
      }
    }
    function onScanQrPopupClosed(eventType, eventData) {
      webAppScanQrPopupOpened = false;
      receiveWebViewEvent('scanQrPopupClosed');
    }
  
    var WebAppWriteAccessRequested = false;
    function onWriteAccessRequested(eventType, eventData) {
      if (WebAppWriteAccessRequested) {
        var requestData = WebAppWriteAccessRequested;
        WebAppWriteAccessRequested = false;
        if (requestData.callback) {
          requestData.callback(eventData.status == 'allowed');
        }
        receiveWebViewEvent('writeAccessRequested', {
          status: eventData.status
        });
      }
    }
  
    function getRequestedContact(callback, timeout) {
      var reqTo, fallbackTo, reqDelay = 0;
      var reqInvoke = function() {
        invokeCustomMethod('getRequestedContact', {}, function(err, res) {
          if (res && res.data && res.data.length) {
            clearTimeout(fallbackTo);
            callback(res.data);
          } else {
            reqDelay += 50;
            reqTo = setTimeout(reqInvoke, reqDelay);
          }
        });
      };
      var fallbackInvoke = function() {
        clearTimeout(reqTo);
        callback('');
      };
      fallbackTo = setTimeout(fallbackInvoke, timeout);
      setTimeout(reqInvoke, 200);
      // reqInvoke();
    }
  
    var WebAppContactRequested = false;
    function onPhoneRequested(eventType, eventData) {
      if (WebAppContactRequested) {
        var requestData = WebAppContactRequested;
        WebAppContactRequested = false;
        var requestSent = eventData.status == 'sent';
        var webViewEvent = {
          status: eventData.status
        };
        if (requestSent) {
          getRequestedContact(function(res) {
            if (res && res.length) {
              webViewEvent.response = res;
              webViewEvent.responseUnsafe = Utils.urlParseQueryString(res);
              for (var key in webViewEvent.responseUnsafe) {
                var val = webViewEvent.responseUnsafe[key];
                try {
                  if (val.substr(0, 1) == '{' && val.substr(-1) == '}' ||
                      val.substr(0, 1) == '[' && val.substr(-1) == ']') {
                    webViewEvent.responseUnsafe[key] = JSON.parse(val);
                  }
                } catch (e) {}
              }
            }
            if (requestData.callback) {
              requestData.callback(requestSent, webViewEvent);
            }
            receiveWebViewEvent('contactRequested', webViewEvent);
          }, 7000);
        } else {
          if (requestData.callback) {
            requestData.callback(requestSent, webViewEvent);
          }
          receiveWebViewEvent('contactRequested', webViewEvent);
        }
      }
    }
  
    var webAppDownloadFileRequested = false;
    function onFileDownloadRequested(eventType, eventData) {
      if (webAppDownloadFileRequested) {
        var requestData = webAppDownloadFileRequested;
        webAppDownloadFileRequested = false;
        var isDownloading = eventData.status == 'downloading';
        if (requestData.callback) {
          requestData.callback(isDownloading);
        }
        receiveWebViewEvent('fileDownloadRequested', {
          status: isDownloading ? 'downloading' : 'cancelled'
        });
      }
    }
  
    function onCustomMethodInvoked(eventType, eventData) {
      if (eventData.req_id && webAppCallbacks[eventData.req_id]) {
        var requestData = webAppCallbacks[eventData.req_id];
        delete webAppCallbacks[eventData.req_id];
        var res = null, err = null;
        if (typeof eventData.result !== 'undefined') {
          res = eventData.result;
        }
        if (typeof eventData.error !== 'undefined') {
          err = eventData.error;
        }
        if (requestData.callback) {
          requestData.callback(err, res);
        }
      }
    }
  
    function invokeCustomMethod(method, params, callback) {
      if (!versionAtLeast('1.0')) {
        console.error('[Eitaa.WebApp] Method invokeCustomMethod is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      var req_id = generateCallbackId(16);
      var req_params = {req_id: req_id, method: method, params: params || {}};
      webAppCallbacks[req_id] = {
        callback: callback
      };
      WebView.postEvent('web_app_invoke_custom_method', false, req_params);
    };
  
    if (!window.Eitaa) {
      window.Eitaa = {};
    }
  
    Object.defineProperty(WebApp, 'initData', {
      get: function(){ return webAppInitData; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'initDataUnsafe', {
      get: function(){ return webAppInitDataUnsafe; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'version', {
      get: function(){ return webAppVersion; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'platform', {
      get: function(){ return webAppPlatform; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'colorScheme', {
      get: function(){ return colorScheme; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'themeParams', {
      get: function(){ return themeParams; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'isExpanded', {
      get: function(){ return isExpanded; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'viewportHeight', {
      get: function(){ return (viewportHeight === false ? window.innerHeight : viewportHeight) - bottomBarHeight; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'viewportStableHeight', {
      get: function(){ return (viewportStableHeight === false ? window.innerHeight : viewportStableHeight) - bottomBarHeight; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'safeAreaInset', {
      get: function(){ return safeAreaInset; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'contentSafeAreaInset', {
      get: function(){ return contentSafeAreaInset; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'isClosingConfirmationEnabled', {
      set: function(val){ setClosingConfirmation(val); },
      get: function(){ return isClosingConfirmationEnabled; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'isVerticalSwipesEnabled', {
      set: function(val){ toggleVerticalSwipes(val); },
      get: function(){ return isVerticalSwipesEnabled; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'isWindowSecureEnabled', {
      set: function(val){ toggleWindowSecure(val); },
      get: function(){ return isWindowSecureEnabled; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'isFullscreen', {
      get: function(){ return webAppIsFullscreen; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'isOrientationLocked', {
      set: function(val){ toggleOrientationLock(val); },
      get: function(){ return webAppIsOrientationLocked; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'isActive', {
      get: function(){ return webAppIsActive; },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'headerColor', {
      set: function(val){ setHeaderColor(val); },
      get: function(){ return getHeaderColor(); },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'backgroundColor', {
      set: function(val){ setBackgroundColor(val); },
      get: function(){ return getBackgroundColor(); },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'bottomBarColor', {
      set: function(val){ setBottomBarColor(val); },
      get: function(){ return getBottomBarColor(); },
      enumerable: true
    });
    Object.defineProperty(WebApp, 'BackButton', {
      value: BackButton,
      enumerable: true
    });
    Object.defineProperty(WebApp, 'MainButton', {
      value: MainButton,
      enumerable: true
    });
    Object.defineProperty(WebApp, 'SecondaryButton', {
      value: SecondaryButton,
      enumerable: true
    });
    Object.defineProperty(WebApp, 'SettingsButton', {
      value: SettingsButton,
      enumerable: true
    });
    Object.defineProperty(WebApp, 'HapticFeedback', {
      value: HapticFeedback,
      enumerable: true
    });
    Object.defineProperty(WebApp, 'Accelerometer', {
      value: Accelerometer,
      enumerable: true
    });
    Object.defineProperty(WebApp, 'DeviceOrientation', {
      value: DeviceOrientation,
      enumerable: true
    });
    Object.defineProperty(WebApp, 'Gyroscope', {
      value: Gyroscope,
      enumerable: true
    });
    WebApp.isVersionAtLeast = function(ver) {
      return versionAtLeast(ver);
    };
    WebApp.setHeaderColor = function(color_key) {
      WebApp.headerColor = color_key;
    };
    WebApp.setBackgroundColor = function(color) {
      WebApp.backgroundColor = color;
    };
    WebApp.setBottomBarColor = function(color) {
      WebApp.bottomBarColor = color;
    };
    WebApp.enableClosingConfirmation = function() {
      WebApp.isClosingConfirmationEnabled = true;
    };
    WebApp.disableClosingConfirmation = function() {
      WebApp.isClosingConfirmationEnabled = false;
    };
    WebApp.enableVerticalSwipes = function() {
      WebApp.isVerticalSwipesEnabled = true;
    };
    WebApp.disableVerticalSwipes = function() {
      WebApp.isVerticalSwipesEnabled = false;
    };
    WebApp.enableWindowSecure = function() {
      WebApp.isWindowSecureEnabled = true;
    };
    WebApp.disableWindowSecure = function() {
      WebApp.isWindowSecureEnabled = false;
    };
    WebApp.lockOrientation = function() {
      WebApp.isOrientationLocked = true;
    };
    WebApp.unlockOrientation = function() {
      WebApp.isOrientationLocked = false;
    };
    WebApp.requestFullscreen = function() {
      if (!versionAtLeast('1.3')) {
        console.error('[Eitaa.WebApp] Method requestFullscreen is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      WebView.postEvent('web_app_request_fullscreen');
    };
    WebApp.exitFullscreen = function() {
      if (!versionAtLeast('1.3')) {
        console.error('[Eitaa.WebApp] Method exitFullscreen is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      WebView.postEvent('web_app_exit_fullscreen');
    };
    WebApp.addToHomeScreen = function() {
      if (!versionAtLeast('1.3')) {
        console.error('[Eitaa.WebApp] Method addToHomeScreen is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      WebView.postEvent('web_app_add_to_home_screen');
    };
    WebApp.checkHomeScreenStatus = function(callback) {
      if (!versionAtLeast('1.3')) {
        console.error('[Eitaa.WebApp] Method checkHomeScreenStatus is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      if (callback) {
        homeScreenCallbacks.push(callback);
      }
      WebView.postEvent('web_app_check_home_screen');
    };
    WebApp.onEvent = function(eventType, callback) {
      onWebViewEvent(eventType, callback);
    };
    WebApp.offEvent = function(eventType, callback) {offWebViewEvent(eventType, callback);
    };
    WebApp.openLink = function (url, options) {
      var a = document.createElement('A');
      a.href = url;
      if (a.protocol != 'http:' &&
          a.protocol != 'https:') {
        console.error('[Eitaa.WebApp] Url protocol is not supported', url);
        throw Error('WebAppTgUrlInvalid');
      }
      var url = a.href;
      options = options || {};
      if (versionAtLeast('1.0')) {
        var req_params = {url: url};
        if (options.try_instant_view) {
          req_params.try_instant_view = true;
        }
        if (versionAtLeast('1.3') && options.try_browser) {
          req_params.try_browser = options.try_browser;
        }
        WebView.postEvent('web_app_open_link', false, req_params);
      } else {
        window.open(url, '_blank');
      }
    };
    WebApp.openEitaaLink = function (url, options) {
      var a = document.createElement('A');
      a.href = url;
      if (a.protocol != 'http:' &&
          a.protocol != 'https:') {
        console.error('[Eitaa.WebApp] Url protocol is not supported', url);
        throw Error('WebAppTgUrlInvalid');
      }
      if (a.hostname != 'eitaa.com') {
        console.error('[Eitaa.WebApp] Url host is not supported', url);
        throw Error('WebAppTgUrlInvalid');
      }
      var path_full = a.pathname + a.search;
      options = options || {};
      if (isIframe || versionAtLeast('1.0')) {
        var req_params = {path_full: path_full};
        if (options.force_request) {
          req_params.force_request = true;
        }
        WebView.postEvent('web_app_open_tg_link', false, req_params);
      } else {
        location.href = 'https://eitaa.com' + path_full;
      }
    };
    WebApp.showPopup = function (params, callback) {
      if (!versionAtLeast('1.0')) {
        console.error('[Eitaa.WebApp] Method showPopup is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      if (webAppPopupOpened) {
        console.error('[Eitaa.WebApp] Popup is already opened');
        throw Error('WebAppPopupOpened');
      }
      var title = '';
      var message = '';
      var buttons = [];
      var popup_buttons = {};
      var popup_params = {};
      if (typeof params.title !== 'undefined') {
        title = strTrim(params.title);
        if (title.length > 64) {
          console.error('[Eitaa.WebApp] Popup title is too long', title);
          throw Error('WebAppPopupParamInvalid');
        }
        if (title.length > 0) {
          popup_params.title = title;
        }
      }
      if (typeof params.message !== 'undefined') {
        message = strTrim(params.message);
      }
      if (!message.length) {
        console.error('[Eitaa.WebApp] Popup message is required', params.message);
        throw Error('WebAppPopupParamInvalid');
      }
      if (message.length > 256) {
        console.error('[Eitaa.WebApp] Popup message is too long', message);
        throw Error('WebAppPopupParamInvalid');
      }
      popup_params.message = message;
      if (typeof params.buttons !== 'undefined') {
        if (!Array.isArray(params.buttons)) {
          console.error('[Eitaa.WebApp] Popup buttons should be an array', params.buttons);
          throw Error('WebAppPopupParamInvalid');
        }
        for (var i = 0; i < params.buttons.length; i++) {
          var button = params.buttons[i];
          var btn = {};
          var id = '';
          if (typeof button.id !== 'undefined') {
            id = button.id.toString();
            if (id.length > 64) {
              console.error('[Eitaa.WebApp] Popup button id is too long', id);
              throw Error('WebAppPopupParamInvalid');
            }
          }
          btn.id = id;
          var button_type = button.type;
          if (typeof button_type === 'undefined') {
            button_type = 'default';
          }
          btn.type = button_type;
          if (button_type == 'ok' ||
              button_type == 'close' ||
              button_type == 'cancel') {
            // no params needed
          } else if (button_type == 'default' ||
                     button_type == 'destructive') {
            var text = '';
            if (typeof button.text !== 'undefined') {
              text = strTrim(button.text);
            }
            if (!text.length) {
              console.error('[Eitaa.WebApp] Popup button text is required for type ' + button_type, button.text);
              throw Error('WebAppPopupParamInvalid');
            }
            if (text.length > 64) {
              console.error('[Eitaa.WebApp] Popup button text is too long', text);
              throw Error('WebAppPopupParamInvalid');
            }
            btn.text = text;
          } else {
            console.error('[Eitaa.WebApp] Popup button type is invalid', button_type);
            throw Error('WebAppPopupParamInvalid');
          }
          buttons.push(btn);
        }
      } else {
        buttons.push({id: '', type: 'close'});
      }
      if (buttons.length < 1) {
        console.error('[Eitaa.WebApp] Popup should have at least one button');
        throw Error('WebAppPopupParamInvalid');
      }
      if (buttons.length > 3) {
        console.error('[Eitaa.WebApp] Popup should not have more than 3 buttons');
        throw Error('WebAppPopupParamInvalid');
      }
      popup_params.buttons = buttons;
  
      webAppPopupOpened = {
        callback: callback
      };
      WebView.postEvent('web_app_open_popup', false, popup_params);
    };
    WebApp.showAlert = function (message, callback) {
      WebApp.showPopup({
        message: message
      }, callback ? function(){ callback(); } : null);
    };
    WebApp.showConfirm = function (message, callback) {
      WebApp.showPopup({
        message: message,
        buttons: [
          {type: 'ok', id: 'ok'},
          {type: 'cancel'}
        ]
      }, callback ? function (button_id) {
        callback(button_id == 'ok');
      } : null);
    };
    WebApp.showScanQrPopup = function (params, callback) {
      if (!versionAtLeast('1.0')) {
        console.error('[Eitaa.WebApp] Method showScanQrPopup is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      if (webAppScanQrPopupOpened) {
        console.error('[Eitaa.WebApp] Popup is already opened');
        throw Error('WebAppScanQrPopupOpened');
      }
      var text = '';
      var popup_params = {};
      if (typeof params.text !== 'undefined') {
        text = strTrim(params.text);
        if (text.length > 64) {
          console.error('[Eitaa.WebApp] Scan QR popup text is too long', text);
          throw Error('WebAppScanQrPopupParamInvalid');
        }
        if (text.length > 0) {
          popup_params.text = text;
        }
      }
  
      webAppScanQrPopupOpened = {
        callback: callback
      };
      WebView.postEvent('web_app_open_scan_qr_popup', false, popup_params);
    };
    WebApp.closeScanQrPopup = function () {
      if (!versionAtLeast('1.0')) {
        console.error('[Eitaa.WebApp] Method closeScanQrPopup is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
  
      webAppScanQrPopupOpened = false;
      WebView.postEvent('web_app_close_scan_qr_popup', false);
    };
    WebApp.requestWriteAccess = function (callback) {
      if (!versionAtLeast('1.0')) {
        console.error('[Eitaa.WebApp] Method requestWriteAccess is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      if (WebAppWriteAccessRequested) {
        console.error('[Eitaa.WebApp] Write access is already requested');
        throw Error('WebAppWriteAccessRequested');
      }
      WebAppWriteAccessRequested = {
        callback: callback
      };
      WebView.postEvent('web_app_request_write_access');
    };
    WebApp.requestContact = function (callback) {
      if (!versionAtLeast('1.0')) {
        console.error('[Eitaa.WebApp] Method requestContact is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      if (WebAppContactRequested) {
        console.error('[Eitaa.WebApp] Contact is already requested');
        throw Error('WebAppContactRequested');
      }
      WebAppContactRequested = {
        callback: callback
      };
      WebView.postEvent('web_app_request_phone');
    };
    WebApp.downloadFile = function (params, callback) {
      if (!versionAtLeast('1.4')) { 
        console.error('[Eitaa.WebApp] Method downloadFile is not supported in version ' + webAppVersion);
        throw Error('WebAppMethodUnsupported');
      }
      if (webAppDownloadFileRequested) {
        console.error('[Eitaa.WebApp] Popup is already opened');
        throw Error('WebAppDownloadFilePopupOpened');
      }
      var a = document.createElement('A');
  
      var dl_params = {};
      if (!params || !params.url || !params.url.length) {
        console.error('[Eitaa.WebApp] Url is required');
        throw Error('WebAppDownloadFileParamInvalid');
      }
      a.href = params.url;
      if (a.protocol != 'https:') {
        console.error('[Eitaa.WebApp] Url protocol is not supported', url);
        throw Error('WebAppDownloadFileParamInvalid');
      }
      dl_params.url = a.href;
  
      if (!params || !params.file_name || !params.file_name.length) {
        console.error('[Eitaa.WebApp] File name is required');
        throw Error('WebAppDownloadFileParamInvalid');
      }
      dl_params.file_name = params.file_name;
  
      webAppDownloadFileRequested = {
        callback: callback
      };
      WebView.postEvent('web_app_request_file_download', false, dl_params);
    };
    WebApp.invokeCustomMethod = function (method, params, callback) {
      invokeCustomMethod(method, params, callback);
    };
    WebApp.ready = function () {
      WebView.postEvent('web_app_ready');
    };
    WebApp.expand = function () {
      WebView.postEvent('web_app_expand');
    };
    WebApp.close = function (options) {
      options = options || {};
      var req_params = {};
      if (versionAtLeast('1.0') && options.return_back) {
        req_params.return_back = true;
      }
      WebView.postEvent('web_app_close', false, req_params);
    };
  
    window.Eitaa.WebApp = WebApp;
  
    updateHeaderColor();
    updateBackgroundColor();
    updateBottomBarColor();
    setViewportHeight();
    if (initParams.tgWebAppShowSettings) {
      SettingsButton.show();
    }
  
    window.addEventListener('resize', onWindowResize);
    if (isIframe) {
      document.addEventListener('click', linkHandler);
    }
  
    WebView.onEvent('theme_changed', onThemeChanged);
    WebView.onEvent('viewport_changed', onViewportChanged);
    WebView.onEvent('safe_area_changed', onSafeAreaChanged);
    WebView.onEvent('content_safe_area_changed', onContentSafeAreaChanged);
    WebView.onEvent('visibility_changed', onVisibilityChanged);
    WebView.onEvent('popup_closed', onPopupClosed);
    WebView.onEvent('qr_text_received', onQrTextReceived);
    WebView.onEvent('scan_qr_popup_closed', onScanQrPopupClosed);
    WebView.onEvent('write_access_requested', onWriteAccessRequested);
    WebView.onEvent('phone_requested', onPhoneRequested);
    WebView.onEvent('file_download_requested', onFileDownloadRequested);
    WebView.onEvent('custom_method_invoked', onCustomMethodInvoked);
    WebView.onEvent('fullscreen_changed', onFullscreenChanged);
    WebView.onEvent('fullscreen_failed', onFullscreenFailed);
    WebView.onEvent('home_screen_added', onHomeScreenAdded);
    WebView.onEvent('home_screen_checked', onHomeScreenChecked);
    WebView.postEvent('web_app_request_theme');
    WebView.postEvent('web_app_request_viewport');
    WebView.postEvent('web_app_request_safe_area');
    WebView.postEvent('web_app_request_content_safe_area');
    WebApp.disableVerticalSwipes();
  })();
  