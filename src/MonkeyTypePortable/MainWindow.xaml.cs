using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using Microsoft.Web.WebView2.Core;
using Microsoft.Win32;

namespace MonkeyTypePortable;

public partial class MainWindow : Window
{
    /// <summary>Private virtual host the embedded web app is served from. Nothing ever leaves the machine.</summary>
    const string Host = "app.monkeytype.portable";
    static readonly string StartUrl = $"https://{Host}/index.html";

    readonly bool _smoke;
    readonly WindowSettings _settings = WindowSettings.Load();
    readonly List<string> _blocked = new();
    CoreWebView2Environment? _env;
    WindowState _preFullscreenState;
    WindowStyle _preFullscreenStyle;
    ResizeMode _preFullscreenResize;
    bool _fullscreen;

    public MainWindow(bool smoke)
    {
        _smoke = smoke;
        InitializeComponent();
        ApplyPlacement();
        SetChromeColors(_settings.Background, _settings.Text);
        Loaded += async (_, _) => await InitWebViewAsync();
        Closing += (_, _) => SavePlacement();
        SourceInitialized += (_, _) => SetChromeColors(_settings.Background, _settings.Text);
    }

    async Task InitWebViewAsync()
    {
        try
        {
            CoreWebView2Environment.GetAvailableBrowserVersionString();
        }
        catch (WebView2RuntimeNotFoundException)
        {
            Status.Text = "Microsoft Edge WebView2 Runtime is missing.\nIt ships with Windows 11; on older Windows install the Evergreen runtime once.";
            PortablePaths.Log("WebView2 runtime not found");
            return;
        }

        try
        {
            var options = new CoreWebView2EnvironmentOptions(
                "--disable-background-networking --disable-component-update --disable-domain-reliability " +
                "--no-pings --disable-features=msSmartScreenProtection,AutofillServerCommunication");
            _env = await CoreWebView2Environment.CreateAsync(null, PortablePaths.WebViewDir, options);
            Web.DefaultBackgroundColor = ToDrawingColor(_settings.Background);
            await Web.EnsureCoreWebView2Async(_env);
        }
        catch (Exception ex)
        {
            Status.Text = "Could not start the web view:\n" + ex.Message;
            PortablePaths.Log("webview init failed: " + ex);
            return;
        }

        var core = Web.CoreWebView2;
        var devtools = Environment.GetCommandLineArgs().Contains("--devtools", StringComparer.OrdinalIgnoreCase);
        var s = core.Settings;
        s.AreDevToolsEnabled = devtools;
        s.AreDefaultContextMenusEnabled = devtools;
        s.AreBrowserAcceleratorKeysEnabled = false;   // F5/ctrl+R/ctrl+F etc. go to the app instead
        s.IsStatusBarEnabled = false;
        s.IsPasswordAutosaveEnabled = false;
        s.IsGeneralAutofillEnabled = false;
        s.IsSwipeNavigationEnabled = false;
        s.IsReputationCheckingRequired = false;

        // every request goes through here: embedded files are served, anything else is refused
        core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += OnWebResourceRequested;
        core.NavigationStarting += (_, e) =>
        {
            if (!e.Uri.StartsWith($"https://{Host}/", StringComparison.OrdinalIgnoreCase))
            {
                e.Cancel = true;
                PortablePaths.Log("navigation blocked: " + e.Uri);
            }
        };
        core.NewWindowRequested += (_, e) => e.Handled = true;
        core.WebMessageReceived += OnWebMessage;
        core.ContainsFullScreenElementChanged += (_, _) => SetFullscreen(core.ContainsFullScreenElement);
        core.DownloadStarting += OnDownloadStarting;
        core.DocumentTitleChanged += (_, _) => Title = core.DocumentTitle.Replace("Monkeytype Portable", "Monkeytype");
        core.NavigationCompleted += async (_, e) =>
        {
            Status.Visibility = Visibility.Collapsed;
            if (!e.IsSuccess) PortablePaths.Log("navigation failed: " + e.WebErrorStatus);
            if (_smoke) await RunSmokeAsync(e.IsSuccess);
        };
        core.Navigate(StartUrl);
    }

    void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        var uri = new Uri(e.Request.Uri);
        if (uri.Scheme == "https" && uri.Host.Equals(Host, StringComparison.OrdinalIgnoreCase))
        {
            var stream = WebAssets.Open(uri.AbsolutePath, out var contentType);
            e.Response = stream is null
                ? _env!.CreateWebResourceResponse(null, 404, "Not Found", "Content-Type: text/plain")
                : _env!.CreateWebResourceResponse(stream, 200, "OK", $"Content-Type: {contentType}\r\nCache-Control: no-cache");
            return;
        }
        lock (_blocked) _blocked.Add(e.Request.Uri);
        PortablePaths.Log("request blocked (offline app): " + e.Request.Uri);
        e.Response = _env!.CreateWebResourceResponse(null, 403, "Blocked", "Content-Type: text/plain");
    }

    void OnWebMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            using var doc = JsonDocument.Parse(e.WebMessageAsJson);
            var root = doc.RootElement;
            if (root.TryGetProperty("type", out var type) && type.GetString() == "theme")
            {
                var bg = root.GetProperty("bg").GetString() ?? "#323437";
                var text = root.GetProperty("text").GetString() ?? "#d1d0c5";
                _settings.Background = bg;
                _settings.Text = text;
                SetChromeColors(bg, text);
            }
        }
        catch (Exception ex)
        {
            PortablePaths.Log("bad web message: " + ex.Message);
        }
    }

    void OnDownloadStarting(object? sender, CoreWebView2DownloadStartingEventArgs e)
    {
        // exports (JSON backup / CSV) get a normal Save dialog instead of the browser download bubble
        var deferral = e.GetDeferral();
        e.Handled = true;
        Dispatcher.BeginInvoke(() =>
        {
            using (deferral)
            {
                var suggested = Path.GetFileName(e.ResultFilePath);
                var dlg = new SaveFileDialog
                {
                    FileName = suggested,
                    Filter = Path.GetExtension(suggested).ToLowerInvariant() switch
                    {
                        ".json" => "JSON file (*.json)|*.json|All files (*.*)|*.*",
                        ".csv" => "CSV file (*.csv)|*.csv|All files (*.*)|*.*",
                        _ => "All files (*.*)|*.*",
                    },
                    InitialDirectory = PortablePaths.ExeDir,
                };
                if (dlg.ShowDialog(this) == true) e.ResultFilePath = dlg.FileName;
                else e.Cancel = true;
            }
        });
    }

    async Task RunSmokeAsync(bool navOk)
    {
        await Task.Delay(1500);
        string probe;
        try
        {
            probe = await Web.CoreWebView2.ExecuteScriptAsync(
                "JSON.stringify({version: MT.version, page: MT.currentPage, themes: MT.themeNames.length, " +
                "words: MT.test.state.words.length, firstWords: MT.test.state.words.slice(0,5).join(' '), " +
                "quotes: MT_QUOTES.quotes.length, languages: Object.keys(MT_LANGUAGES).join(','), " +
                "font: document.fonts.check('16px \"Roboto Mono\"'), lineHeight: getComputedStyle(document.getElementById('wordsWrapper')).height})");
        }
        catch (Exception ex)
        {
            probe = "\"script failed: " + ex.Message + "\"";
        }
        string[] blocked;
        lock (_blocked) blocked = _blocked.ToArray();
        var report = $"navigation ok: {navOk}\nembedded assets: {WebAssets.Count}\ndata dir: {PortablePaths.DataDir}\n" +
                     $"probe: {probe}\nblocked requests: {blocked.Length}\n" + string.Join("\n", blocked);
        File.WriteAllText(Path.Combine(PortablePaths.DataDir, "smoke.txt"), report);
        Close();
    }

    /* ---------------- window chrome ---------------- */

    [DllImport("dwmapi.dll")]
    static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
    const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    const int DWMWA_CAPTION_COLOR = 35;
    const int DWMWA_TEXT_COLOR = 36;

    void SetChromeColors(string bgHex, string textHex)
    {
        try
        {
            var bg = (Color)ColorConverter.ConvertFromString(Normalize(bgHex));
            Background = new SolidColorBrush(bg);
            Status.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString(Normalize(textHex)));
            if (Web.CoreWebView2 is null) Web.DefaultBackgroundColor = ToDrawingColor(bgHex);
            var hwnd = new WindowInteropHelper(this).Handle;
            if (hwnd == IntPtr.Zero) return;
            var text = (Color)ColorConverter.ConvertFromString(Normalize(textHex));
            int dark = (0.2126 * bg.R + 0.7152 * bg.G + 0.0722 * bg.B) < 128 ? 1 : 0;
            DwmSetWindowAttribute(hwnd, DWMWA_USE_IMMERSIVE_DARK_MODE, ref dark, sizeof(int));
            int caption = bg.R | (bg.G << 8) | (bg.B << 16);
            int captionText = text.R | (text.G << 8) | (text.B << 16);
            DwmSetWindowAttribute(hwnd, DWMWA_CAPTION_COLOR, ref caption, sizeof(int));
            DwmSetWindowAttribute(hwnd, DWMWA_TEXT_COLOR, ref captionText, sizeof(int));
        }
        catch (Exception ex)
        {
            PortablePaths.Log("chrome colors: " + ex.Message);
        }
    }

    static string Normalize(string hex)
    {
        hex = hex.Trim();
        if (!hex.StartsWith('#')) hex = "#" + hex;
        if (hex.Length == 4) hex = "#" + string.Concat(hex.Skip(1).Select(c => $"{c}{c}"));
        if (hex.Length == 9) hex = "#" + hex.Substring(7, 2) + hex.Substring(1, 6);   // #RRGGBBAA -> #AARRGGBB
        return hex;
    }

    static System.Drawing.Color ToDrawingColor(string hex)
    {
        try
        {
            var c = (Color)ColorConverter.ConvertFromString(Normalize(hex));
            return System.Drawing.Color.FromArgb(255, c.R, c.G, c.B);
        }
        catch
        {
            return System.Drawing.Color.FromArgb(255, 0x32, 0x34, 0x37);
        }
    }

    void SetFullscreen(bool on)
    {
        if (on == _fullscreen) return;
        _fullscreen = on;
        if (on)
        {
            _preFullscreenState = WindowState;
            _preFullscreenStyle = WindowStyle;
            _preFullscreenResize = ResizeMode;
            WindowState = WindowState.Normal;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            WindowState = WindowState.Maximized;
        }
        else
        {
            WindowStyle = _preFullscreenStyle;
            ResizeMode = _preFullscreenResize;
            WindowState = _preFullscreenState;
        }
    }

    void ApplyPlacement()
    {
        Width = Math.Max(MinWidth, _settings.Width);
        Height = Math.Max(MinHeight, _settings.Height);
        if (!double.IsNaN(_settings.Left) && !double.IsNaN(_settings.Top))
        {
            // only restore the position if it is still on a visible screen
            var vl = SystemParameters.VirtualScreenLeft;
            var vt = SystemParameters.VirtualScreenTop;
            var vr = vl + SystemParameters.VirtualScreenWidth;
            var vb = vt + SystemParameters.VirtualScreenHeight;
            if (_settings.Left > vl - 50 && _settings.Left < vr - 100 && _settings.Top > vt - 10 && _settings.Top < vb - 100)
            {
                WindowStartupLocation = WindowStartupLocation.Manual;
                Left = _settings.Left;
                Top = _settings.Top;
            }
        }
        if (_settings.Maximized) WindowState = WindowState.Maximized;
    }

    void SavePlacement()
    {
        if (_smoke) return;
        var r = _fullscreen || WindowState != WindowState.Normal ? RestoreBounds : new Rect(Left, Top, Width, Height);
        if (!r.IsEmpty)
        {
            _settings.Left = r.Left;
            _settings.Top = r.Top;
            _settings.Width = r.Width;
            _settings.Height = r.Height;
        }
        _settings.Maximized = WindowState == WindowState.Maximized && !_fullscreen;
        _settings.Save();
    }
}
